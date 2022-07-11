// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import path = require('path');

enum Qualifier {
	static = "static",
	dynamic = "dynamic",
	bounded = "bounded"
}

interface SuFileEntry {
	path: string;
	line: number;
	col: number;
	functionSignature: string;
	numberOfBytes: number;
	qualifiers: Qualifier[];
};

interface StackUsageDbEntry extends SuFileEntry {
	source: string;
}

// type StackUsageDb = StackUsageDbEntry[];

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

class StackUsageDb {
	#data: StackUsageDbEntry[] = [];

	addFromFile(entries: SuFileEntry[], source: string) {
		this.#data = this.#data.filter(entry => entry.source !== source);
		entries.forEach(entry => this.#data.push({ source: source, ...entry }));
	}

	getDataForFile(path: string): StackUsageDbEntry[] {
		return this.#data.filter(entry => entry.path === path);
	}
}

const stackSizeDecorationType = vscode.window.createTextEditorDecorationType({
	cursor: 'crosshair',
	backgroundColor: "darkBlue",
	after: { margin: "10px", color: "red" }
});

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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let db = new StackUsageDb();

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerTextEditorCommand("stack-usage.helloWorld", (textEditor: vscode.TextEditor) => {
		const entries = db.getDataForFile(textEditor.document.uri.path);
		const decorations = makeDecorations(entries, textEditor.document);
		textEditor.setDecorations(stackSizeDecorationType, decorations);
	});
	context.subscriptions.push(disposable);

	const compileCommands = '/Users/timo/Desktop/stack-usage-test/compile_commands.json';
	const realCompileCommands = fs.realpathSync(compileCommands);
	console.log("Real compile path:" + realCompileCommands);
	let watcherDisposable = vscode.workspace.createFileSystemWatcher(realCompileCommands, false, false, false);
	watcherDisposable.onDidChange((file: vscode.Uri) => { console.log("compile commands changed"); });
	watcherDisposable.onDidCreate((file: vscode.Uri) => { console.log("compile commands created"); });
	context.subscriptions.push(watcherDisposable);

	interface CompileCommand {
		directory: string;
		command: string;
		file: string
	}

	const rawdata = fs.readFileSync(realCompileCommands, 'utf-8');
	const data: CompileCommand[] = JSON.parse(rawdata);

	const outputNameRegex = /.+-o (.+)\.o.+/;
	data.forEach((entry) => {
		const match = outputNameRegex.exec(entry.command)!;
		const outputName = match[1];
		const suFileName = path.join(entry.directory, outputName) + '.su';
		db.addFromFile(readSuFile(suFileName), entry.file);
		let watcherDisposable = vscode.workspace.createFileSystemWatcher(suFileName, false, false, false);
		watcherDisposable.onDidChange((file: vscode.Uri) => { db.addFromFile(readSuFile(suFileName), entry.file); });
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }
