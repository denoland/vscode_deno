export interface Entry {
  type: "file" | "folder";
  value: string;
}

export interface ModContents {
  readonly update_time: string;
  readonly contents: Entry[];
}

export interface ModVersionMap {
  [key: string]: ModContents;
}

export interface ModInfo {
  readonly name: string;
  readonly description?: string;
  // this array should well sorted
  // latest version should in versions[0]
  readonly versions?: string[];
}
export type ModInfoList = ModInfo[];

export interface Registry {
  readonly REGISTRY_ID: string;
  // Allow registry don't have std module mirror
  modList(): Promise<ModInfoList>;
  modVersionList(mod: string): Promise<ModInfo>;
  modContents(mod: string, version: string[]): Promise<ModVersionMap>;
}
