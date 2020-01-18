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
