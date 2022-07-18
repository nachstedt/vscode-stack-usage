import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { DisposableSlot, DisposableContainer } from './disposables';
import {
  makeDecorationType,
  setStackUsageDecorationsToVisibleEditors
} from './decorations';
import { createFileSystemWatcher } from './fileSystem';
import { StackUsageDb, registerSuFileProcessors } from './stackUsage';

export class WorkspaceHandler {
  #workspaceFolder: vscode.WorkspaceFolder;
  #db: StackUsageDb = new StackUsageDb();
  #compileCommandsWatcher: vscode.FileSystemWatcher;
  #realCompileCommandsWatcher: DisposableSlot = new DisposableSlot();
  #suFileWatchers: DisposableContainer = new DisposableContainer();
  #decorationType: vscode.TextEditorDecorationType = makeDecorationType();

  constructor(workspaceFolder: vscode.WorkspaceFolder) {
    this.#workspaceFolder = workspaceFolder;
    this.#compileCommandsWatcher = createFileSystemWatcher(
      getCompileCommandsPath(workspaceFolder),
      () => this.updateRealCompileCommandsWatcher()
    );
    vscode.window.onDidChangeVisibleTextEditors(() =>
      setStackUsageDecorationsToVisibleEditors(this.#db, this.#decorationType)
    );
  }

  private updateRealCompileCommandsWatcher() {
    const realCompileCommandsPath = getRealCompileCommandsPath(
      this.#workspaceFolder
    );
    if (realCompileCommandsPath !== null) {
      console.log(
        'updating real compile commands path: ' + realCompileCommandsPath
      );
      this.#realCompileCommandsWatcher.set(
        createFileSystemWatcher(realCompileCommandsPath, () =>
          this.updateSuFileWatchers()
        )
      );
    } else {
      console.log('compile_commands.json does not exist');
      this.#realCompileCommandsWatcher.dispose();
      this.#suFileWatchers.dispose();
      this.#db.clear();
      setStackUsageDecorationsToVisibleEditors(this.#db, this.#decorationType);
    }
  }

  private updateSuFileWatchers() {
    const realCompileCommandsPath = getRealCompileCommandsPath(
      this.#workspaceFolder
    );
    console.log('realCompileCommandsPath = ' + realCompileCommandsPath);
    this.#db.clear();
    if (
      realCompileCommandsPath !== null &&
      fs.existsSync(realCompileCommandsPath)
    ) {
      console.log('processing ' + realCompileCommandsPath);
      this.#suFileWatchers.set(
        registerSuFileProcessors(
          realCompileCommandsPath,
          this.#db,
          this.#decorationType
        )
      );
    } else {
      console.error('real compile commands path is not existing!');
    }
    setStackUsageDecorationsToVisibleEditors(this.#db, this.#decorationType);
  }

  dispose() {
    this.#compileCommandsWatcher.dispose();
    this.#realCompileCommandsWatcher?.dispose();
    this.#suFileWatchers.dispose();
  }
}

function getRealCompileCommandsPath(
  workspaceFolder: vscode.WorkspaceFolder
): string | null {
  const compileCommandsPath = getCompileCommandsPath(workspaceFolder);
  try {
    return path.resolve(
      path.dirname(compileCommandsPath),
      fs.readlinkSync(compileCommandsPath)
    );
  } catch (error) {
    if (isError(error)) {
      if (error.code === 'ENOENT') {
        // File does not exist.
        return null;
      } else if (error.code === 'EINVAL') {
        // Files is not a symbolic link.
        return compileCommandsPath;
      }
    }
    throw error;
  }
}

function getCompileCommandsPath(
  workspaceFolder: vscode.WorkspaceFolder
): string {
  return path.join(workspaceFolder.uri.fsPath, 'compile_commands.json');
}

function isError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
