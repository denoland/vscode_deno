import ts_module, {
    LanguageServiceHost,
} from "typescript/lib/tsserverlibrary";
import { Logger } from "logger";

export default function resolveTypeReferenceDirectivesWrapper(tsLsHost: LanguageServiceHost, config: any, logger: Logger) {
    const originalResolveTypeReferenceDirectives = tsLsHost.resolveTypeReferenceDirectives;
    if (!originalResolveTypeReferenceDirectives) {
        return;
    }

    const resolveTypeReferenceDirectives: typeof tsLsHost.resolveTypeReferenceDirectives = (
        typeDirectiveNames: string[],
        containingFile: string,
        redirectedReference: ts_module.ResolvedProjectReference | undefined,
        options: ts_module.CompilerOptions,
      ): (ts_module.ResolvedTypeReferenceDirective | undefined)[] => {
        const ret = originalResolveTypeReferenceDirectives.call(
          tsLsHost,
          typeDirectiveNames,
          containingFile,
          redirectedReference,
          options,
        );

        if (!config.enable) {
          logger.info("plugin disabled.");
          return ret;
        }

        return ret;
      };

    return resolveTypeReferenceDirectives;
}