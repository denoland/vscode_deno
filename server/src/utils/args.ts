// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.

function parseString(args: string[], argName: string): string | undefined {
  const index = args.indexOf(argName);
  if (index < 0 || index === args.length - 1) {
    return;
  }
  return args[index + 1];
}

function parseBoolen(args: string[], argName: string): boolean {
  return args.includes(argName);
}

interface CommandLineOptions {
  help: boolean;
  logFile?: string;
  logVerbosity?: string;
  config?: string;
  importmap?: string;
}

export function parseArguments(args: string[]): CommandLineOptions {
  return {
    help: parseBoolen(args, "--help"),
    logFile: parseString(args, "--logFile"),
    logVerbosity: parseString(args, "--logVerbosity"),
    config: parseString(args, "--config"),
    importmap: parseString(args, "--importmap"),
  };
}

export function generateHelpMessage(args: string[]) {
  return `Deno Language Service that implements the Language Server Protocol (LSP).

  Usage: ${args[0]} ${args[1]} [options]

  Options:
    --help: Prints help message.
    --logFile: Location to log messages. Logging is disabled if not provided.
    --logVerbosity: terse|normal|verbose|requestTime. See ts.server.LogLevel.
    --config: Path of config.json.
    --importmap: Path of import maps.

  Additional options supported by vscode-languageserver:
    --clientProcessId=<number>: Automatically kills the server if the client process dies.
    --node-ipc: Communicate using Node's IPC. This is the default.
    --stdio: Communicate over stdin/stdout.
    --socket=<number>: Communicate using Unix socket.
  `;
}
