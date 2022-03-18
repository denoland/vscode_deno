// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

/** Contains extensions to the Language Server Protocol that are supported by
 * the Deno Language Server.
 *
 * The requests and notifications types should mirror the Deno's CLI
 * `cli/lsp/language_server.rs` under the method `request_else`.
 */

import {
  NotificationType,
  RequestType,
  RequestType0,
} from "vscode-languageclient";
import type {
  Location,
  MarkupContent,
  Range,
  TextDocumentIdentifier,
} from "vscode-languageclient";

export interface CacheParams {
  referrer: TextDocumentIdentifier;
  uris: TextDocumentIdentifier[];
}

export const cache = new RequestType<CacheParams, boolean, void>("deno/cache");

export const reloadImportRegistries = new RequestType0<boolean, void>(
  "deno/reloadImportRegistries",
);

export interface RegistryStateParams {
  origin: string;
  suggestions: boolean;
}

export const registryState = new NotificationType<RegistryStateParams>(
  "deno/registryState",
);

export interface TaskParams {
  scope?: string;
}

export interface TaskRequestResponse {
  name: string;
  detail: string;
}

/** Requests any tasks from the language server that the language server is
 * aware of, which are defined in a Deno configuration file. */
export const task = new RequestType<
  TaskParams,
  TaskRequestResponse[] | undefined,
  void
>(
  "deno/task",
);

export interface TestData {
  id: string;
  label: string;
  steps?: TestData[];
  range?: Range;
}

export interface TestModuleParams {
  textDocument: TextDocumentIdentifier;
  kind: "insert" | "replace";
  label: string;
  tests: TestData[];
}

/** Notification of a discovery of a test module. The notification parameters
 * include */
export const testModule = new NotificationType<TestModuleParams>(
  "deno/testModule",
);

export interface TestModuleDeleteParams {
  textDocument: TextDocumentIdentifier;
}

export const testModuleDelete = new NotificationType<TestModuleDeleteParams>(
  "deno/testModuleDelete",
);

export interface TestRunRequestParams {
  id: number;
  kind: "run" | "coverage" | "debug";
  exclude?: TestIdentifier[];
  include?: TestIdentifier[];
}

interface EnqueuedTestModule {
  textDocument: TextDocumentIdentifier;
  ids: string[];
}

export interface TestRunResponseParams {
  enqueued: EnqueuedTestModule[];
}

export const testRun = new RequestType<
  TestRunRequestParams,
  TestRunResponseParams,
  void
>("deno/testRun");

export interface TestIdentifier {
  textDocument: TextDocumentIdentifier;
  id?: string;
  stepId?: string;
}

interface TestEnqueuedStartedSkipped {
  type: "enqueued" | "started" | "skipped";
  test: TestIdentifier;
}

export interface TestMessage {
  message: MarkupContent;
  expectedOutput?: string;
  actualOutput?: string;
  location?: Location;
}

interface TestFailedErrored {
  type: "failed" | "errored";
  test: TestIdentifier;
  messages: TestMessage[];
  duration?: number;
}

interface TestPassed {
  type: "passed";
  test: TestIdentifier;
  duration?: number;
}

interface TestOutput {
  type: "output";
  value: string;
  test?: TestIdentifier;
  location?: Location;
}

interface TestEnd {
  type: "end";
}

type TestRunProgressMessage =
  | TestEnqueuedStartedSkipped
  | TestFailedErrored
  | TestPassed
  | TestOutput
  | TestEnd;

export interface TestRunProgressParams {
  id: number;
  message: TestRunProgressMessage;
}

export const testRunProgress = new NotificationType<TestRunProgressParams>(
  "deno/testRunProgress",
);

export interface TestRunCancelParams {
  id: number;
}

export const testRunCancel = new RequestType<
  TestRunCancelParams,
  boolean,
  void
>("deno/testRunCancel");

export interface VirtualTextDocumentParams {
  textDocument: TextDocumentIdentifier;
}

export const virtualTextDocument = new RequestType<
  VirtualTextDocumentParams,
  string,
  void
>("deno/virtualTextDocument");
