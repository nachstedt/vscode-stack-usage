import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function createFileSystemWatcher(
  baseDirectory: string,
  pattern: string,
  listener: () => void
): vscode.FileSystemWatcher {
  console.log('Creating watcher: ' + baseDirectory + ' / ' + pattern);
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(baseDirectory, pattern),
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

export function getRealPath(originalPath: string) {
  try {
    return path.resolve(
      path.dirname(originalPath),
      fs.readlinkSync(originalPath)
    );
  } catch (error) {
    if (isError(error)) {
      if (error.code === 'ENOENT') {
        // File does not exist.
        return null;
      } else if (error.code === 'EINVAL') {
        // Files is not a symbolic link.
        return originalPath;
      }
    }
    throw error;
  }
}

function isError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
