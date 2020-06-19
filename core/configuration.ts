import * as path from "path";
import * as fs from "fs";
import merge from "deepmerge";
import equal from "deep-equal";

import json5 from "json5";

import { pathExistsSync } from "./util";

export const DenoPluginConfigurationField: (keyof ConfigurationField)[] = [
  "enable",
  "unstable",
  "import_map",
  "enablePatterns"
];

export type ConfigurationField = {
  enable?: boolean;
  unstable?: boolean;
  import_map?: string | null;
  enablePatterns?: string[];
};

interface ConfigurationInterface {
  config: ConfigurationField;
  update(config: ConfigurationField): void;
  resolveFromVscode(projectFolder: string): void;
  onUpdatedConfig(listener: () => void): void;
}

export class Configuration implements ConfigurationInterface {
  static readonly defaultConfiguration: ConfigurationField = {
    enable: false,
    unstable: false,
    import_map: null,
  };

  private readonly _configUpdatedListeners = new Set<() => void>();

  private _configuration: ConfigurationField =
    Configuration.defaultConfiguration;

  public get config(): ConfigurationField {
    return merge({}, this._configuration);
  }

  public resolveFromVscode(projectFolder: string): void {
    const vscodeSettingsFile = path.join(
      projectFolder,
      ".vscode",
      "settings.json"
    );

    // Try to read configuration from vscode
    if (pathExistsSync(vscodeSettingsFile) === true) {
      const content = fs.readFileSync(vscodeSettingsFile, { encoding: "utf8" });

      try {
        const settings: { [key: string]: never } = json5.parse(content);

        const c: ConfigurationField = {};

        for (const key in settings) {
          /* istanbul ignore else */
          if (
            DenoPluginConfigurationField.map((v) => "deno." + v).includes(key)
          ) {
            const field = key.replace(
              /^deno\./,
              ""
            ) as keyof ConfigurationField;
            c[field] = settings[key];
          }
        }

        this._configuration = merge(this._configuration, c);

        // Make sure the type of each configuration item is correct
        this._configuration.enable = !!this._configuration.enable;
        this._configuration.unstable = !!this._configuration.unstable;
        this._configuration.import_map = this._configuration.import_map
          ? this._configuration.import_map + ""
          : null;
      } catch {
        // ignore error
      }
    }
  }

  public update(c: ConfigurationField) {
    const oldConfig = JSON.parse(JSON.stringify(this._configuration));
    this._configuration = merge(this._configuration, c);

    // notify the listener
    /* istanbul ignore else */
    if (!equal(oldConfig, this.config)) {
      for (const listener of this._configUpdatedListeners) {
        listener();
      }
    }
  }

  public onUpdatedConfig(listener: () => void) {
    this._configUpdatedListeners.add(listener);
  }
}
