import { TDPConfigMgr } from "./config";
import { Logger } from "./logger";
import tss from "typescript/lib/tsserverlibrary";
import { getDenoDts } from "../../core/deno";

export class DenoLanguageServer {
  private constructor(
    private original_host: tss.LanguageService,
    private new_host: tss.LanguageService
  ) {}

  static decorate(
    configMgr: TDPConfigMgr,
    service: tss.LanguageService,
    host: tss.LanguageServiceHost,
    logger: Logger
  ): DenoLanguageServer {
    const new_service: tss.LanguageService = Object.create(null);
    for (let k of Object.keys(service) as Array<keyof ts.LanguageService>) {
      const x: any = service[k];
      new_service[k] = (...args: any) => x.apply(service, args) as any;
    }

    // start decorate

    new_service.getProgram = () => {
      const old_program = service.getProgram();
      const scriptFileNames = host.getScriptFileNames();

      if (configMgr.getPluginConfig()?.enable) {
        // Get typescript declaration File
        const dtsFiles = [getDenoDts(!!configMgr.getProjectConfig()?.unstable)];
        const iterator = new Set(dtsFiles).entries();
        for (const [, filepath] of iterator) {
          scriptFileNames.push(filepath);
        }
      }

      logger.info("getProgram: " + JSON.stringify(scriptFileNames));

      const new_program = tss.createProgram({
        rootNames: scriptFileNames,
        options: host.getCompilationSettings(),
        oldProgram: old_program,
      });
      return new_program;
    };

    // end decorate

    return new DenoLanguageServer(service, new_service);
  }
  getOriginalOne(): tss.LanguageService {
    return this.original_host;
  }
  getNewOne(): tss.LanguageService {
    return this.new_host;
  }
}
