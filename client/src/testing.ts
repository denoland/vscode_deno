// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import {
  type TestData,
  type TestIdentifier,
  type TestMessage,
  testModule,
  testModuleDelete,
  TestModuleParams,
  testRun,
  testRunCancel,
  testRunProgress,
} from "./lsp_extensions";
import type { DenoExtensionContext } from "./types";
import { assert } from "./util";

import * as vscode from "vscode";
import { FeatureState, MarkupKind } from "vscode-languageclient/node";
import type {
  ClientCapabilities,
  DocumentSelector,
  MarkupContent,
  ServerCapabilities,
  StaticFeature,
} from "vscode-languageclient/node";

/** Indicate to the language server that the client supports the Testing API */
export class TestingFeature implements StaticFeature {
  #enabled = false;

  get enabled() {
    return this.#enabled;
  }

  getState(): FeatureState {
    return { kind: "static" };
  }

  fillClientCapabilities(capabilities: ClientCapabilities): void {
    const experimental: { testingApi?: boolean } = capabilities.experimental ??
      {};
    experimental.testingApi = true;
    capabilities.experimental = experimental;
  }

  initialize(
    capabilities: ServerCapabilities<{ testingApi?: boolean }>,
    _documentSelector: DocumentSelector | undefined,
  ): void {
    this.#enabled = capabilities.experimental?.testingApi ?? false;
  }

  dispose(): void {}
}

function asStringOrMarkdown(
  content: MarkupContent,
): string | vscode.MarkdownString {
  switch (content.kind) {
    case MarkupKind.Markdown:
      return new vscode.MarkdownString(content.value);
    case MarkupKind.PlainText:
      return content.value;
  }
}

/** Resolve the test that a test item belongs to. If the test item is a test,
 * the result will be itself, but if the test item is a step, the result will
 * be the owning test. */
function getTest(testItem: vscode.TestItem): vscode.TestItem {
  let item = testItem;
  while (item.parent && item.parent.parent) {
    item = item.parent;
  }
  return item;
}

/** Return the test identifier for a given test item. */
function asTestIdentifier(testItem: vscode.TestItem): TestIdentifier {
  if (testItem.parent) {
    const test = getTest(testItem);
    if (test.id === testItem.id) {
      return { textDocument: { uri: testItem.parent.id }, id: testItem.id };
    } else {
      return {
        textDocument: { uri: test.parent!.id },
        id: test.id,
        stepId: testItem.id,
      };
    }
  } else {
    return { textDocument: { uri: testItem.id } };
  }
}

/** Recursively search a test item for a test step, returning it if found,
 * otherwise returning undefined. */
function getTestStep(
  test: vscode.TestItem,
  id: string,
): vscode.TestItem | undefined {
  let step: vscode.TestItem | undefined;
  test.children.forEach((child) => {
    if (!step) {
      if (child.id === id) {
        step = child;
      } else if (child.children.size) {
        step = getTestStep(child, id);
      }
    }
  });
  return step;
}

function getTestItem(
  testController: vscode.TestController,
  { textDocument: { uri }, id, stepId }: TestIdentifier,
): vscode.TestItem | undefined {
  const testModule = testController.items.get(uri);
  if (!testModule) {
    return undefined;
  }
  if (id) {
    const test = testModule.children.get(id);
    if (test && stepId) {
      return getTestStep(test, stepId);
    } else {
      return test;
    }
  } else {
    return testModule;
  }
}

export class DenoTestController implements vscode.Disposable {
  #runCount = 0;
  #runs = new Map<number, vscode.TestRun>();
  #subscriptions: vscode.Disposable[] = [];
  #testController: vscode.TestController;

