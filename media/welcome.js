// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

(function () {
  const vscode = acquireVsCodeApi();

  const commands = document.querySelectorAll(".Command");
  for (const command of commands) {
    const msg = JSON.parse(JSON.stringify(command.dataset));
    command.addEventListener("click", () => {
      vscode.postMessage(msg);
    });
  }
})();
