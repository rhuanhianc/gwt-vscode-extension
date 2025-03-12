import { ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';

/**
 * Estatísticas de processo
 */
export interface ProcessStats {
    pid: number;
    type: 'devmode' | 'codeserver' | 'jetty' | 'compile';
    pomPath: string;
    projectName: string;
    startTime: Date;
    endTime?: Date;
    cpuUsage?: number;
    memoryUsage?: number;
    durationMs?: number;
    status: 'running' | 'completed' | 'failed';
    exitCode?: number;
    importantLogs: string[];
}

/**
 * Helper para rastreamento simples de estatísticas de processo
 */
export class ProcessStatsHelper {
    private static instance: ProcessStatsHelper;
    private processMap = new Map<number, ProcessStats>();
    private compileTimes: number[] = [];
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadStats();
    }

    /**
     * Obtém a instância singleton
     */
    public static getInstance(context?: vscode.ExtensionContext): ProcessStatsHelper {
        if (!ProcessStatsHelper.instance) {
            if (!context) {
                throw new Error('Context required for first initialization');
            }
            ProcessStatsHelper.instance = new ProcessStatsHelper(context);
        }
        return ProcessStatsHelper.instance;
    }

    /**
     * Carrega estatísticas salvas do armazenamento
     */
    private loadStats() {
        const savedCompileTimes = this.context.workspaceState.get<number[]>('gwtHelper.compileTimes');
        if (savedCompileTimes) {
            this.compileTimes = savedCompileTimes;
        }
    }

    /**
     * Salva estatísticas no armazenamento
     */
    private saveStats() {
        // Manter apenas os últimos 20 tempos de compilação
        if (this.compileTimes.length > 20) {
            this.compileTimes = this.compileTimes.slice(-20);
        }
        this.context.workspaceState.update('gwtHelper.compileTimes', this.compileTimes);
    }

    /**
     * Inicia o rastreamento de um processo
     */
    public trackProcess(process: ChildProcess, type: 'devmode' | 'codeserver' | 'jetty' | 'compile', pomPath: string): ProcessStats | undefined {
        if (!process.pid) return undefined;

        const projectName = path.basename(path.dirname(pomPath));
        
        const stats: ProcessStats = {
            pid: process.pid,
            type,
            pomPath,
            projectName,
            startTime: new Date(),
            status: 'running',
            importantLogs: []
        };

        this.processMap.set(process.pid, stats);
        
        // Capturar logs importantes
        process.stdout?.on('data', (data) => {
            const text = data.toString();
            if (this.isImportantLog(text, type)) {
                stats.importantLogs.push(text.trim());
                // Limitar a quantidade de logs
                if (stats.importantLogs.length > 10) {
                    stats.importantLogs.shift();
                }
            }
        });

        // Rastrear quando o processo termina
        process.on('exit', (code) => {
            stats.endTime = new Date();
            stats.status = code === 0 ? 'completed' : 'failed';
            stats.exitCode = code ?? undefined;
            stats.durationMs = stats.endTime.getTime() - stats.startTime.getTime();
            
            // Armazenar tempo de compilação para estatísticas
            if (type === 'compile' && code === 0 && stats.durationMs) {
                this.compileTimes.push(stats.durationMs);
                this.saveStats();
            }
        });

        return stats;
    }

    /**
     * Verifica se um log é importante para capturar
     */
    private isImportantLog(text: string, type: 'devmode' | 'codeserver' | 'jetty' | 'compile'): boolean {
        const importantPatterns = [
            'Compiling module',
            'Compilation succeeded',
            'Compilation failed',
            'The code server is ready',
            'Starting Jetty',
            'Started ServerConnector',
            'Super Dev Mode started',
            'Listening for transport dt_socket',
            'Starting GWT Compiler'
        ];
        
        return importantPatterns.some(pattern => text.includes(pattern));
    }

    /**
     * Obtém estatísticas de um processo específico
     */
    public getProcessStats(pid: number): ProcessStats | undefined {
        return this.processMap.get(pid);
    }

    /**
     * Obtém todas as estatísticas de processos
     */
    public getAllProcessStats(): ProcessStats[] {
        return Array.from(this.processMap.values());
    }

    /**
     * Obtém a média de tempo de compilação
     */
    public getAverageCompileTime(): number {
        if (this.compileTimes.length === 0) return 0;
        return this.compileTimes.reduce((a, b) => a + b, 0) / this.compileTimes.length;
    }

    /**
     * Obtém o último tempo de compilação
     */
    public getLastCompileTime(): number | undefined {
        if (this.compileTimes.length === 0) return undefined;
        return this.compileTimes[this.compileTimes.length - 1];
    }
}

/**
 * Formata um tempo em ms para legibilidade humana
 */
export function formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}