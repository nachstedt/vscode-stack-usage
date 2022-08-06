import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { createFileSystemWatcher } from './fileSystem';
import { log } from './logging';
import { setStackUsageDecorationsToVisibleEditors } from './decorations';

export class StackUsageDb {
  #data: StackUsageDbEntry[] = [];

  addFromFile(entries: SuFileEntry[], source: string): string[] {
    const affectedFiles = [
      ...new Set(
        this.#data
          .filter((entry) => entry.source === source)
          .map((entry) => entry.path)
          .concat(entries.map((entry) => entry.path))
      )
    ];
    this.#data = this.#data.filter((entry) => entry.source !== source);
    entries.forEach((entry) => this.#data.push({ source: source, ...entry }));
    return affectedFiles;
  }

  clear() {
    this.#data = [];
  }

  getDataForFile(path: string): StackUsageDbEntry[] {
    return this.#data.filter((entry) => entry.path === path);
  }

  length() {
    return this.#data.length;
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
  const numEntries = compileCommands.length;
  compileCommands.forEach((entry, index) => {
    const relativeSuFileName = getRelativeSuFileName(entry);
    log(`Processing entry ${index + 1}/${numEntries}:`);
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
  const entries = readSuFile(suFileName);
  const affectedFiles = db.addFromFile(entries, sourceName);
  setStackUsageDecorationsToVisibleEditors(db, decorationType, affectedFiles);
}

function readSuFile(path: string): SuFileEntry[] {
  log(`Reading  ${path}`);
  const functionIdRegex =
    /(?<path>.*):(?<line>\d*):(?<column>\d*):(?<signature>.*)/;

  try {
    return fs
      .readFileSync(path, 'utf8')
      .split('\n')
      .map((line: string) => line.split('\t'))
      .filter((parts: string[]) => parts.length === 3)
      .map((parts: string[]) => {
        const result = functionIdRegex.exec(parts[0]);
        if (result === null || result.groups === undefined) {
          throw Error('functionIdRegex failed');
        }
        return {
          path: fs.realpathSync(result.groups.path),
          line: +result.groups.line,
          col: +result.groups.column,
          functionSignature: result.groups.signature,
          numberOfBytes: +parts[1],
          qualifiers: parts[2]
            .split(',')
            .map(
              (qualifierString) =>
                Qualifier[qualifierString as keyof typeof Qualifier]
            )
        };
      });
  } catch (err) {
    log(`reading ${path} failed`);
    return [];
  }
}
