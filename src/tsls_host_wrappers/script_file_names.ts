import {
    LanguageServiceHost,
} from "typescript/lib/tsserverlibrary";
import { Logger } from "logger";
import { getDenoDtsPath } from "../utils";

export default function getScriptFileNamesWrapper(tsLsHost: LanguageServiceHost, config: any, logger: Logger) {
  const originalGetScriptFileNames = tsLsHost.getScriptFileNames;
  if (!config.enable) {
    return originalGetScriptFileNames;
  }

  const getScriptFileNames: typeof tsLsHost.getScriptFileNames = () => {
    const originalScriptFileNames = originalGetScriptFileNames.call(
      tsLsHost,
    );

    const scriptFileNames = [...originalScriptFileNames];

    const libDenoDts = getDenoDtsPath("lib.deno.d.ts");
    if (!libDenoDts) {
      logger.info(`Can not load lib.deno.d.ts from ${libDenoDts}.`);
      return scriptFileNames;
    }
    scriptFileNames.push(libDenoDts);

    const libWebworkerDts = getDenoDtsPath("lib.webworker.d.ts");
    if (!libWebworkerDts) {
      logger.info(
        `Can not load lib.webworker.d.ts from ${libWebworkerDts}.`,
      );
      return scriptFileNames;
    }
    scriptFileNames.push(libWebworkerDts);

    return scriptFileNames;
  };

  return getScriptFileNames;
}