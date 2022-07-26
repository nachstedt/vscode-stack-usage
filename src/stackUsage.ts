import * as path from 'path';
import * as vscode from 'vscode';
import { debug, info, warning } from './logging';
import { createFileSystemWatcher } from './fileSystem';
import { promises as fs } from 'fs';
import { setStackUsageDecorationsToVisibleEditors } from './decorations';

export class StackUsageDb {
  #data: StackUsageDbEntry[] = [];

  addFromFile(entries: SuFileEntry[], source: string): string[] {
    const affectedFiles = getFilesAffectedByUpdate(this.#data, entries, source);
    this.#data = removeBySource(this.#data, source);
    addInPlace(this.#data, entries, source);
    return affectedFiles;
  }

  clear() {
    this.#data = [];
  }

  getDataForFile(path: string): StackUsageDbEntry[] {
    return filterByPath(this.#data, path);
  }

  length() {
    return this.#data.length;
  }
}

function getFilesAffectedByUpdate(
  dbData: StackUsageDbEntry[],
  newEntries: SuFileEntry[],
  source: string
): string[] {
  const oldFiles = getPathsForSource(dbData, source);
  const newFiles = getPaths(newEntries);
  const allFiles = convertToList(makeUnion(oldFiles, newFiles));
  return allFiles;
}

function convertToList(set: Set<string>) {
  return [...set];
}

function makeUnion(lhs: Set<string>, rhs: Set<string>) {
  return new Set([...lhs, ...rhs]);
}

function getPathsForSource(entries: StackUsageDbEntry[], source: string) {
  return getPaths(filterBySource(entries, source));
}

function getPaths(entries: StackUsageDbEntry[] | SuFileEntry[]) {
  return new Set(entries.map((entry) => entry.path));
}
function filterBySource(
  entries: StackUsageDbEntry[],
  source: string
): StackUsageDbEntry[] {
  return entries.filter((entry) => entry.source === source);
}

function removeBySource(entries: StackUsageDbEntry[], source: string) {
  return entries.filter((entry) => entry.source !== source);
}

function addInPlace(
  dbEntries: StackUsageDbEntry[],
  newEntries: SuFileEntry[],
  source: string
) {
  newEntries.forEach((entry) => dbEntries.push({ source: source, ...entry }));
}

function filterByPath(
  entries: StackUsageDbEntry[],
  path: string
): StackUsageDbEntry[] {
  return entries.filter((entry) => entry.path === path);
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

export async function registerSuFileProcessors(
  compileCommandsPath: string,
  db: StackUsageDb,
  decorationType: vscode.TextEditorDecorationType
): Promise<vscode.Disposable[]> {
  try {
    const compileCommands = await readCompileCommandsFromFile(
      compileCommandsPath
    );
    return createSuFileWatchers(compileCommands, db, decorationType);
  } catch (error) {
    warning(`Reading failed: ${compileCommandsPath}`);
    return [];
  }
}

async function readCompileCommandsFromFile(
  path: string
): Promise<CompileCommand[]> {
  const rawdata = await fs.readFile(path, 'utf-8');
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

function createSuFileWatchers(
  compileCommands: CompileCommand[],
  db: StackUsageDb,
  decorationType: vscode.TextEditorDecorationType
) {
  const watchers: vscode.Disposable[] = [];
  const numEntries = compileCommands.length;
  compileCommands.forEach((entry, index) => {
    info(`Processing entry ${index + 1}/${numEntries}:`);
    const watcher = createSuFileWatcher(entry, db, decorationType);
    if (watcher !== null) {
      watchers.push(watcher);
    }
  });
  return watchers;
}

function createSuFileWatcher(
  entry: CompileCommand,
  db: StackUsageDb,
  decorationType: vscode.TextEditorDecorationType
) {
  const relativeSuFileName = getRelativeSuFileName(entry);
  if (relativeSuFileName === null) {
    return null;
  }
  return createFileSystemWatcher(entry.directory, relativeSuFileName, () =>
    processSuFile(
      path.join(entry.directory, relativeSuFileName),
      entry.file,
      db,
      decorationType
    )
  );
}

async function processSuFile(
  suFileName: string,
  sourceName: string,
  db: StackUsageDb,
  decorationType: vscode.TextEditorDecorationType
) {
  const entries = await readSuFile(suFileName);
  fixIncompleteCppPaths(entries, sourceName);
  const affectedFiles = db.addFromFile(entries, sourceName);
  debug('Affected files: ' + affectedFiles);
  setStackUsageDecorationsToVisibleEditors(db, decorationType, affectedFiles);
}

async function readSuFile(path: string): Promise<SuFileEntry[]> {
  info(`Reading  ${path}`);
  try {
    const fileContent = await fs.readFile(path, 'utf8');
    const lines = fileContent.split('\n');
    debug(`Lines to process: ${lines.length}`);
    const entries = await Promise.all(lines.map(readSuFileLine));
    debug('All lines processed.');
    return removeNullEntries(entries);
  } catch (error) {
    warning(`Could not read ${path}: ${error}`);
    return [];
  }
}

async function readSuFileLine(line: string): Promise<SuFileEntry | null> {
  debug(`Reading line: "${line}"`);
  line = line.trim();
  if (line.length === 0) {
    debug('-> lines is empty');
    return null;
  }
  const parts = line.split('\t');
  if (parts.length !== 3) {
    warning(`malformed entry: ${line}`);
    return null;
  }
  const functionId = parseFunctionId(parts[0]);
  debug(`-> function id: ${JSON.stringify(functionId)}`);
  const numberOfBytes = +parts[1];
  debug(`-> number of bytes: ${numberOfBytes}`);
  const qualifiers = extractQualifiers(parts[2]);
  debug(`-> qualifiers: ${qualifiers}`);
  if (functionId === null) {
    warning(`function id parsing failed: ${parts[0]}`);
    return null;
  }
  functionId.path = await makeRealIfPath(functionId.path);
  debug(`-> real path: ${functionId.path}`);
  return makeSuFileEntry(functionId, numberOfBytes, qualifiers);
}

function makeRealIfPath(filePath: string) {
  if (filePath.includes(path.sep)) {
    return fs.realpath(filePath);
  }
  return filePath;
}

interface FunctionId {
  path: string;
  line: number;
  column: number;
  signature: string;
}

function parseFunctionId(functionIdString: string): FunctionId | null {
  const functionIdRegex =
    /(?<path>.*):(?<line>\d*):(?<column>\d*):(?<signature>.*)/;
  const result = functionIdRegex.exec(functionIdString);
  if (result === null || result.groups === undefined) {
    return null;
  }
  return {
    path: result.groups.path,
    line: +result.groups.line,
    column: +result.groups.column,
    signature: result.groups.signature
  };
}

function extractQualifiers(qualifierStringList: string) {
  const singleStrings = qualifierStringList.split(',');
  return singleStrings.map(convertToQualifier);
}

function convertToQualifier(qualifierString: string) {
  return Qualifier[qualifierString as keyof typeof Qualifier];
}

function makeSuFileEntry(
  functionId: FunctionId,
  numberOfBytes: number,
  qualifiers: Qualifier[]
) {
  return {
    path: functionId.path,
    line: functionId.line,
    col: functionId.column,
    functionSignature: functionId.signature,
    numberOfBytes: numberOfBytes,
    qualifiers: qualifiers
  };
}

function removeNullEntries(entries: (SuFileEntry | null)[]): SuFileEntry[] {
  const filteredEntries: SuFileEntry[] = [];
  for (const entry of entries) {
    if (entry !== null) {
      filteredEntries.push(entry);
    }
  }
  return filteredEntries;
}

function fixIncompleteCppPaths(entries: SuFileEntry[], replacePath: string) {
  entries.forEach((entry) => {
    if (entry.path.endsWith('cpp') && !entry.path.includes(path.sep)) {
      entry.path = replacePath;
      debug(`fixed incomplete cpp path: ${JSON.stringify(entry)}`);
    }
  });
}
