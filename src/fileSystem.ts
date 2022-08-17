import * as path from 'path';
import * as vscode from 'vscode';
import { debug } from './logging';
import { promises as fs } from 'fs';

export function createFileSystemWatcher(
  baseDirectory: string,
  pattern: string,
  listener: () => void
): vscode.FileSystemWatcher {
  debug(`Creating watcher: ${baseDirectory}/${pattern}`);
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(baseDirectory, pattern),
    false,
    false,
    false
  );
  watcher.onDidChange(() => {
    debug(`changed: ${baseDirectory}/${pattern}`);
    listener();
  });
  watcher.onDidCreate(() => {
    debug(`created: ${baseDirectory}/${pattern}`);
    listener();
  });
  watcher.onDidDelete(() => {
    debug(`deleted: ${baseDirectory}/${pattern}`);
    listener();
  });
  listener();
  return watcher;
}

export async function getRealPath(originalPath: string) {
  try {
    const linkedPath = await fs.readlink(originalPath);
    return path.resolve(path.dirname(originalPath), linkedPath);
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
