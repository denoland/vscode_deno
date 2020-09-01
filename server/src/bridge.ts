import { IConnection } from "vscode-languageserver";
import { WorkspaceFolder } from "vscode";

import { Request } from "../../core/const";

type Configuration = {
  enable: boolean;
  import_map?: string;
};

/**
 * The bridge between client and server
 */
export class Bridge {
  constructor(private connection: IConnection) {}
  /**
   * Get workspace folder from client
   * @param uri
   */
  async getWorkspace(uri: string): Promise<WorkspaceFolder | void> {
    const workspaceFolder:
      | WorkspaceFolder
      | undefined = await this.connection.sendRequest(
      Request.getWorkspaceFolder,
      uri
    );

    return workspaceFolder;
  }
  /**
   * Get workspace folder config from client
   * @param uri
   */
  async getWorkspaceConfig(uri: string): Promise<Configuration> {
    const config: Configuration = await this.connection.sendRequest(
      Request.getWorkspaceConfig,
      uri
    );

    return config;
  }
}
