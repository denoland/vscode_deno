export type DenoExtension =
  | ".ts"
  | ".tsx"
  | ".d.ts"
  | ".js"
  | ".jsx"
  | ".json"
  | ".wasm"
  | "";

export type DenoResolvedModule = {
  originModuleName: string;
  filepath: string;
  extension: DenoExtension;
};

export interface IModuleResolver {
  resolve(
    moduleName: string,
    originModuleName?: string,
  ): DenoResolvedModule | undefined;
}
