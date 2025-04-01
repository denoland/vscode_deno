// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

// types shared with typescript-deno-plugin

export interface EnableSettings {
  enable: boolean | null;
  enablePaths: string[] | null;
  disablePaths: string[];
}

export interface PluginSettings {
  enableSettingsUnscoped: EnableSettings;
  enableSettingsByFolder: [string, EnableSettings][];
  scopesWithDenoJson: string[];
  npmCache: string | null;
}
