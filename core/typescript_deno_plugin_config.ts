import { ConfigurationField } from "./configuration";

export interface TypescriptDenoPluginConfig {
  readonly enable: boolean;
}

export interface TypescriptDenoPluginMessage {
  plugin_config: TypescriptDenoPluginConfig;
  project_config: ConfigurationField;
}
