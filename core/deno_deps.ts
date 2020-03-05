import * as path from "path";
import { promises as fs } from "fs";

import typescript = require("typescript");

import { getDenoDepsDir } from "./deno";
import { HashMeta } from "./hash_meta";

export type Deps = {
  url: string;
  filepath: string;
};

export type Position = {
  line: number; // zero base
  character: number; // zero base
};

export type Range = {
  start: Position;
  end: Position;
};

/**
 * Get cached dependency files
 */
export async function getAllDenoCachedDeps(): Promise<Deps[]> {
  const depsRootDir = getDenoDepsDir();
  const deps: Deps[] = [];
  const protocols = await fs.readdir(depsRootDir);

  await Promise.all(
    protocols.map(async protocol => {
      const protocolFolderpath = path.join(depsRootDir, protocol);
      const protocolStat = await fs.stat(protocolFolderpath);

      if (protocolStat.isDirectory()) {
        const origins = (await fs.readdir(protocolFolderpath)).map(v =>
          path.join(protocolFolderpath, v)
        );

        await Promise.all(
          origins.map(async origin => {
            const stat = await fs.stat(origin);

            if (!stat.isDirectory()) {
              return;
            }

            const metaFiles = (await fs.readdir(origin))
              .filter(file => file.endsWith(".metadata.json"))
              .map(file => path.join(origin, file));

            for (const metaFile of metaFiles) {
              const meta = HashMeta.create(metaFile);
              if (meta) {
                deps.push({
                  url: meta.url.href,
                  filepath: meta.destinationFilepath
                });
              }
            }
          })
        );
      }
    })
  );

  return deps;
}

export type ImportModule = {
  moduleName: string;
  location: Range;
};

export function getImportModules(ts: typeof typescript) {
  return (sourceFile: typescript.SourceFile): ImportModule[] => {
    const moduleNodes: typescript.LiteralLikeNode[] = [];

    function delint(SourceFile: typescript.SourceFile) {
      function delintNode(node: typescript.Node) {
        let moduleNode: typescript.LiteralLikeNode | null = null;

        // import('xxx')
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          const args = node.arguments;
          const isDynamicImport =
            expression.kind === ts.SyntaxKind.ImportKeyword;
          if (isDynamicImport) {
            const argv = args[0] as typescript.StringLiteral;

            if (argv && ts.isStringLiteral(argv)) {
              moduleNode = argv;
            }
          }
        }
        // import ts = require('typescript')
        else if (ts.isImportEqualsDeclaration(node)) {
          const ref = node.moduleReference;

          if (
            ts.isExternalModuleReference(ref) &&
            ref.expression &&
            ts.isStringLiteral(ref.expression)
          ) {
            moduleNode = ref.expression;
          }
        }
        // import * as from 'xx'
        // import 'xx'
        // import xx from 'xx'
        else if (ts.isImportDeclaration(node)) {
          const spec = node.moduleSpecifier;
          if (spec && ts.isStringLiteral(spec)) {
            moduleNode = spec;
          }
        }
        // export { window } from "xxx";
        // export * from "xxx";
        // export * as xxx from "xxx";
        else if (ts.isExportDeclaration(node)) {
          const exportSpec = node.moduleSpecifier;
          if (exportSpec && ts.isStringLiteral(exportSpec)) {
            moduleNode = exportSpec;
          }
        }

        if (moduleNode) {
          moduleNodes.push(moduleNode);
        }

        ts.forEachChild(node, delintNode);
      }

      delintNode(SourceFile);
    }
    // delint it
    delint(sourceFile);

    const modules: ImportModule[] = moduleNodes.map(node => {
      const numberOfSpaces = Math.abs(
        // why plus 2?
        // because `moduleNode.text` only contain the plaintext without two quotes
        // eg `import "./test"`
        node.end - node.pos - (node.text.length + 2)
      );

      const startPosition = node.pos + numberOfSpaces + 1; // +1 to remove quotes
      const endPosition = startPosition + node.text.length;

      const start = sourceFile.getLineAndCharacterOfPosition(startPosition);
      const end = sourceFile.getLineAndCharacterOfPosition(endPosition);

      const location = {
        start,
        end
      };

      return {
        moduleName: node.text,
        location
      };
    });

    return modules;
  };
}
