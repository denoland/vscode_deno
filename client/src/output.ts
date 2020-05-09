import { OutputChannel, window as Window } from "vscode";

const outputChannel: OutputChannel = Window.createOutputChannel("Deno");

export { outputChannel };
