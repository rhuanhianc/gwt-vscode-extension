import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { GwtProjectsStore } from './gwtProjectsStore';

interface ProcessMetrics {
  pid: number;
  cpu: string; // % de CPU (como string para manter formato nativo)
  memory: string; // Memória em KB ou MB (como string para manter formato nativo)
  name: string; // Nome do processo (ex.: "java", "mvn")
}

export class ResourceMonitor {
  private static async getMetricsWindows(pid: number): Promise<ProcessMetrics | null> {
    return new Promise((resolve) => {
      const proc = spawn('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
      let output = '';
      proc.stdout.on('data', (data) => (output += data.toString()));
      proc.on('close', () => {
        const lines = output.trim().split('\n');
        if (lines.length === 0) return resolve(null);
        const [name, pidStr, , memStr] = lines[0].replace(/"/g, '').split(',');
        const memory = memStr.trim(); // Ex.: "123,456 K"

        // CPU no Windows requer wmic ou PowerShell (tasklist não fornece CPU diretamente)
        const cpuProc = spawn('wmic', ['process', 'where', `ProcessId=${pid}`, 'get', 'PercentProcessorTime']);
        let cpuOutput = '';
        cpuProc.stdout.on('data', (data) => (cpuOutput += data.toString()));
        cpuProc.on('close', () => {
          const cpuMatch = cpuOutput.match(/PercentProcessorTime\s+(\d+)/);
          const cpu = cpuMatch ? `${cpuMatch[1]}%` : 'N/A';
          resolve({ pid, cpu, memory, name });
        });
      });
      proc.on('error', () => resolve(null));
    });
  }

  private static async getMetricsUnix(pid: number): Promise<ProcessMetrics | null> {
    return new Promise((resolve) => {
      const proc = spawn('ps', ['-p', pid.toString(), '-o', '%cpu,rss,comm']);
      let output = '';
      proc.stdout.on('data', (data) => (output += data.toString()));
      proc.on('close', () => {
        const lines = output.trim().split('\n');
        if (lines.length < 2) return resolve(null);
        const [cpu, rss, name] = lines[1].trim().split(/\s+/);
        const memory = `${(parseInt(rss) / 1024).toFixed(2)} MB`; // Converte KB para MB
        resolve({ pid, cpu: `${cpu}%`, memory, name });
      });
      proc.on('error', () => resolve(null));
    });
  }

  public static async getProcessMetrics(pid: number): Promise<ProcessMetrics | null> {
    return process.platform === 'win32'
      ? this.getMetricsWindows(pid)
      : this.getMetricsUnix(pid);
  }

  public static async monitorAllProcesses(): Promise<ProcessMetrics[]> {
    const store = GwtProjectsStore.getInstance();
    const processes = store.getAllProcesses();
    const metricsPromises = processes
      .filter((proc) => proc.pid !== undefined)
      .map((proc) => this.getProcessMetrics(proc.pid!));
    const results = await Promise.all(metricsPromises);
    return results.filter((m): m is ProcessMetrics => m !== null);
  }
}