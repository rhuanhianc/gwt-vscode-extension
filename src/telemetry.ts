import * as vscode from 'vscode';
import TelemetryReporter from '@vscode/extension-telemetry';
import { config } from './config/config.real';

/**
 * Telemetry Service for GWT Helper
 */
export class TelemetryService {
    private static instance: TelemetryService;
    private reporter: TelemetryReporter | undefined;
    private enabled: boolean = true;
    private context: vscode.ExtensionContext | undefined;
    
    // Keys to store telemetry information
    private readonly INSTALL_KEY = 'gwt-helper.installed';
    private readonly TELEMETRY_INFO_KEY = 'gwt-helper.telemetryInfoShown';

    private constructor() {
        this.initialize();
    }

    /**
     * Get the singleton instance of the telemetry service
     */
    public static getInstance(): TelemetryService {
        if (!TelemetryService.instance) {
            TelemetryService.instance = new TelemetryService();
        }
        return TelemetryService.instance;
    }

    /**
     * Initialize the telemetry service
     */
    private initialize(): void {
        try {
            // Check if telemetry is disabled
            const isOptedOut = 
                vscode.env.isTelemetryEnabled === false || 
                vscode.workspace.getConfiguration('gwtHelper').get<boolean>('telemetry.enabled') === false;

            this.enabled = !isOptedOut;

            if (!config.telemetryKey) {
                this.enabled = false;
                return;
            }

            // Only initialize if enabled
            if (this.enabled) {
                this.reporter = new TelemetryReporter(config.telemetryKey);
            
                // Monitor configuration changes
                vscode.workspace.onDidChangeConfiguration(e => {
                    if (e.affectsConfiguration('gwtHelper.telemetry.enabled') || 
                        e.affectsConfiguration('telemetry.enableTelemetry')) {
                        this.checkTelemetryState();
                    }
                });
            } else {
            }
        } catch (err: any) {
            this.enabled = false;
        }
    }

    /**
     * Check if telemetry is still enabled after configuration changes
     */
    private checkTelemetryState(): void {
        const isOptedOut = 
            vscode.env.isTelemetryEnabled === false || 
            vscode.workspace.getConfiguration('gwtHelper').get<boolean>('telemetry.enabled') === false;

        this.enabled = !isOptedOut;
    }

    /**
     * Set extension context to check installation
     */
    public setExtensionContext(context: vscode.ExtensionContext): void {
        this.context = context;
        this.checkFirstRun();
        this.showTelemetryNotice();
    }

    /**
     * Check if it's the first run to send installation event
     */
    private checkFirstRun(): void {
        if (!this.enabled || !this.reporter || !this.context) {
            return;
        }
        
        const isInstalled = this.context.globalState.get(this.INSTALL_KEY);
        
        if (!isInstalled) {
            // Send installation event
            this.reporter.sendTelemetryEvent('extension.installed');
            this.context.globalState.update(this.INSTALL_KEY, true);
        }
    }

    /**
     * Show telemetry notification on first run
     */
    private showTelemetryNotice(): void {
        if (!this.context) {
            return;
        }
        
        const noticeShown = this.context.globalState.get(this.TELEMETRY_INFO_KEY);
        
        if (!noticeShown) {
            vscode.window.showInformationMessage(
                'GWT Helper collects anonymous usage data to improve the extension. You can disable this in the settings.',
                'OK', 'Disable'
            ).then(selection => {
                 if (selection === 'Disable') {
                    vscode.workspace.getConfiguration().update(
                        'gwtHelper.telemetry.enabled', 
                        false, 
                        vscode.ConfigurationTarget.Global
                    );
                }
            });
            
            this.context.globalState.update(this.TELEMETRY_INFO_KEY, true);
        }
    }

    /**
     * Record extension activation
     */
    public sendActivationEvent(): void {
        if (this.enabled && this.reporter) {
            this.reporter.sendTelemetryEvent('extension.activated');
        }
    }

    /**
     * Send a telemetry event
     * @param eventName Event name
     * @param properties Optional event properties
     */
    public sendEvent(eventName: string, properties?: { [key: string]: string }): void {
        if (this.enabled && this.reporter) {
            this.reporter.sendTelemetryEvent(eventName, properties);
        }
    }

    /**
     * Release resources when deactivating the extension
     */
    public dispose(): void {
        if (this.reporter) {
            this.reporter.dispose();
            this.reporter = undefined;
        }
    }
}