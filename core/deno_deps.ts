import * as path from "path";
import { promises as fs } from "fs";

import typescript = require("typescript");

import { getDenoDepsDir } from "./deno";
import { HashMeta } from "./hash_meta";
import { parseCompileHint } from "./deno_type_hint";

interface Comment extends typescript.CommentRange {
  text: string;
}

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
  let protocols: string[] = [];

  try {
    protocols = await fs.readdir(depsRootDir);
  } catch (error) {
    //deno/deps directory does not exists
    if (error.code === "ENOENT") {
      return deps;
    }
  }

  await Promise.all(
    protocols.map(async (protocol) => {
      const protocolFolderPath = path.join(depsRootDir, protocol);
      const protocolStat = await fs.stat(protocolFolderPath);

      if (protocolStat.isDirectory()) {
        const origins = (await fs.readdir(protocolFolderPath)).map((v) =>
          path.join(protocolFolderPath, v)
        );

        await Promise.all(
          origins.map(async (origin) => {
            const stat = await fs.stat(origin);

            if (!stat.isDirectory()) {
              return;
            }

            const metaFiles = (await fs.readdir(origin))
              .filter((file) => file.endsWith(".metadata.json"))
              .map((file) => path.join(origin, file));

            for (const metaFile of metaFiles) {
              const meta = HashMeta.create(metaFile);
              /* istanbul ignore else */
              if (meta) {
                deps.push({
                  url: meta.url.href,
                  filepath: meta.destinationFilepath,
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

export type Hint = {
  text: string;
  range: Range;
  contentRange: Range;
};

export type ImportModule = {
  moduleName: string;
  hint?: Hint; // if import module with @deno-types="xxx" hint
  location: Range;
  leadingComments?: Comment[];
  trailingComments?: Comment[];
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
          /* istanbul ignore else */
          if (isDynamicImport) {
            const argv = args[0] as typescript.StringLiteral;

            /* istanbul ignore else */
            if (argv && ts.isStringLiteral(argv)) {
              moduleNode = argv;
            }
          }
        }
        // import ts = require('typescript')
        else if (ts.isImportEqualsDeclaration(node)) {
          const ref = node.moduleReference;

          /* istanbul ignore else */
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
          /* istanbul ignore else */
          if (ts.isStringLiteral(spec)) {
            moduleNode = spec;
          }
        }
        // export { window } from "xxx";
        // export * from "xxx";
        // export * as xxx from "xxx";
        else if (ts.isExportDeclaration(node)) {
          const exportSpec = node.moduleSpecifier;
          /* istanbul ignore else */
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

    const text = sourceFile.getFullText();

    const getComments = (
      node: typescript.Node,
      isTrailing: boolean
    ): Comment[] | undefined => {
      /* istanbul ignore else */
      if (node.parent) {
        const nodePos = isTrailing ? node.end : node.pos;
        const parentPos = isTrailing ? node.parent.end : node.parent.pos;

        if (
          node.parent.kind === ts.SyntaxKind.SourceFile ||
          nodePos !== parentPos
        ) {
          const comments = isTrailing
            ? ts.getTrailingCommentRanges(sourceFile.text, nodePos)
            : ts.getLeadingCommentRanges(sourceFile.text, nodePos);

          if (Array.isArray(comments)) {
            return comments.map((v) => {
              const target: Comment = {
                ...v,
                text: text.substring(v.pos, v.end),
              };

              return target;
            });
          }

          return undefined;
        }
      }
    };

    const modules: ImportModule[] = sourceFile.typeReferenceDirectives
      .map((directive) => {
        const start = sourceFile.getLineAndCharacterOfPosition(directive.pos);
        const end = sourceFile.getLineAndCharacterOfPosition(directive.end);

        const module: ImportModule = {
          moduleName: directive.fileName,
          location: { start, end },
        };

        return module;
      })
      .concat(
        moduleNodes.map((node) => {
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
            end,
          };

          const leadingComments = getComments(node.parent, false);
          const trailingComments = getComments(node.parent, true);

          const module: ImportModule = {
            moduleName: node.text,
            location,
          };

          if (trailingComments) {
            module.trailingComments = trailingComments;
          }

          if (leadingComments) {
            module.leadingComments = leadingComments;
            // get the last comment
            const comment =
              module.leadingComments[module.leadingComments.length - 1];

            const hint = parseCompileHint(sourceFile, comment);

            module.hint = hint;
          }

          return module;
        })
      );

    return modules;
  };
}
