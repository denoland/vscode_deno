// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.
// Copyright Google Inc. and other 'vscode-ng-language-service' contributors. All Rights Reserved.
// Use of this source code is governed by an MIT-style license that can be
// found in the LICENSE file at https://angular.io/license

import ts from "typescript/lib/tsserverlibrary";

/**
 * NOTE:
 * There are three types of `project`:
 * 1. Configured project - basically all source files that belong to a tsconfig
 * 2. Inferred project - other files that do not belong to a tsconfig
 * 3. External project - not used in this context
 * For more info, see link below.
 * https://github.com/Microsoft/TypeScript/wiki/Standalone-Server-%28tsserver%29#project-system
 */

/**
 * `ProjectService` is a singleton service for the entire lifespan of the
 * language server. This specific implementation is a very thin wrapper
 * around TypeScript's `ProjectService`. On creation, it spins up tsserver and
 * loads `typescript-deno-plugin` as a global plugin.
 * `ProjectService` is used to manage both TS document as well as HTML.
 * Using tsserver to handle non-TS files is fine as long as the ScriptKind is
 * configured correctly and `getSourceFile()` is never called on non-TS files.
 */
export class ProjectService {
  private readonly tsProjSvc: ts.server.ProjectService;

  constructor(options: ts.server.ProjectServiceOptions) {
    options.logger.info("ProjectService");
    this.tsProjSvc = new ts.server.ProjectService(options);

    this.tsProjSvc.configurePlugin({
      pluginName: "typescript-deno-plugin",
      configuration: {},
    });

    const plugins = this.tsProjSvc.globalPlugins;
    options.logger.info(plugins.join(", "));
  }

  /**
   * Open file whose contents is managed by the client
   * @param filename is absolute pathname
   * @param fileContent is a known version of the file content that is more up to date than the one
   *     on disk
   */
  openClientFile(
    fileName: string,
    fileContent?: string,
    scriptKind?: ts.ScriptKind,
    projectRootPath?: string,
  ): ts.server.OpenConfiguredProjectResult {
    return this.tsProjSvc.openClientFile(
      fileName,
      fileContent,
      scriptKind,
      projectRootPath,
    );
  }

  /**
   * Close file whose contents is managed by the client
   * @param filename is absolute pathname
   */
  closeClientFile(uncheckedFileName: string): void {
    this.tsProjSvc.closeClientFile(uncheckedFileName);
  }

  findProject(projectName: string): ts.server.Project | undefined {
    return this.tsProjSvc.findProject(projectName);
  }

  getScriptInfo(uncheckedFileName: string): ts.server.ScriptInfo | undefined {
    return this.tsProjSvc.getScriptInfo(uncheckedFileName);
  }

  /**
   * Return the default project for the specified `scriptInfo` if it is already
   * a configured project. If not, attempt to find a relevant config file and
   * make that project its default. This method is to ensure HTML files always
   * belong to a configured project instead of the default behavior of being in
   * an inferred project.
   * @param scriptInfo
   */
  getDefaultProjectForScriptInfo(
    scriptInfo: ts.server.ScriptInfo,
  ): ts.server.Project | undefined {
    // TODO: If in Deno path, set ScriptInfo to ts.
    return this.tsProjSvc.getDefaultProjectForFile(scriptInfo.fileName, false);
  }

  /**
   * Returns a language service for a default project created for the specified `scriptInfo`. If the
   * project does not support a language service, nothing is returned.
   */
  getDefaultLanguageService(
    scriptInfo: ts.server.ScriptInfo,
  ): ts.LanguageService | undefined {
    const project = this.getDefaultProjectForScriptInfo(scriptInfo);
    if (!project?.languageServiceEnabled) return;
    return project.getLanguageService();
  }
}
