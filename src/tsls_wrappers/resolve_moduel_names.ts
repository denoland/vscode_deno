import {
  LanguageService,
  FormatCodeSettings,
  UserPreferences,
  CodeFixAction,
} from "typescript/lib/tsserverlibrary";
import { errorCodeToFixes } from "../codefix_provider";

export default function getCodeFixesAtPositionWrapper(tsLs: LanguageService) {
  const getCodeFixesAtPosition = (
    fileName: string,
    start: number,
    end: number,
    errorCodes: readonly number[],
    formatOptions: FormatCodeSettings,
    preferences: UserPreferences,
  ): readonly CodeFixAction[] => {
    const codeFixActions = tsLs.getCodeFixesAtPosition(
      fileName,
      start,
      end,
      errorCodes,
      formatOptions,
      preferences,
    );

    for (const errorCode of errorCodes) {
      const fixes = errorCodeToFixes.get(errorCode);
      if (fixes == null) continue;

      for (const fix of fixes) {
        fix.replaceCodeActions(codeFixActions);
      }
    }

    return codeFixActions;
  };

  return getCodeFixesAtPosition;
}
