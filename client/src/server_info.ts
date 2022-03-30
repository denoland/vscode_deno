// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { InitializeResult } from "vscode-languageclient";

export class DenoServerInfo {
  readonly #fullVersion: string;

  constructor(serverInfo: InitializeResult["serverInfo"]) {
    this.#fullVersion = serverInfo?.version ?? "";
  }

  /** Gets the version with configuration and architecture. Ex: x.x.x (release, x86_64-etc) */
  get versionWithBuildInfo() {
    return this.#fullVersion;
  }

  /** Gets the version. Ex. x.x.x */
  get version() {
    return this.#fullVersion.split(" ")[0];
  }
}
