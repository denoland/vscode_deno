import { IConnection } from "vscode-languageserver";
import { WorkspaceFolder } from "vscode";

interface ISettings {
  enable: boolean;
}

// the bridge between client and server
export class Bridge {
  constructor(private connection: IConnection) {}
  // get workspace folder from client
  async getWorkspace(uri: string): Promise<any> {
    const workspaceFolder:
      | WorkspaceFolder
      | undefined = await this.connection.sendRequest(
      "getWorkspaceFolder",
      uri
    );

    return workspaceFolder;
  }
  // get workspace folder config from client
  async getWorkspaceConfig(uri: string): Promise<ISettings> {
    const config: ISettings = await this.connection.sendRequest(
      "getWorkspaceConfig",
      uri
    );

    return config;
  }
}
