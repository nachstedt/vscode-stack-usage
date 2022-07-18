import * as vscode from 'vscode';

import { WorkspaceHandler } from './workspaceHandler';

export function activate(context: vscode.ExtensionContext) {
  vscode.workspace.workspaceFolders?.forEach((workspaceFolder) => {
    context.subscriptions.push(new WorkspaceHandler(workspaceFolder));
  });
}
