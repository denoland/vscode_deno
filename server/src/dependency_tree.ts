import { promises as fs } from "fs";
import * as path from "path";

import { IConnection, Position } from "vscode-languageserver";
import * as ts from "typescript";
import { URI } from "vscode-uri";

import { Bridge } from "./bridge";
import { getImportModules } from "../../core/deno_deps";
import { FileWalker } from "../../core/file_walker";
import { ImportMap } from "../../core/import_map";
import { isHttpURL } from "../../core/util";
import { Request } from "../../core/const";

interface URLDep {
  filepath: string;
  location: { start: Position; end: Position };
}

type DependencyTreeMap = { [key: string]: URLDep[] };

export class DependencyTree {
  constructor(connection: IConnection, private bridge: Bridge) {
    connection.onRequest(
      Request.analysisDependency,
      this.getDependencyTreeOfProject.bind(this)
    );
  }
  async getDependencyTreeOfProject(uriStr: string): Promise<DependencyTreeMap> {
    const folderUir = URI.parse(uriStr);
    const folder = folderUir.fsPath;

    const depsMap = new Map<string, URLDep[]>();

    const config = await this.bridge.getWorkspaceConfig(uriStr);

    const importMapFilepath = config.import_map
      ? path.isAbsolute(config.import_map)
        ? config.import_map
        : path.resolve(folder, config.import_map)
      : undefined;

    const importMap = ImportMap.create(importMapFilepath);

    const walker = FileWalker.create(folder, {
      exclude: ["node_modules", "bower_components", "vendor", /^\./],
      include: [/\.tsx?$/, /\.jsx?$/],
    });

    for await (const filepath of walker) {
      // Parse a file
      const sourceFile = ts.createSourceFile(
        filepath,
        await fs.readFile(filepath, { encoding: "utf8" }),
        ts.ScriptTarget.ESNext,
        false,
        ts.ScriptKind.TSX
      );

      const deps = getImportModules(ts)(sourceFile);

      for (const dep of deps) {
        if (!isHttpURL(dep.moduleName)) {
          dep.moduleName = importMap.resolveModule(dep.moduleName);
        }

        if (isHttpURL(dep.moduleName)) {
          const url = dep.moduleName;
          const arr = depsMap.get(url) || [];

          arr.push({ filepath, location: dep.location });

          depsMap.set(url, arr);
        }
      }
    }

    const result: DependencyTreeMap = {};

    for (const [url, files] of depsMap.entries()) {
      result[url] = files;
    }

    return result;
  }
}
