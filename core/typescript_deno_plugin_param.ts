import { ConfigurationField } from "./configuration";
import { TDPConfig } from "../typescript-deno-plugin/src/config";

export interface TypescriptDenoPluginParam {
  readonly project_config: ConfigurationField;
  readonly plugin_config: TDPConfig;
}
