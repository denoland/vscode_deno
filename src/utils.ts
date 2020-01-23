import { stat } from "fs";
import { promisify } from "util";
import { TextDocument } from "vscode";

export function isTypeScriptDocument(document: TextDocument) {
  return (
    document &&
    (document.languageId === "typescript" ||
      document.languageId === "typescriptreact")
  );
}

export function isJavaScriptDocument(document: TextDocument) {
  return (
    document &&
    (document.languageId === "javascript" ||
      document.languageId === "javascriptreact")
  );
}

export async function isFilepathExist(filepath: string): Promise<boolean> {
  return promisify(stat)(filepath)
    .then(() => {
      return Promise.resolve(true);
    })
    .catch(() => {
      return Promise.resolve(false);
    });
}
