// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import {
  EXTENSION_TS_PLUGIN,
  TS_LANGUAGE_FEATURES_EXTENSION,
} from "./constants";
import type { DenoExtensionContext, TsLanguageFeaturesApiV0 } from "./types";
import { assert } from "./util";

import * as vscode from "vscode";

interface TsLanguageFeatures {
  getAPI(version: 0): TsLanguageFeaturesApiV0 | undefined;
}

export async function getTsApi(): Promise<TsLanguageFeaturesApiV0> {
  const extension: vscode.Extension<TsLanguageFeatures> | undefined = vscode
    .extensions.getExtension(TS_LANGUAGE_FEATURES_EXTENSION);
  const errorMessage =
    "The Deno extension cannot load the built in TypeScript Language Features. Please try restarting Visual Studio Code.";
  assert(extension, errorMessage);
  const languageFeatures = await extension.activate();
  const api = languageFeatures.getAPI(0);
  assert(api, errorMessage);
  return api;
}

/** Update the typescript-deno-plugin with settings. */
export function configurePlugin(extensionContext: DenoExtensionContext) {
  const { documentSettings: documents, tsApi, workspaceSettings: workspace } =
    extensionContext;
  tsApi.configurePlugin(EXTENSION_TS_PLUGIN, { workspace, documents });
}
