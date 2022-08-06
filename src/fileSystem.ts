import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { debug } from './logging';

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
