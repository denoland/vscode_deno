// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import {
  EXTENSION_TS_PLUGIN,
  TS_LANGUAGE_FEATURES_EXTENSION,
} from "./constants";
import type { PluginSettings, TsApi } from "./types";
import { assert } from "./util";

import * as vscode from "vscode";

interface TsLanguageFeatures {
  getAPI(version: 0): TsLanguageFeaturesApiV0 | undefined;
}

interface TsLanguageFeaturesApiV0 {
  configurePlugin(
    pluginId: string,
    configuration: PluginSettings,
  ): void;
}

export async function getTsApi(
  getPluginSettings: () => PluginSettings,
): Promise<TsApi> {
  const extension: vscode.Extension<TsLanguageFeatures> | undefined = vscode
    .extensions.getExtension(TS_LANGUAGE_FEATURES_EXTENSION);
  const errorMessage =
    "The Deno extension cannot load the built in TypeScript Language Features. Please try restarting Visual Studio Code.";
  assert(extension, errorMessage);
  const languageFeatures = await extension.activate();
  const api = languageFeatures.getAPI(0);
  assert(api, errorMessage);

  return {
    refresh() {
      const pluginSettings = getPluginSettings();
      api.configurePlugin(EXTENSION_TS_PLUGIN, pluginSettings);
    },
  };
}
