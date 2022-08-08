import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('Stack Usage');

export function info(message: string) {
  outputChannel.appendLine(`${now()} | INFO    | ${message}`);
}

export function debug(message: string) {
  outputChannel.appendLine(`${now()} | DEBUG   | ${message}`);
}

export function warning(message: string) {
  outputChannel.appendLine(`${now()} | WARNING | ${message}`);
}

function now() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}
