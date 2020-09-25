import tss from "typescript/lib/tsserverlibrary";

import { TypescriptDenoPluginParam } from "../../core/typescript_deno_plugin_param";

import { Logger } from "./logger";
import { DenoLanguageServerHost } from "./language_service_host";
import { DenoLanguageServer } from "./language_service";
import { TDPConfigMgr } from "./config";

export class DenoPlugin implements tss.server.PluginModule {
  static readonly PLUGIN_NAME = "typescript-deno-plugin";

  private logger!: Logger;

  private configMgr = new TDPConfigMgr();

  private project!: tss.server.Project;

  // private deno_lsh!: DenoLanguageServerHost;
  private deno_ls!: DenoLanguageServer;

  onConfigurationChanged(param: TypescriptDenoPluginParam): void {
    //   this.logger.info(`onConfigurationChanged: ${JSON.stringify(c)}`);
    //   this.configurationManager.update(c);
    this.logger.info("onConfigurationChanged: " + JSON.stringify(param));
    this.configMgr.update(param);
    this.deno_ls.getNewOne().getProgram()?.emit();
    this.project.updateGraph();
    this.logger.info(
      "creating: " + JSON.stringify(this.project.getTypeAcquisition())
    );
    this.project.refreshDiagnostics();
  }

  create(info: tss.server.PluginCreateInfo): tss.LanguageService {
    this.logger = Logger.forPlugin(DenoPlugin.PLUGIN_NAME, info);
    this.logger.info("TDP creating started");

    this.project = info.project;

    DenoLanguageServerHost.decorate(
      this.configMgr,
      info.languageServiceHost,
      info.project,
      this.logger
    );
    this.deno_ls = DenoLanguageServer.decorate(
      this.configMgr,
      info.languageService,
      info.languageServiceHost,
      this.logger
    );

    this.logger.info("TDP created.");
    return this.deno_ls.getNewOne();
  }
}
