import { Logger } from "logger";
import tss from "typescript/lib/tsserverlibrary";

export class DenoLanguageServer {
  private constructor(
    private original_host: tss.LanguageService,
    private new_host: tss.LanguageService
  ) {}

  static decorate(
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
      logger.info("getprogram: " + JSON.stringify(host.getScriptFileNames()));

      const new_program = tss.createProgram({
        rootNames: host.getScriptFileNames().map((it) => it),
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
