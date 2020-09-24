import { ConfigurationField } from "../../core/configuration";
import { TypescriptDenoPluginParam } from "../../core/typescript_deno_plugin_param";
import clone from "clone";

export interface TDPConfig {
  enable: boolean;
}

export type Optinal<T> = T | undefined;

export class TDPConfigMgr {
  private _project_config!: ConfigurationField;
  private _plugin_config!: TDPConfig;
  update({ project_config, plugin_config }: TypescriptDenoPluginParam) {
    this._plugin_config = plugin_config;
    this._project_config = project_config;
  }

  getProjectConfig(): Optinal<ConfigurationField> {
    return clone(this._project_config);
  }

  getPluginConfig(): Optinal<TDPConfig> {
    return clone(this._plugin_config);
  }
}
