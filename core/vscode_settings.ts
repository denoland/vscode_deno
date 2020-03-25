import * as path from "path";
import * as fs from "fs";

import json5 from "json5";

import { pathExistsSync } from "./util";

export type DenoPluginConfig = {
  enable: boolean;
  dts_file?: string[];
  import_map?: string;
};

export function readConfigurationFromVscodeSettings(
  projectFolder: string
): DenoPluginConfig | void {
  const vscodeSettingsFile = path.join(
    projectFolder,
    ".vscode",
    "settings.json"
  );

  // Try to read configuration from vscode
  if (pathExistsSync(vscodeSettingsFile) === true) {
    const content = fs.readFileSync(vscodeSettingsFile, { encoding: "utf8" });

    try {
      const settings = json5.parse(content);

      const isEnable = !!settings["deno.enable"];
      const dts_file = settings["deno.dts_file"] || [];
      const import_map = settings["deno.import_map"] || undefined;

      const configurationInProjectFolder: DenoPluginConfig = {
        enable: isEnable,
        dts_file,
        import_map,
      };

      return configurationInProjectFolder;
    } catch {
      // ignore error
    }
  }
}
