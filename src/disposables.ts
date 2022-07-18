import * as vscode from 'vscode';

export class DisposableContainer {
  #disposables: vscode.Disposable[] = [];
  set(disposables: vscode.Disposable[]) {
    this.dispose();
    this.#disposables = disposables;
  }
  dispose() {
    this.#disposables.forEach((disposable) => disposable.dispose());
    this.#disposables.length = 0;
  }
}

export class DisposableSlot {
  #disposable: vscode.Disposable | null = null;

  set(disposable: vscode.Disposable) {
    this.dispose();
    this.#disposable = disposable;
  }

  dispose() {
    this.#disposable?.dispose();
    this.#disposable = null;
  }
}
