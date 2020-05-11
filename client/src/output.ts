// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.

import { OutputChannel, window as Window } from "vscode";

const outputChannel: OutputChannel = Window.createOutputChannel("Deno");

export { outputChannel };
