// modified from https://github.com/Microsoft/typescript-tslint-plugin
import * as ts_module from "typescript/lib/tsserverlibrary";

const pluginId = "typescript-deno-plugin";

export class Logger {
  public static forPlugin(info: ts_module.server.PluginCreateInfo) {
    return new Logger(info.project.projectService.logger);
  }

  private constructor(private readonly logger: ts_module.server.Logger) {}

  public info(message: string) {
    this.logger.info(`[${pluginId}] ${JSON.stringify(message)}`);
  }
}
