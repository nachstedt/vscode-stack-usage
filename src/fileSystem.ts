import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
