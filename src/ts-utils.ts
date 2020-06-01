import ts, { SourceFile, Node } from "typescript/lib/tsserverlibrary";

export function getTsUtils(languageService: ts.LanguageService): TsUtils {
  function findNode(sourceFile: ts.SourceFile, position: number) {
    function find(node: ts.Node): ts.Node | undefined {
      if (position >= node.getStart() && position < node.getEnd()) {
        return ts.forEachChild(node, find) || node;
      }
    }
    
    return find(sourceFile);
  }

  return {
    getSourceFile (fileName: string) {
      const program = languageService.getProgram();
      if (!program) {
        throw new Error('language service host does not have program!');
      }
      
      const s = program.getSourceFile(fileName);
      if (!s) {
        throw new Error('No source file: ' + fileName);
      }
      return s;
    },
    getNode (fileName: string, position: number) {
      return findNode(this.getSourceFile(fileName), position);
    },
    getNodeText(node: ts.Node, fileName: string) {
      const sourceFile = this.getSourceFile(fileName);
      const sourceText = sourceFile.text;
      return sourceText.slice(node.pos, node.end);
    },
  }
}

export interface TsUtils {
  getSourceFile(fileName: string): SourceFile;
  getNode (fileName: string, position: number): Node | undefined;
  getNodeText(node: ts.Node, fileName: string): string;
}