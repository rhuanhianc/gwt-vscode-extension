import * as vscode from 'vscode';

export class LogPseudoterminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    // Inicialização.
  }

  close(): void {
    // Limpeza.
  }

  public appendLine(line: string) {
    // Verificar se é necessário tratar \n
    if (line.endsWith("\n")) {
      line = line.substring(0, line.length - 1);
    }
    if (line.endsWith("\r")) {
      line = line.substring(0, line.length - 1);
    }
    if (line.length === 0) {
      return;
    }
    this.writeEmitter.fire(line + "\r\n");
  }

  public write(text: string) {
    this.writeEmitter.fire(text);
  }
}
