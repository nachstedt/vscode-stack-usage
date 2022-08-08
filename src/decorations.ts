import * as fs from 'fs';
import * as vscode from 'vscode';

import { StackUsageDb, StackUsageDbEntry } from './stackUsage';
import { info } from './logging';

export function makeDecorationType() {
  return vscode.window.createTextEditorDecorationType({
    cursor: 'crosshair',
    backgroundColor: 'darkBlue',
    after: { margin: '10px', color: 'red' }
  });
}

export function setStackUsageDecorationsToVisibleEditors(
  db: StackUsageDb,
  decorationType: vscode.TextEditorDecorationType,
  changedFiles?: string[]
) {
  vscode.window.visibleTextEditors.forEach((editor) => {
    setStackUsageDecorationsToEditor(editor, db, decorationType, changedFiles);
  });
}

export function setStackUsageDecorationsToEditor(
  editor: vscode.TextEditor,
  db: StackUsageDb,
  decorationType: vscode.TextEditorDecorationType,
  changedFiles?: string[]
) {
  if (editor.document.languageId !== 'cpp') {
    return;
  }
  const docPath = fs.realpathSync(editor.document.uri.path);
  if (changedFiles !== undefined && !changedFiles.includes(docPath)) {
    return;
  }
  const entries = db.getDataForFile(docPath);
  const numEntries = entries.length;
  info(`Decorating ${docPath}: ${numEntries} (total: ${db.length()})`);
  const decorations = makeDecorations(entries, editor.document);
  editor.setDecorations(decorationType, decorations);
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
