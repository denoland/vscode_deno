// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

import { around } from "./aspect";
import type { Settings } from "../../client/src/interfaces";
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
      const { enable } = getSettings(this.project);
      if (enable) {
        return [];
      } else {
        return ls.getSemanticDiagnostics(fileName);
      }
    };

    const getSyntacticDiagnostics = (fileName: string) => {
      const { enable } = getSettings(this.project);
      if (enable) {
        return [];
      } else {
        return ls.getSyntacticDiagnostics(fileName);
      }
    };

    const getSuggestionDiagnostics = (fileName: string) => {
      const { enable } = getSettings(this.project);
      if (enable) {
        return [];
      } else {
        return ls.getSuggestionDiagnostics(fileName);
      }
    };

    const getQuickInfoAtPosition = (fileName: string, position: number) => {
      const { enable } = getSettings(this.project);
      if (enable) {
        return undefined;
      } else {
        return ls.getQuickInfoAtPosition(fileName, position);
      }
    };

    const getReferencesAtPosition = (fileName: string, position: number) => {
      const { enable } = getSettings(this.project);
      if (enable) {
        return undefined;
      } else {
        return ls.getReferencesAtPosition(fileName, position);
      }
    };

    const getDefinitionAndBoundSpan = (fileName: string, position: number) => {
      const { enable } = getSettings(this.project);
      if (enable) {
        return undefined;
      } else {
        return ls.getDefinitionAndBoundSpan(fileName, position);
      }
    };

    const getCompletionsAtPosition = (
      fileName: string,
      position: number,
      options: ts.GetCompletionsAtPositionOptions | undefined,
    ) => {
      const { enable } = getSettings(this.project);
      if (enable) {
        return undefined;
      } else {
        return ls.getCompletionsAtPosition(fileName, position, options);
      }
    };

    const getDocumentHighlights = (
      fileName: string,
      position: number,
      filesToSearch: string[],
    ) => {
      const { enable } = getSettings(this.project);
      if (enable) {
        return undefined;
      } else {
        return ls.getDocumentHighlights(fileName, position, filesToSearch);
      }
    };

    return {
      ...ls,
      getSemanticDiagnostics,
      getSyntacticDiagnostics,
      getSuggestionDiagnostics,
      getQuickInfoAtPosition,
      getDocumentHighlights,
      getReferencesAtPosition,
      getDefinitionAndBoundSpan,
      getCompletionsAtPosition,
    };
  }

  onConfigurationChanged(settings: Settings): void {
    this.log(`onConfigurationChanged(${JSON.stringify(settings)})`);
    updateSettings(this.project, settings);
    this.project.refreshDiagnostics();
  }
}

function init(): ts.server.PluginModule {
  console.log("INIT typescript-deno-plugin");
  return new Plugin();
}

export = init;
