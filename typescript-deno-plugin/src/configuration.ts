import merge from "deepmerge";

export type DenoPluginConfig = {
  enable: boolean;
  dtsFilepaths?: string[];
  import_map: string;
};

export class ConfigurationManager {
  private static readonly defaultConfiguration: DenoPluginConfig = {
    enable: true,
    dtsFilepaths: [],
    import_map: ""
  };

  private readonly _configUpdatedListeners = new Set<() => void>();

  public get config(): DenoPluginConfig {
    return this._configuration;
  }

  private _configuration: DenoPluginConfig = ConfigurationManager
    .defaultConfiguration;

  public update(c: DenoPluginConfig) {
    this._configuration = merge(this.config, c);

    for (const listener of this._configUpdatedListeners) {
      listener();
    }
  }

  public onUpdatedConfig(listener: () => void) {
    this._configUpdatedListeners.add(listener);
  }
}
