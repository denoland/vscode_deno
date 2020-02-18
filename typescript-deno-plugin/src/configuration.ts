import merge from "deepmerge";
import equal from "deep-equal";

export type DenoPluginConfig = {
  enable: boolean;
  dts_file: string[];
  import_map: string;
};

export class ConfigurationManager {
  private static readonly defaultConfiguration: DenoPluginConfig = {
    enable: true,
    dts_file: [],
    import_map: ""
  };

  private readonly _configUpdatedListeners = new Set<() => void>();

  public get config(): DenoPluginConfig {
    return this._configuration;
  }

  private _configuration: DenoPluginConfig =
    ConfigurationManager.defaultConfiguration;

  public update(c: DenoPluginConfig) {
    const oldConfig = JSON.parse(JSON.stringify(this.config));
    this._configuration = merge(this.config, c);

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
