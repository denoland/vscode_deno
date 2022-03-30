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
  /** The unique ID for this test/step. */
  id: string;

  /** The display label for the test/step. */
  label: string;

  /** Any test steps that are associated with this test/step */
  steps?: TestData[];

  /** The range of the owning text document that applies to the test. */
  range?: Range;
}

export interface TestModuleParams {
  /** The text document identifier that the tests are related to. */
  textDocument: TextDocumentIdentifier;

  /** A indication if tests described are _newly_ discovered and should be
   * _inserted_ or if the tests associated are a replacement for any existing
   * tests. */
  kind: "insert" | "replace";

  /** The text label for the test module. */
  label: string;

  /** An array of tests that are owned by this test module. */
  tests: TestData[];
}

/** Notification of a discovery of a test module. The notification parameters
 * include */
export const testModule = new NotificationType<TestModuleParams>(
  "deno/testModule",
);

export interface TestModuleDeleteParams {
  /** The text document identifier that has been removed. */
  textDocument: TextDocumentIdentifier;
}

export const testModuleDelete = new NotificationType<TestModuleDeleteParams>(
  "deno/testModuleDelete",
);

export interface TestRunRequestParams {
  /** The id of the test run to be used for future messages. */
  id: number;

  /** The run kind. Currently Deno only supports `"run"` */
  kind: "run" | "coverage" | "debug";

  /** Test modules or tests to exclude from the test run. */
  exclude?: TestIdentifier[];

  /** Test modules or tests to include in the test run. */
  include?: TestIdentifier[];
}

interface EnqueuedTestModule {
  /** The test module the enqueued test IDs relate to */
  textDocument: TextDocumentIdentifier;

  /** The test IDs which are now enqueued for testing */
  ids: string[];
}

export interface TestRunResponseParams {
  /** Test modules and test IDs that are now enqueued for testing. */
  enqueued: EnqueuedTestModule[];
}

export const testRun = new RequestType<
  TestRunRequestParams,
  TestRunResponseParams,
  void
>("deno/testRun");

export interface TestIdentifier {
  /** The test module the message is related to. */
  textDocument: TextDocumentIdentifier;

  /** The optional ID of the test. If not present, then the message applies to
   * all tests in the test module. */
  id?: string;

  /** The optional ID of the step. If not present, then the message only applies
   * to the test. */
  stepId?: string;
}

export interface TestMessage {
  /** The content of the message. */
  message: MarkupContent;

  /** An optional string which represents the expected output. */
  expectedOutput?: string;

  /** An optional string which represents the actual output. */
  actualOutput?: string;

  /** An optional location related to the message. */
  location?: Location;
}

interface TestEnqueuedStartedSkipped {
  /** The state change that has occurred to a specific test or test step.
   *
   * - `"enqueued"` - the test is now enqueued to be tested
   * - `"started"` - the test has started
   * - `"skipped"` - the test was skipped
   */
  type: "enqueued" | "started" | "skipped";

  /** The test or test step relating to the state change. */
  test: TestIdentifier;
}

interface TestFailedErrored {
  /** The state change that has occurred to a specific test or test step.
   *
   * - `"failed"` - The test failed to run properly, versus the test erroring.
   *   currently the Deno language server does not support this.
   * - `"errored"` - The test errored.
   */
  type: "failed" | "errored";

  /** The test or test step relating to the state change. */
  test: TestIdentifier;

  /** Messages related to the state change. */
  messages: TestMessage[];

  /** An optional duration, in milliseconds from the start to the current
   * state. */
  duration?: number;
}

interface TestPassed {
  /** The state change that has occurred to a specific test or test step. */
  type: "passed";

  /** The test or test step relating to the state change. */
  test: TestIdentifier;

  /** An optional duration, in milliseconds from the start to the current
   * state. */
  duration?: number;
}

interface TestOutput {
  /** The test or test step has output information / logged information. */
  type: "output";

  /** The value of the output. */
  value: string;

  /** The associated test or test step if there was one. */
  test?: TestIdentifier;

  /** An optional location associated with the output. */
  location?: Location;
}

interface TestEnd {
  /** The test run has ended. */
  type: "end";
}

type TestRunProgressMessage =
  | TestEnqueuedStartedSkipped
  | TestFailedErrored
  | TestPassed
  | TestOutput
  | TestEnd;

export interface TestRunProgressParams {
  /** The test run ID that the progress message applies to. */
  id: number;

  /** The message*/
  message: TestRunProgressMessage;
}

export const testRunProgress = new NotificationType<TestRunProgressParams>(
  "deno/testRunProgress",
);

export interface TestRunCancelParams {
  /** The test id to be cancelled. */
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
