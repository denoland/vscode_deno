// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.

import { NotificationType0 } from "vscode-languageclient";

export const projectLoadingNotification = {
  start: new NotificationType0<string>(
    "deno-language-service/projectLoadingStart",
  ),
  finish: new NotificationType0<string>(
    "deno-language-service/projectLoadingFinish",
  ),
};
