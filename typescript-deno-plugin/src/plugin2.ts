import typescript from "typescript/lib/tsserverlibrary";
import { Logger } from "./logger";

import { DenoLanguageServerHost } from "./language_service_host";
import { DenoLanguageServer } from "./language_service";

export class DenoPlugin {
  static readonly PLUGIN_NAME = "typescript-deno-plugin";

  private logger!: Logger;

  // private deno_lsh!: DenoLanguageServerHost;
  private deno_ls!: DenoLanguageServer;

  onConfigurationChanged(): void {
    //   this.logger.info(`onConfigurationChanged: ${JSON.stringify(c)}`);
    //   this.configurationManager.update(c);
    this.deno_ls.getNewOne().getProgram()?.emit();
  }

  create(info: typescript.server.PluginCreateInfo): typescript.LanguageService {
    this.logger = Logger.forPlugin(DenoPlugin.PLUGIN_NAME, info);
    this.logger.info("TDP creating started");

    DenoLanguageServerHost.decorate(
      info.languageServiceHost,
      info.project,
      this.logger
    );
    this.deno_ls = DenoLanguageServer.decorate(
      info.languageService,
      info.languageServiceHost,
      this.logger
    );

    this.logger.info("TDP created.");
    return this.deno_ls.getNewOne();
  }
}
