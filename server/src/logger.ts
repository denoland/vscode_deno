// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.
// Copyright Google Inc. and other 'vscode-ng-language-service' contributors. All Rights Reserved.
// Use of this source code is governed by an MIT-style license that can be
// found in the LICENSE file at https://angular.io/license

import * as fs from "fs";
import * as path from "path";
import ts from "typescript/lib/tsserverlibrary";

// NOTES:
// Be very careful about logging. There are two types of logging:
// 1. Console
// 2. File
// The language server could operate in a few different modes, depending on
// startup options. `process.argv` is parsed by `vscode-languageserver` when
// createConnection() is called.
// By default, the server communicates with the client through Node IPC.
// In this case, logging to stdout/stderr would be piped to VSCode's
// development console (Output tab in vscode).
// Verbose log should not be sent to the client as it could negatively impact
// performance. Instead, verbose log entries should be written to file using
// the Logger class here.
// The language server could also operate in JSON-RPC mode via stdin/stdout.
// In this case, there must not be any logging done through console.log(),
// console.info() etc, as it could pollute the communication channel.
// TLDR: To log to development console, always use connection.console.log().
// Never use console.log(), console.info(), etc directly.

export interface LoggerOptions {
  logFile?: string;
  logVerbosity?: string;
}

/**
 * Create a logger instance to write to file.
 * @param options Logging options.
 */
export function createLogger(options: LoggerOptions): Logger {
  let logLevel: ts.server.LogLevel;
  switch (options.logVerbosity) {
    case "requestTime":
      logLevel = ts.server.LogLevel.requestTime;
      break;
    case "verbose":
      logLevel = ts.server.LogLevel.verbose;
      break;
    case "normal":
      logLevel = ts.server.LogLevel.normal;
      break;
    case "terse":
    default:
      logLevel = ts.server.LogLevel.terse;
      break;
  }
  // If logFile is not provided then just trace to console.
  const traceToConsole = !options.logFile;
  return new Logger(traceToConsole, logLevel, options.logFile);
}

// TODO: Code below is from TypeScript's repository. Maybe create our own
// implementation.
// https://github.com/microsoft/TypeScript/blob/ec39d412876d0dcf704fc886d5036cb625220d2f/src/tsserver/server.ts#L120

function noop(_?: {} | null | undefined): void {} // tslint:disable-line no-empty

function nowString() {
  // E.g. "12:34:56.789"
  const d = new Date();
  return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}.${d.getMilliseconds()}`;
}

export class Logger implements ts.server.Logger {
  private fd = -1;
  private seq = 0;
  private inGroup = false;
  private firstInGroup = true;

  constructor(
    private readonly traceToConsole: boolean,
    private readonly level: ts.server.LogLevel,
    private readonly logFilename?: string,
  ) {
    if (logFilename) {
      try {
        const dir = path.dirname(logFilename);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }
        this.fd = fs.openSync(logFilename, "w");
      } catch {
        // swallow the error and keep logging disabled if file cannot be opened
      }
    }
  }

  static padStringRight(str: string, padding: string) {
    return (str + padding).slice(0, padding.length);
  }

  close() {
    if (this.fd >= 0) {
      fs.close(this.fd, noop);
    }
  }

  getLogFileName() {
    return this.logFilename;
  }

  perftrc(s: string) {
    this.msg(s, ts.server.Msg.Perf);
  }

  info(s: string) {
    this.msg(s, ts.server.Msg.Info);
  }

  err(s: string) {
    this.msg(s, ts.server.Msg.Err);
  }

  startGroup() {
    this.inGroup = true;
    this.firstInGroup = true;
  }

  endGroup() {
    this.inGroup = false;
  }

  loggingEnabled() {
    return !!this.logFilename || this.traceToConsole;
  }

  hasLevel(level: ts.server.LogLevel) {
    return this.loggingEnabled() && this.level >= level;
  }

  msg(s: string, type: ts.server.Msg = ts.server.Msg.Err) {
    if (!this.canWrite) return;

    s = `[${nowString()}] ${s}\n`;
    if (!this.inGroup || this.firstInGroup) {
      const prefix = Logger.padStringRight(
        type + " " + this.seq.toString(),
        "          ",
      );
      s = prefix + s;
    }
    this.write(s);
    if (!this.inGroup) {
      this.seq++;
    }
  }

  private get canWrite() {
    return this.fd >= 0 || this.traceToConsole;
  }

  private write(s: string) {
    if (this.fd >= 0) {
      const buf = Buffer.from(s);
      // tslint:disable-next-line no-null-keyword
      fs.writeSync(this.fd, buf, 0, buf.length, /*position*/ null!); // TODO: GH#18217
    }
    if (this.traceToConsole) {
      console.warn(s);
    }
  }
}
