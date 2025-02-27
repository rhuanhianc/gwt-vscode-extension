import * as vscode from 'vscode';
import { LogPseudoterminal } from './LogPseudoterminal';

// Mapa para armazenar terminais por chave
const terminals: { [key: string]: { terminal: vscode.Terminal, pty: LogPseudoterminal } } = {};

// Função para remover o terminal do mapa quando ele for fechado
function registerTerminalCloseListener(key: string, terminal: vscode.Terminal) {
  vscode.window.onDidCloseTerminal((closedTerminal) => {
    if (closedTerminal === terminal) {
      delete terminals[key];
    }
  });
}

export function getLogTerminal(key: string) {
  if (!terminals[key]) {
    const pty = new LogPseudoterminal();
    const terminal = vscode.window.createTerminal({ name: `GWT Logs Terminal (${key})`, pty });
    terminals[key] = { terminal, pty };
    registerTerminalCloseListener(key, terminal);
  }
  return terminals[key];
}

export function logInfo(key: string, message: string) {
  //  formatação ANSI para [INFO] em verde
  const infoColored = `\x1b[32m[INFO]\x1b[0m`;
  const messageColored = message.replace(/\[INFO\]/g, infoColored);
  const { pty } = getLogTerminal(key);
  pty.appendLine(messageColored);
}

export function logError(key: string, message: string) {
  //  formatação ANSI para [ERROR] em vermelho
  const errorColored = `\x1b[31m[ERROR]\x1b[0m`;
  const formatted = `${errorColored} ${message}`;
  const { pty } = getLogTerminal(key);
  pty.appendLine(formatted);
}

export function showLogs(key: string) {
  vscode.window.showInformationMessage(`Mostrando logs para ${key}...`);
  const { terminal } = getLogTerminal(key);
  terminal.show(true);
}

export function disposeAllTerminals() {
  for (const key in terminals) {
    terminals[key].terminal.dispose();
  }
}

export function disposeTerminal(key: string) {
  if (terminals[key]) {
    terminals[key].terminal.dispose();
  }
}