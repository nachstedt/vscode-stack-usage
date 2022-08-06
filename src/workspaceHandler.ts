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
import { log } from './logging';

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
      workspaceFolder.uri.fsPath,
      'compile_commands.json',
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
      this.#realCompileCommandsWatcher.set(
        createFileSystemWatcher(
          path.dirname(realCompileCommandsPath),
          path.basename(realCompileCommandsPath),
          () => this.updateSuFileWatchers()
        )
      );
    } else {
      log('compile_commands.json does not exist');
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
    this.#db.clear();
    if (
      realCompileCommandsPath !== null &&
      fs.existsSync(realCompileCommandsPath)
    ) {
      log(`Reading .su files from ${realCompileCommandsPath}`);
      this.#suFileWatchers.set(
        registerSuFileProcessors(
          realCompileCommandsPath,
          this.#db,
          this.#decorationType
        )
      );
    } else {
      log(`Not existing: ${realCompileCommandsPath}`);
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
