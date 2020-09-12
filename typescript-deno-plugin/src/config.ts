import { Configuration } from "../../core/configuration";
import {
  TypescriptDenoPluginConfig,
  TypescriptDenoPluginMessage,
} from "../../core/typescript_deno_plugin_config";

export {
  TypescriptDenoPluginConfig,
  TypescriptDenoPluginMessage,
} from "../../core/typescript_deno_plugin_config";

export class TypescriptDenoPluginConfigManager {
  private project_config = new Configuration();
  private plugin_config?: TypescriptDenoPluginConfig;

  getProjectConfig(): Configuration {
    return this.project_config;
  }

  getPluginConfig(): TypescriptDenoPluginConfig | undefined {
    return this.plugin_config;
  }

  update(msg: TypescriptDenoPluginMessage): void {
    this.project_config.update(msg.project_config);
    this.plugin_config = msg.plugin_config;
  }
}
