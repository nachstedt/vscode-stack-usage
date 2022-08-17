import * as path from 'path';
import * as vscode from 'vscode';

import { DisposableContainer, DisposableSlot } from './disposables';
import { StackUsageDb, registerSuFileProcessors } from './stackUsage';
import { createFileSystemWatcher, getRealPath } from './fileSystem';
import {
  makeDecorationType,
  setStackUsageDecorationsToEditor,
  setStackUsageDecorationsToVisibleEditors
} from './decorations';
import { info } from './logging';

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
    let visibles: vscode.TextEditor[] = [...vscode.window.visibleTextEditors];
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      editors.forEach((editor) => {
        if (!visibles.includes(editor)) {
          setStackUsageDecorationsToEditor(
            editor,
            this.#db,
            this.#decorationType
          );
        }
      });
      visibles = [...editors];
    });
  }

  private async updateRealCompileCommandsWatcher() {
    const realCompileCommandsPath = await getRealCompileCommandsPath(
      this.#workspaceFolder
    );
    if (realCompileCommandsPath !== null) {
      this.#realCompileCommandsWatcher.set(
        createFileSystemWatcher(
          path.dirname(realCompileCommandsPath),
          path.basename(realCompileCommandsPath),
          () => this.updateSuFileWatchers(realCompileCommandsPath)
        )
      );
    } else {
      info('compile_commands.json does not exist');
      this.#realCompileCommandsWatcher.dispose();
      this.#suFileWatchers.dispose();
      this.#db.clear();
      setStackUsageDecorationsToVisibleEditors(this.#db, this.#decorationType);
    }
  }

  private async updateSuFileWatchers(realCompileCommandsPath: string) {
    this.#db.clear();
    info(`Reading .su files from ${realCompileCommandsPath}`);
    this.#suFileWatchers.set(
      await registerSuFileProcessors(
        realCompileCommandsPath,
        this.#db,
        this.#decorationType
      )
    );
  }

  dispose() {
    this.#compileCommandsWatcher.dispose();
    this.#realCompileCommandsWatcher?.dispose();
    this.#suFileWatchers.dispose();
  }
}

async function getRealCompileCommandsPath(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<string | null> {
  return getRealPath(getCompileCommandsPath(workspaceFolder));
}

function getCompileCommandsPath(
  workspaceFolder: vscode.WorkspaceFolder
): string {
  return path.join(workspaceFolder.uri.fsPath, 'compile_commands.json');
}
