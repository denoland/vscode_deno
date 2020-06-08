import {
  LanguageServiceHost,
  CompilerOptions,
} from "typescript/lib/tsserverlibrary";
import merge from "merge-deep";

export default function getCompilationSettingsWrapper(
  tsLsHost: LanguageServiceHost,
  config: any,
  OPTIONS: CompilerOptions,
  OPTIONS_OVERWRITE_BY_DENO: CompilerOptions,
) {
  const originalGetCompilationSettings = tsLsHost.getCompilationSettings;

  if (!config.enable) {
    return originalGetCompilationSettings;
  }

  const getCompilationSettings: typeof tsLsHost.getCompilationSettings = () => {
    const projectConfig = originalGetCompilationSettings.call(
      tsLsHost,
    );

    if (!config.enable) {
      return projectConfig;
    }

    const compilationSettings = merge(
      merge(OPTIONS, projectConfig),
      OPTIONS_OVERWRITE_BY_DENO,
    );
    return compilationSettings;
  };

  return getCompilationSettings;
}
