import ts from "typescript/lib/tsserverlibrary";

import { parseCompileHint } from "./deno_type_hint";

interface Comment extends ts.CommentRange {
  text: string;
}

export type Position = {
  line: number; // zero base
  character: number; // zero base
};

export type Range = {
  start: Position;
  end: Position;
};

export type Hint = {
  text: string;
  range: Range;
  contentRange: Range;
};

export type ImportModule = {
  moduleName: string;
  hint?: Hint; // if import module with @deno-types="xxx" hint
  location: Range;
  start: number;
  length: number;
  leadingComments?: Comment[];
  trailingComments?: Comment[];
};

export function getImportModules(sourceFile: ts.SourceFile): ImportModule[] {
  const moduleNodes: ts.LiteralLikeNode[] = [];

  function delint(SourceFile: ts.SourceFile) {
    function delintNode(node: ts.Node) {
      let moduleNode: ts.LiteralLikeNode | null = null;

      // import('xxx')
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const args = node.arguments;
        const isDynamicImport = expression.kind === ts.SyntaxKind.ImportKeyword;
        /* istanbul ignore else */
        if (isDynamicImport) {
          const argv = args[0] as ts.StringLiteral;

          /* istanbul ignore else */
          if (argv && ts.isStringLiteral(argv)) {
            moduleNode = argv;
          }
        }
      } // import ts = require('ts')
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
      } // import * as from 'xx'
      // import 'xx'
      // import xx from 'xx'
      else if (ts.isImportDeclaration(node)) {
        const spec = node.moduleSpecifier;
        /* istanbul ignore else */
        if (ts.isStringLiteral(spec)) {
          moduleNode = spec;
        }
      } // export { window } from "xxx";
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

  const text: string = sourceFile.getFullText();

  const getComments = (
    node: ts.Node,
    isTrailing: boolean,
  ): Comment[] | undefined => {
    /* istanbul ignore else */
    if (node.parent) {
      const nodePos: number = isTrailing ? node.end : node.pos;
      const parentPos: number = isTrailing ? node.parent.end : node.parent.pos;

      if (
        node.parent.kind === ts.SyntaxKind.SourceFile ||
        nodePos !== parentPos
      ) {
        const comments: ts.CommentRange[] | undefined = isTrailing
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
    .map((directive: ts.FileReference) => {
      const start = sourceFile.getLineAndCharacterOfPosition(directive.pos);
      const end = sourceFile.getLineAndCharacterOfPosition(directive.end);

      const module: ImportModule = {
        moduleName: directive.fileName,
        location: { start, end },
        start: directive.pos,
        length: directive.end - directive.pos,
      };

      return module;
    })
    .concat(
      moduleNodes.map((node) => {
        const numberOfSpaces = Math.abs(
          // why plus 2?
          // because `moduleNode.text` only contain the plaintext without two quotes
          // eg `import "./test"`
          node.end - node.pos - (node.text.length + 2),
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
          start: startPosition,
          length: endPosition - startPosition,
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
      }),
    );

  return modules;
}
