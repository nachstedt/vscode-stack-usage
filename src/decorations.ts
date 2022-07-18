import * as vscode from 'vscode';

import { StackUsageDb, StackUsageDbEntry } from './stackUsage';

export function makeDecorationType() {
  return vscode.window.createTextEditorDecorationType({
    cursor: 'crosshair',
    backgroundColor: 'darkBlue',
    after: { margin: '10px', color: 'red' }
  });
}

export function setStackUsageDecorationsToVisibleEditors(
  db: StackUsageDb,
  decorationType: vscode.TextEditorDecorationType
) {
  vscode.window.visibleTextEditors.forEach((editor) =>
    setStackUsageDecorationsToEditor(editor, db, decorationType)
  );
}

function setStackUsageDecorationsToEditor(
  editor: vscode.TextEditor,
  db: StackUsageDb,
  decorationType: vscode.TextEditorDecorationType
) {
  if (editor.document.languageId === 'cpp') {
    const entries = db.getDataForFile(editor.document.uri.path);
    const decorations = makeDecorations(entries, editor.document);
    editor.setDecorations(decorationType, decorations);
  }
}

function makeDecorations(
  entries: StackUsageDbEntry[],
  document: vscode.TextDocument
) {
  return entries.map((entry) => {
    const pos = document.lineAt(entry.line - 1).range.end;
    return {
      range: new vscode.Range(pos, pos),
      hoverMessage: entry.functionSignature,
      renderOptions: {
        after: { contentText: entry.numberOfBytes + ' bytes' }
      }
    };
  });
}
