import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { createFileSystemWatcher } from './fileSystem';
import { setStackUsageDecorationsToVisibleEditors } from './decorations';

export class StackUsageDb {
  #data: StackUsageDbEntry[] = [];

  addFromFile(entries: SuFileEntry[], source: string) {
    this.#data = this.#data.filter((entry) => entry.source !== source);
    entries.forEach((entry) => this.#data.push({ source: source, ...entry }));
  }

  clear() {
    this.#data = [];
  }

  getDataForFile(path: string): StackUsageDbEntry[] {
    return this.#data.filter((entry) => entry.path === path);
  }
}

export interface StackUsageDbEntry extends SuFileEntry {
  source: string;
}

interface SuFileEntry {
  path: string;
  line: number;
  col: number;
  functionSignature: string;
  numberOfBytes: number;
  qualifiers: Qualifier[];
}

enum Qualifier {
  static = 'static',
  dynamic = 'dynamic',
  bounded = 'bounded'
}

export function registerSuFileProcessors(
  compileCommandsPath: string,
  db: StackUsageDb,
  decorationType: vscode.TextEditorDecorationType
): vscode.Disposable[] {
  const compileCommands = readCompileCommandsFromFile(compileCommandsPath);
  const watchers: vscode.Disposable[] = [];
  compileCommands.forEach((entry) => {
    const relativeSuFileName = getRelativeSuFileName(entry);
    if (relativeSuFileName !== null) {
      watchers.push(
        createFileSystemWatcher(entry.directory, relativeSuFileName, () =>
          processSuFile(
            path.join(entry.directory, relativeSuFileName),
            entry.file,
            db,
            decorationType
          )
        )
      );
    }
  });
  return watchers;
}

function readCompileCommandsFromFile(path: string): CompileCommand[] {
  const rawdata = fs.readFileSync(path, 'utf-8');
  const data: CompileCommand[] = JSON.parse(rawdata);
  return data;
}

interface CompileCommand {
  directory: string;
  command: string;
  file: string;
}

function getRelativeSuFileName(compileCommand: CompileCommand): string | null {
  const outputNameRegex = /.+-o (.+)\.o.+/;
  const match = outputNameRegex.exec(compileCommand.command);
  if (match === null) {
    return null;
  }
  const outputName = match[1];
  return outputName + '.su';
}

function processSuFile(
  suFileName: string,
  sourceName: string,
  db: StackUsageDb,
  decorationType: vscode.TextEditorDecorationType
) {
  db.addFromFile(readSuFile(suFileName), sourceName);
  setStackUsageDecorationsToVisibleEditors(db, decorationType);
}

function readSuFile(path: string): SuFileEntry[] {
  console.log('reading su file: ' + path);
  return fs
    .readFileSync(path, 'utf8')
    .split('\n')
    .map((line: string) => line.split('\t'))
    .filter((parts: string[]) => parts.length === 3)
    .map((parts: string[]) => {
      const functionId = parts[0].split(':');
      return {
        path: fs.realpathSync(functionId[0]),
        line: +functionId[1],
        col: +functionId[2],
        functionSignature: functionId[3],
        numberOfBytes: +parts[1],
        qualifiers: parts[2]
          .split(',')
          .map(
            (qualifierString) =>
              Qualifier[qualifierString as keyof typeof Qualifier]
          )
      };
    });
}