  constructor(extensionContext: DenoExtensionContext) {
    const testController = extensionContext.testController =
      this
        .#testController =
        vscode.tests
          .createTestController("denoTestController", "Deno");
    this.#subscriptions.push(testController);

    const { client } = extensionContext;
    assert(client);

    const runHandler = async (
      request: vscode.TestRunRequest,
      cancellation: vscode.CancellationToken,
    ) => {
      const run = testController.createTestRun(request);
      const id = ++this.#runCount;
      this.#runs.set(id, run);
      // currently on "run" is implemented and exposed
      let kind: "run" | "coverage" | "debug" = "run";
      switch (request.profile?.kind) {
        case vscode.TestRunProfileKind.Coverage:
          kind = "coverage";
          break;
        case vscode.TestRunProfileKind.Debug:
          kind = "debug";
          break;
      }
      const include = request.include
        ? request.include.map(asTestIdentifier)
        : undefined;
      const exclude = request.exclude
        ? request.exclude.map(asTestIdentifier)
        : undefined;
      const { enqueued } = await client.sendRequest(testRun, {
        id,
        kind,
        include,
        exclude,
      });

      cancellation.onCancellationRequested(async () => {
        await client.sendRequest(testRunCancel, { id });
        run.end();
        this.#runs.delete(id);
      });

      for (const { textDocument, ids } of enqueued) {
        for (const id of ids) {
          const item = getTestItem(testController, { textDocument, id });
          if (!item) {
            continue;
          }
          run.enqueued(item);
        }
      }
    };

    testController.createRunProfile(
      "Run Tests",
      vscode.TestRunProfileKind.Run,
      runHandler,
      true,
    );
    // TODO(@kitsonk) add debug run profile
    // TODO(@kitsonk) add coverage run profile

    const p2c = client.protocol2CodeConverter;

    function asTestMessage({
      message,
      expectedOutput,
      actualOutput,
      location,
    }: TestMessage) {
      const msg = asStringOrMarkdown(message);
      const testMessage = expectedOutput && actualOutput
        ? vscode.TestMessage.diff(
          msg,
          expectedOutput,
          actualOutput,
        )
        : new vscode.TestMessage(msg);

      if (location) {
        testMessage.location = p2c.asLocation(location);
      }
      return testMessage;
    }

    function mergeChildren(
      parent: vscode.TestItem,
      newChildrenData: TestData[],
      kind: TestModuleParams["kind"],
    ) {
      const newChildren: vscode.TestItem[] = [];
      for (const { id, label, range, steps } of newChildrenData) {
        let newChild = parent.children.get(id);
        if (!newChild) {
          newChild = testController.createTestItem(id, label, parent.uri);
        } else {
          newChild.label = label;
        }
        newChildren.push(newChild);
        newChild.range = p2c.asRange(range);
        if (steps || kind === "replace") {
          mergeChildren(newChild, steps ?? [], kind);
        }
      }
      if (kind === "replace") {
        // TODO(nayeemrmn): This is to prevent dynamically detected steps from
        // being deleted on every file change. Instead, these should just be
        // remembered and resent by the LSP. They should also be deleted after
        // a test run takes place without them having been run.
        parent.children.forEach((child) => {
          if (!child.range) {
            newChildren.push(child);
          }
        });
        parent.children.replace(newChildren);
      } else if (kind === "insert") {
        for (const newChild of newChildren) {
          parent.children.add(newChild);
        }
      }
    }

    client.onNotification(
      testModule,
      ({ textDocument: { uri: uriStr }, kind, label, tests }) => {
        const uri = p2c.asUri(uriStr);
        let testModule = testController.items.get(uriStr);
        if (!testModule) {
          testModule = testController.createTestItem(uriStr, label, uri);
          testController.items.add(testModule);
        }
        mergeChildren(testModule, tests, kind);
      },
    );

    client.onNotification(
      testModuleDelete,
      ({ textDocument: { uri } }) => testController.items.delete(uri),
    );

    client.onNotification(testRunProgress, ({ id, message }) => {
      const run = this.#runs.get(id);
      if (!run) {
        return;
      }
      switch (message.type) {
        case "enqueued":
        case "started":
        case "skipped": {
          const { test } = message;
          const item = getTestItem(testController, test);
          if (item) {
            run[message.type](item);
          }
          break;
        }
        case "passed": {
          const { test, duration } = message;
          const item = getTestItem(testController, test);
          if (item) {
            run.passed(item, duration);
          }
          break;
        }
        case "errored":
        case "failed": {
          const { test, messages, duration } = message;
          const item = getTestItem(testController, test);
          if (item) {
            const errorMessages = messages.map(asTestMessage);
            run[message.type](item, errorMessages, duration);
          }
          break;
        }
        case "output": {
          const { test, location, value } = message;
          const item = test ? getTestItem(testController, test) : undefined;
          const loc = location ? p2c.asLocation(location) : undefined;
          run.appendOutput(value, loc, item);
          break;
        }
        case "end": {
          run.end();
          this.#runs.delete(id);
          break;
        }
      }
    });
  }

  dispose() {
    for (const disposable of this.#subscriptions) {
      disposable.dispose();
    }
  }
}
