import * as vscode from 'vscode';

export function createFileSystemWatcher(
  path: string,
  listener: () => void
): vscode.FileSystemWatcher {
  console.log('Creating file system watcher for ' + path);
  const watcher = vscode.workspace.createFileSystemWatcher(
    path,
    false,
    false,
    false
  );
  watcher.onDidChange(listener);
  watcher.onDidCreate(listener);
  watcher.onDidDelete(listener);
  listener();
  return watcher;
}
