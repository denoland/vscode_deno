export enum Request {
  getWorkspaceFolder = "getWorkspaceFolder",
  getWorkspaceConfig = "getWorkspaceConfig",
  analysisDependency = "analysisDependency"
}

export enum Notification {
  init = "init",
  error = "error",
  diagnostic = "diagnostic"
}
