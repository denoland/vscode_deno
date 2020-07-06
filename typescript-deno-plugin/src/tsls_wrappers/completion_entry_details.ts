import {
  LanguageService,
  FormatCodeOptions,
  FormatCodeSettings,
  UserPreferences,
  CompletionEntryDetails,
} from "typescript/lib/tsserverlibrary";

export default function getCompletionEntryDetailsnWrapper(
  tsLs: LanguageService,
  config: any,
) {
  const getCompletionEntryDetails = (
    fileName: string,
    position: number,
    entryName: string,
    formatOptions: FormatCodeOptions | FormatCodeSettings | undefined,
    source: string | undefined,
    preferences: UserPreferences | undefined,
  ): CompletionEntryDetails | undefined => {
    const details = tsLs.getCompletionEntryDetails(
      fileName,
      position,
      entryName,
      formatOptions,
      source,
      preferences,
    );

    if (!config.enable) {
      return details;
    }

    if (details) {
      if (details.codeActions && details.codeActions.length) {
        for (const ca of details.codeActions) {
          for (const change of ca.changes) {
            if (!change.isNewFile) {
              for (const tc of change.textChanges) {
                tc.newText = tc.newText.replace(
                  /^(import .* from ['"])(\..*)(['"];\n)/i,
                  "$1$2.ts$3",
                );
              }
            }
          }
        }
      }
    }

    return details;
  };

  return getCompletionEntryDetails;
}
