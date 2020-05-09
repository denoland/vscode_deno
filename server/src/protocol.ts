import { NotificationType0 } from "vscode-languageserver";

export const projectLoadingNotification = {
  start: new NotificationType0<string>(
    "deno-language-service/projectLoadingStart",
  ),
  finish: new NotificationType0<string>(
    "deno-language-service/projectLoadingFinish",
  ),
};
