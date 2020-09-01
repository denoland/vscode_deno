import ts_module from "typescript/lib/tsserverlibrary";

export class Logger {
  public static forPlugin(
    name: string,
    info: ts_module.server.PluginCreateInfo
  ): Logger {
    return new Logger(name, info.project.projectService.logger);
  }

  private constructor(
    private readonly name: string,
    private readonly logger: ts_module.server.Logger
  ) {}

  public info(message: string): void {
    this.logger.info(`[${this.name}] ${JSON.stringify(message)}`);
  }
}
