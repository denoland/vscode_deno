// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import {
  EXTENSION_TS_PLUGIN,
  TS_LANGUAGE_FEATURES_EXTENSION,
} from "./constants";
import type { PluginSettings, TsApi } from "./types";

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

export function getTsApi(
  getPluginSettings: () => PluginSettings,
): TsApi {
  let api: TsLanguageFeaturesApiV0 | undefined;
  (async () => {
    try {
      const extension: vscode.Extension<TsLanguageFeatures> | undefined = vscode
        .extensions.getExtension(TS_LANGUAGE_FEATURES_EXTENSION);
      if (!extension) {
        return;
      }
      const languageFeatures = await extension.activate();
      api = languageFeatures.getAPI(0);
      if (!api) {
        return;
      }
      const pluginSettings = getPluginSettings();
      api.configurePlugin(EXTENSION_TS_PLUGIN, pluginSettings);
    } catch (e) {
      const msg = `Cannot get internal TypeScript plugin configuration API.${
        e instanceof Error ? ` (${e.name}: ${e.message})` : ""
      }`;
      await vscode.window.showErrorMessage(msg);
    }
  })();

  return {
    refresh() {
      if (api) {
        const pluginSettings = getPluginSettings();
        api.configurePlugin(EXTENSION_TS_PLUGIN, pluginSettings);
      }
    },
  };
}
