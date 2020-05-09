// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.
// Copyright Google Inc. and other 'vscode-ng-language-service' contributors. All Rights Reserved.
// Use of this source code is governed by an MIT-style license that can be
// found in the LICENSE file at https://angular.io/license

import ts from "typescript/lib/tsserverlibrary";

/**
 * `ServerHost` is a wrapper around `ts.sys` for the Node system. In Node, all
 * optional methods of `ts.System` are implemented.
 * See
 * https://github.com/microsoft/TypeScript/blob/ec39d412876d0dcf704fc886d5036cb625220d2f/src/compiler/sys.ts#L716
 */
export class ServerHost implements ts.server.ServerHost {
  readonly args: string[];
  readonly newLine: string;
  readonly useCaseSensitiveFileNames: boolean;

  constructor() {
    this.args = ts.sys.args;
    this.newLine = ts.sys.newLine;
    this.useCaseSensitiveFileNames = ts.sys.useCaseSensitiveFileNames;
  }

  write(s: string): void {
    ts.sys.write(s);
  }

  writeOutputIsTTY(): boolean {
    return ts.sys.writeOutputIsTTY!();
  }

  readFile(path: string, encoding?: string): string | undefined {
    return ts.sys.readFile(path, encoding);
  }

  getFileSize(path: string): number {
    return ts.sys.getFileSize!(path);
  }

  writeFile(path: string, data: string, writeByteOrderMark?: boolean): void {
    return ts.sys.writeFile(path, data, writeByteOrderMark);
  }

  /**
   * @pollingInterval - this parameter is used in polling-based watchers and
   * ignored in watchers that use native OS file watching
   */
  watchFile(
    path: string,
    callback: ts.FileWatcherCallback,
    pollingInterval?: number,
  ): ts.FileWatcher {
    return ts.sys.watchFile!(path, callback, pollingInterval);
  }

  watchDirectory(
    path: string,
    callback: ts.DirectoryWatcherCallback,
    recursive?: boolean,
  ): ts.FileWatcher {
    return ts.sys.watchDirectory!(path, callback, recursive);
  }

  resolvePath(path: string): string {
    return ts.sys.resolvePath(path);
  }

  fileExists(path: string): boolean {
    return ts.sys.fileExists(path);
  }

  directoryExists(path: string): boolean {
    return ts.sys.directoryExists(path);
  }

  createDirectory(path: string): void {
    return ts.sys.createDirectory(path);
  }

  getExecutingFilePath(): string {
    return ts.sys.getExecutingFilePath();
  }

  getCurrentDirectory(): string {
    return ts.sys.getCurrentDirectory();
  }

  getDirectories(path: string): string[] {
    return ts.sys.getDirectories(path);
  }

  readDirectory(
    path: string,
    extensions?: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>,
    include?: ReadonlyArray<string>,
    depth?: number,
  ): string[] {
    return ts.sys.readDirectory(path, extensions, exclude, include, depth);
  }

  getModifiedTime(path: string): Date | undefined {
    return ts.sys.getModifiedTime!(path);
  }

  setModifiedTime(path: string, time: Date): void {
    return ts.sys.setModifiedTime!(path, time);
  }

  deleteFile(path: string): void {
    return ts.sys.deleteFile!(path);
  }

  /**
   * A good implementation is node.js' `crypto.createHash`.
   * (https://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm)
   */
  createHash(data: string): string {
    return ts.sys.createHash!(data);
  }

  /**
   * This must be cryptographically secure. Only implement this method using
   * `crypto.createHash("sha256")`.
   */
  createSHA256Hash(data: string): string {
    return ts.sys.createSHA256Hash!(data);
  }

  getMemoryUsage(): number {
    return ts.sys.getMemoryUsage!();
  }

  exit(exitCode?: number): void {
    return ts.sys.exit(exitCode);
  }

  realpath(path: string): string {
    return ts.sys.realpath!(path);
  }

  setTimeout(
    callback: (...args: any[]) => void,
    ms: number,
    ...args: any[]
  ): any {
    return ts.sys.setTimeout!(callback, ms, ...args);
  }

  clearTimeout(timeoutId: any): void {
    return ts.sys.clearTimeout!(timeoutId);
  }

  clearScreen(): void {
    return ts.sys.clearScreen!();
  }

  base64decode(input: string): string {
    return ts.sys.base64decode!(input);
  }

  base64encode(input: string): string {
    return ts.sys.base64encode!(input);
  }

  setImmediate(callback: (...args: any[]) => void, ...args: any[]): any {
    return setImmediate(callback, ...args);
  }

  clearImmediate(timeoutId: any): void {
    return clearImmediate(timeoutId);
  }

  require(initialPath: string, moduleName: string) {
    try {
      const modulePath = require.resolve(moduleName, {
        paths: [initialPath],
      });
      return {
        module: require(modulePath),
        error: undefined,
      };
    } catch (e) {
      return {
        module: undefined,
        error: e as Error,
      };
    }
  }
}
