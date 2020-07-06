import { CodeFixAction } from "typescript/lib/tsserverlibrary";

export interface CodeFixRegistration {
  errorCodes: readonly number[];
  // fixIds: readonly string[],
  replaceCodeActions: (codeFixActions: readonly CodeFixAction[]) => void;
}

export const errorCodeToFixes: Map<
  number,
  Pick<CodeFixRegistration, "replaceCodeActions">[]
> = new Map();

export function registerCodeFix(reg: CodeFixRegistration) {
  for (const error of reg.errorCodes) {
    if (errorCodeToFixes.has(error)) {
      errorCodeToFixes.get(error)!.push(reg);
    } else {
      errorCodeToFixes.set(error, [reg]);
    }
  }
}
