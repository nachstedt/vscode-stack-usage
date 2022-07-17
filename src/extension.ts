// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	vscode.workspace.workspaceFolders?.forEach(workspaceFolder => {
		context.subscriptions.push(new WorkspaceHandler(workspaceFolder));
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }

class WorkspaceHandler {
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
			() => this.updateRealCompileCommandsWatcher());
		vscode.window.onDidChangeVisibleTextEditors(
			() => setStackUsageDecorationsToVisibleEditors(this.#db, this.#decorationType));
	}

	private updateRealCompileCommandsWatcher() {
		const realCompileCommandsPath = getRealCompileCommandsPath(this.#workspaceFolder);
		if (realCompileCommandsPath !== null) {
			console.log("updating real compile commands path: " + realCompileCommandsPath);
			this.#realCompileCommandsWatcher.set(createFileSystemWatcher(
				realCompileCommandsPath, () => this.updateSuFileWatchers()
			));
		} else {
			console.log("compile_commands.json does not exist");
			this.#realCompileCommandsWatcher.dispose();
			this.#suFileWatchers.dispose();
			this.#db.clear();
			setStackUsageDecorationsToVisibleEditors(this.#db, this.#decorationType);
		}
	}

	private updateSuFileWatchers() {
		const realCompileCommandsPath = getRealCompileCommandsPath(this.#workspaceFolder);
		console.log("realCompileCommandsPath = " + realCompileCommandsPath);
		this.#db.clear();
		if (realCompileCommandsPath !== null && fs.existsSync(realCompileCommandsPath)) {
			console.log("processing " + realCompileCommandsPath);
			this.#suFileWatchers.set(registerSuFileWatchers(realCompileCommandsPath, this.#db, this.#decorationType));
		} else {
			console.error("real compile commands path is not existing!");
		}
		setStackUsageDecorationsToVisibleEditors(this.#db, this.#decorationType);
	}

	dispose() {
		this.#compileCommandsWatcher.dispose();
		this.#realCompileCommandsWatcher?.dispose();
		this.#suFileWatchers.dispose();
	}
}

class StackUsageDb {
	#data: StackUsageDbEntry[] = [];

	addFromFile(entries: SuFileEntry[], source: string) {
		this.#data = this.#data.filter(entry => entry.source !== source);
		entries.forEach(entry => this.#data.push({ source: source, ...entry }));
	}

	clear() {
		this.#data = [];
	}

	getDataForFile(path: string): StackUsageDbEntry[] {
		return this.#data.filter(entry => entry.path === path);
	}
}
interface StackUsageDbEntry extends SuFileEntry {
	source: string;
}

interface SuFileEntry {
	path: string;
	line: number;
	col: number;
	functionSignature: string;
	numberOfBytes: number;
	qualifiers: Qualifier[];
};

enum Qualifier {
	static = "static",
	dynamic = "dynamic",
	bounded = "bounded"
}

interface CompileCommand {
	directory: string;
	command: string;
	file: string
}

class DisposableContainer {
	#disposables: vscode.Disposable[] = [];
	set(disposables: vscode.Disposable[]) {
		this.dispose();
		this.#disposables = disposables;
	}
	dispose() {
		this.#disposables.forEach(disposable => disposable.dispose());
		this.#disposables.length = 0;
	}
}

class DisposableSlot {
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

function makeDecorationType() {
	return vscode.window.createTextEditorDecorationType({
		cursor: 'crosshair',
		backgroundColor: "darkBlue",
		after: { margin: "10px", color: "red" }
	});
}

function registerSuFileWatchers(filePath: string, db: StackUsageDb, decorationType: vscode.TextEditorDecorationType): vscode.Disposable[] {
	let watchers: vscode.Disposable[] = [];
	readCompileCommandsFromFile(filePath).forEach((entry) => {
		const suFileName = getSuFileName(entry);
		if (suFileName !== null) {
			watchers.push(createFileSystemWatcher(suFileName, () => processSuFile(suFileName, entry.file, db, decorationType)));
		}
	});
	return watchers;
}

function readCompileCommandsFromFile(path: string): CompileCommand[] {
	const rawdata = fs.readFileSync(path, 'utf-8');
	const data: CompileCommand[] = JSON.parse(rawdata);
	return data;
}

function getSuFileName(compileCommand: CompileCommand): string | null {
	const outputNameRegex = /.+-o (.+)\.o.+/;
	const match = outputNameRegex.exec(compileCommand.command)!;
	const outputName = match[1];
	const suFileName = path.join(compileCommand.directory, outputName) + '.su';
	return suFileName;
}

function processSuFile(suFileName: string, sourceName: string, db: StackUsageDb, decorationType: vscode.TextEditorDecorationType) {
	db.addFromFile(readSuFile(suFileName), sourceName);
	setStackUsageDecorationsToVisibleEditors(db, decorationType);
}

function readSuFile(path: string): SuFileEntry[] {
	console.log("reading su file: " + path);
	return fs.readFileSync(path, 'utf8')
		.split("\n")
		.map((line: string) => line.split("\t"))
		.filter((parts: string[]) => (parts.length === 3))
		.map(
			(parts: string[]) => {
				const functionId = parts[0].split(":");
				return {
					path: functionId[0],
					line: +functionId[1],
					col: +functionId[2],
					functionSignature: functionId[3],
					numberOfBytes: +parts[1],
					qualifiers: parts[2].split(",").map(qualifierString => Qualifier[qualifierString as keyof typeof Qualifier])
				};
			});
}

function setStackUsageDecorationsToVisibleEditors(db: StackUsageDb, decorationType: vscode.TextEditorDecorationType) {
	vscode.window.visibleTextEditors.forEach(editor => setStackUsageDecorationsToEditor(editor, db, decorationType));
}

function setStackUsageDecorationsToEditor(editor: vscode.TextEditor, db: StackUsageDb, decorationType: vscode.TextEditorDecorationType) {
	if (editor.document.languageId === "cpp") {
		const entries = db.getDataForFile(editor.document.uri.path);
		const decorations = makeDecorations(entries, editor.document);
		editor.setDecorations(decorationType, decorations);
	}
}

function makeDecorations(entries: StackUsageDbEntry[], document: vscode.TextDocument) {
	return entries.map((entry: SuFileEntry) => {
		const pos = document.lineAt(entry.line - 1).range.end;
		return {
			range: new vscode.Range(pos, pos),
			hoverMessage: entry.functionSignature,
			renderOptions: {
				after: { contentText: entry.numberOfBytes + " bytes" },
			}
		};
	});
}

function createFileSystemWatcher(path: string, listener: () => void): vscode.FileSystemWatcher {
	console.log("Creating file system watcher for " + path);
	let watcher = vscode.workspace.createFileSystemWatcher(path, false, false, false);
	watcher.onDidChange(listener);
	watcher.onDidCreate(listener);
	watcher.onDidDelete(listener);
	listener();
	return watcher;
}

function getRealCompileCommandsPath(workspaceFolder: vscode.WorkspaceFolder): string | null {
	const compileCommandsPath = getCompileCommandsPath(workspaceFolder);
	try {
		return path.resolve(path.dirname(compileCommandsPath), fs.readlinkSync(compileCommandsPath));
	} catch (error) {
		if (isError(error)) {
			if (error.code === "ENOENT") {
				// File does not exist.
				return null;
			} else if (error.code === "EINVAL") {
				// Files is not a symbolic link.
				return compileCommandsPath;
			}
		}
		throw (error);
	}
}

function getCompileCommandsPath(workspaceFolder: vscode.WorkspaceFolder): string {
	return path.join(workspaceFolder.uri.fsPath, "compile_commands.json");
}

function isError(error: any): error is NodeJS.ErrnoException { return error instanceof Error; }
