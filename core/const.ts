export enum Request {
  getWorkspaceFolder = "getWorkspaceFolder",
  getWorkspaceConfig = "getWorkspaceConfig",
  analysisDependency = "analysisDependency",
  promptEnableImportIntelliSense = "promptEnableImportIntelliSense",
}

export enum Notification {
  init = "init",
  error = "error",
  diagnostic = "diagnostic",
}
