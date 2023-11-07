// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { InitializeResult } from "vscode-languageclient";
import { UpgradeAvailable } from "./types";

export class DenoServerInfo {
  readonly #fullVersion: string;
  upgradeAvailable: UpgradeAvailable | null;

  constructor(serverInfo: InitializeResult["serverInfo"]) {
    this.#fullVersion = serverInfo?.version ?? "";
    this.upgradeAvailable = null;
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
