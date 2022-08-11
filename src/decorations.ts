import * as fs from 'fs';
import * as path from 'path';
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
  if (!documentNeedsUpdate(editor.document, changedFiles)) {
    return;
  }
  const entries = getEntriesForDocument(db, editor.document);
  const docPath = editor.document.uri.path;
  info(`Decorating ${docPath}: ${entries.length} (total: ${db.length()})`);
  const decorations = makeDecorations(entries, editor.document);
  editor.setDecorations(decorationType, decorations);
}

function documentNeedsUpdate(
  document: vscode.TextDocument,
  changedFiles?: string[]
): boolean {
  const docPath = fs.realpathSync(document.uri.path);
  const docFileName = path.basename(docPath);
  info('changed files: ' + changedFiles);
  return (
    changedFiles === undefined ||
    changedFiles.includes(docPath) ||
    changedFiles.includes(docFileName)
  );
}

function getEntriesForDocument(
  db: StackUsageDb,
  document: vscode.TextDocument
) {
  const docPath = fs.realpathSync(document.uri.path);
  const entries = db.getDataForFile(docPath);
  const docFileName = path.basename(docPath);
  const maybeEntries = db.getDataForFile(docFileName);
  entries.push(...verifyEntries(maybeEntries, document));
  return entries;
}

function verifyEntries(
  candidates: StackUsageDbEntry[],
  document: vscode.TextDocument
): StackUsageDbEntry[] {
  return candidates.filter((entry) => entryFitsToDocument(entry, document));
}

function entryFitsToDocument(
  entry: StackUsageDbEntry,
  document: vscode.TextDocument
) {
  const functionName = extractNameFromSignature(entry.functionSignature);
  if (document.lineCount <= entry.line - 1) {
    return false;
  }
  return document.lineAt(entry.line - 1).text.includes(functionName);
}

function extractNameFromSignature(functionSignature: string): string {
  const firstBracket = functionSignature.indexOf('(');
  const partBeforeBracket = functionSignature.slice(0, firstBracket);
  const firstSpace = partBeforeBracket.indexOf(' ');
  const lastColon = partBeforeBracket.lastIndexOf(':');
  const nameStart = (firstSpace > lastColon ? firstSpace : lastColon) + 1;
  return partBeforeBracket.slice(nameStart);
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
