import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { DisposableContainer, DisposableSlot } from './disposables';
import { StackUsageDb, registerSuFileProcessors } from './stackUsage';
import { createFileSystemWatcher, getRealPath } from './fileSystem';
import {
  makeDecorationType,
  setStackUsageDecorationsToVisibleEditors
} from './decorations';

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
  return getRealPath(getCompileCommandsPath(workspaceFolder));
}

function getCompileCommandsPath(
  workspaceFolder: vscode.WorkspaceFolder
): string {
  return path.join(workspaceFolder.uri.fsPath, 'compile_commands.json');
}
