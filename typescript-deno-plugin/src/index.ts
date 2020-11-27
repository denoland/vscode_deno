// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

import { around } from "./aspect";
import { Settings } from "./interfaces";
import type * as ts from "../node_modules/typescript/lib/tsserverlibrary";

/** Contains the project settings that have been provided by the extension for
 * each workspace. */
const projectSettings = new Map<string, Settings>();

/** The default settings to assume to be true until a configuration message is
 * received from the extension. */
const defaultSettings: Settings = {
  enable: false,
  config: null,
  importMap: null,
  lint: false,
  unstable: false,
};

function getSettings(project: ts.server.Project): Settings {
  return projectSettings.get(project.getProjectName()) ?? defaultSettings;
}

function updateSettings(project: ts.server.Project, settings: Settings): void {
  projectSettings.set(project.getProjectName(), settings);
  // We will update the default settings, which helps ensure that when a plugin
  // is created or re-created, we can assume what the previous settings where
  // until told otherwise.
  Object.assign(defaultSettings, settings);
}

class Plugin implements ts.server.PluginModule {
  private log = (_msg: string) => {};
  private project!: ts.server.Project;

  create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const { languageService: ls, languageServiceHost: host, project } = info;
    this.log = (msg) =>
      project.projectService.logger.info(`[typescript-deno-plugin] ${msg}`);

    this.project = project;

    // We have to "monkey patch" the language service host to strip out
    // script file names, so the language service does less when extension is
    // enabled for the workspace.
    around(host, "getScriptFileNames", (fn) => {
      const scriptFiles = fn();
      // TODO(@kitsonk) we've got to get more services enabled as this causes
      // problems with the built in language service
      
      // return this.returnIfEnabled(
      //   scriptFiles,
      //   () => [],
      // );
      return scriptFiles;
    });

    const getSemanticDiagnostics = (fileName: string) => {
      const diagnostics = ls.getSemanticDiagnostics(fileName);
      return this.returnIfEnabled(
        diagnostics,
        () => [],
      );
    };

    const getSyntacticDiagnostics = (fileName: string) => {
      const diagnostics = ls.getSyntacticDiagnostics(fileName);
      return this.returnIfEnabled(
        diagnostics,
        () => [],
      );
    };

    return {
      ...ls,
      getSemanticDiagnostics,
      getSyntacticDiagnostics,
    };
  }

  onConfigurationChanged(settings: Settings): void {
    this.log(`onConfigurationChanged(${JSON.stringify(settings)})`);
    updateSettings(this.project, settings);
    this.project.refreshDiagnostics();
  }

  /** A method that returns the first value if the plugin is _disabled_,
   * usually the original value from the proxied method, or otherwise executes
   * the supplied function and returns the value from that.
   * 
   * @param value The original value to return
   * @param fn The function that will be called if plugin is enabled.
   */
  private returnIfEnabled<T>(
    value: T,
    fn: (settings: Settings) => T,
  ): T {
    const settings = getSettings(this.project);
    if (!settings.enable) {
      return value;
    }
    return fn(settings);
  }
}

function init(): ts.server.PluginModule {
  return new Plugin();
}

export = init;
