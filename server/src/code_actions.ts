export type Command = {
  title: string;
  command: string;
};

export enum DiagnosticCode {
  InvalidRelativeImport = 10001,
  RemoteModuleNotExist = 10002,
  LocalModuleNotExist = 10003,
  InvalidImport = 10004,
}

export const FixItems: { [code: number]: Command } = {
  [DiagnosticCode.LocalModuleNotExist]: {
    title: "Create the module",
    command: "deno._create_local_module",
  },
  [DiagnosticCode.RemoteModuleNotExist]: {
    title: "Cache the module from remote",
    command: "deno._fetch_remote_module",
  },
};
