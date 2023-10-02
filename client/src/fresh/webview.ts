// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as vscode from "vscode";
import { getAllRoutes } from "./getRoutes";

export class FreshRouteViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) {}
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext<unknown>,
    token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,

      localResourceRoots: [
        this._extensionUri,
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "colorSelected": {
          vscode.window.activeTextEditor?.insertSnippet(
            new vscode.SnippetString(`#${data.value}`),
          );
          break;
        }
        case "update": {
          const routes = await getAllRoutes();
          webviewView.webview.postMessage({
            type: "setRoutes",
            value: routes,
          });
          break;
        }
        case "open": {
          // open in editor
          const projectPath = vscode.workspace.workspaceFolders?.[0].uri;
          if (!projectPath) {
            return;
          }
          const uri = vscode.Uri.joinPath(projectPath, "routes", data.value);

          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc);

          break;
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const freshSubFolder = "fresh";
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "media",
        freshSubFolder,
        "main.js",
      ),
    );

    // Do the same for the stylesheet.
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "media",
        freshSubFolder,
        "vscode.css",
      ),
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "media",
        freshSubFolder,
        "main.css",
      ),
    );

    const nonce = "Hogehoge";

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Fresh URL Matcher</title>
			</head>
			<body>
        <svg viewBox="0 0 24 25" fill="none" display="none" xmlns="http://www.w3.org/2000/svg">
          <symbol id="icon-path">
            <path opacity="0.5" fill-rule="evenodd" clip-rule="evenodd" d="M12 2.5C10.284 2.5 8.904 3.88 6.142 6.642C3.381 9.404 2 10.784 2 12.5C2 14.216 3.38 15.596 6.142 18.358C8.904 21.119 10.284 22.5 12 22.5C13.716 22.5 15.096 21.12 17.858 18.358C20.619 15.596 22 14.216 22 12.5C22 10.784 20.62 9.404 17.858 6.642C15.096 3.881 13.716 2.5 12 2.5Z" fill="#61FF97"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12.786 8.98701C12.9221 8.84195 13.1102 8.75688 13.309 8.75051C13.5077 8.74413 13.7009 8.81697 13.846 8.95301L16.513 11.453C16.5878 11.5232 16.6474 11.6079 16.6881 11.702C16.7289 11.796 16.7499 11.8975 16.7499 12C16.7499 12.1025 16.7289 12.204 16.6881 12.2981C16.6474 12.3921 16.5878 12.4769 16.513 12.547L13.846 15.047C13.7003 15.1796 13.5083 15.2496 13.3115 15.2419C13.1146 15.2341 12.9288 15.1492 12.794 15.0055C12.6592 14.8618 12.5864 14.6709 12.5913 14.4739C12.5962 14.277 12.6783 14.0899 12.82 13.953L14.103 12.75H10.667C10.333 12.75 9.822 12.85 9.42 13.122C9.057 13.367 8.75 13.765 8.75 14.5C8.75 14.6989 8.67098 14.8897 8.53033 15.0303C8.38968 15.171 8.19891 15.25 8 15.25C7.80109 15.25 7.61032 15.171 7.46967 15.0303C7.32902 14.8897 7.25 14.6989 7.25 14.5C7.25 13.235 7.832 12.383 8.58 11.878C9.289 11.4 10.112 11.25 10.667 11.25H14.103L12.82 10.047C12.6749 9.91094 12.5899 9.72283 12.5835 9.52405C12.5771 9.32527 12.65 9.13209 12.786 8.98701Z" fill="#61FF97"/>
          </symbol>
          <symbol id="icon-special">
            <path opacity="0.5" d="M2 12.5C2 7.786 2 5.429 3.464 3.964C4.93 2.5 7.286 2.5 12 2.5C16.714 2.5 19.071 2.5 20.535 3.964C22 5.43 22 7.786 22 12.5C22 17.214 22 19.571 20.535 21.035C19.072 22.5 16.714 22.5 12 22.5C7.286 22.5 4.929 22.5 3.464 21.035C2 19.572 2 17.214 2 12.5Z" fill="#B76FFF"/>
            <path d="M13.488 6.94601C13.68 6.99757 13.8436 7.12322 13.943 7.29534C14.0423 7.46747 14.0693 7.672 14.018 7.86401L11.43 17.524C11.4045 17.6192 11.3604 17.7083 11.3004 17.7865C11.2404 17.8646 11.1656 17.9301 11.0803 17.9793C10.9079 18.0787 10.7032 18.1056 10.511 18.054C10.3189 18.0024 10.1551 17.8766 10.0557 17.7043C9.95628 17.5319 9.92943 17.3272 9.98101 17.135L12.569 7.47601C12.5945 7.38075 12.6386 7.29146 12.6987 7.21324C12.7587 7.13503 12.8336 7.06943 12.9191 7.0202C13.0045 6.97097 13.0989 6.93908 13.1967 6.92635C13.2945 6.91362 13.3938 6.9203 13.489 6.94601H13.488ZM14.97 8.97001C15.1106 8.82956 15.3013 8.75067 15.5 8.75067C15.6988 8.75067 15.8894 8.82956 16.03 8.97001L16.239 9.17801C16.874 9.81301 17.404 10.343 17.768 10.82C18.152 11.324 18.422 11.856 18.422 12.5C18.422 13.144 18.152 13.676 17.768 14.18C17.404 14.657 16.874 15.187 16.238 15.822L16.03 16.03C15.9613 16.1037 15.8785 16.1628 15.7865 16.2038C15.6945 16.2448 15.5952 16.2668 15.4945 16.2686C15.3938 16.2704 15.2938 16.2519 15.2004 16.2141C15.107 16.1764 15.0222 16.1203 14.951 16.0491C14.8798 15.9778 14.8236 15.893 14.7859 15.7996C14.7482 15.7062 14.7296 15.6062 14.7314 15.5055C14.7332 15.4048 14.7552 15.3055 14.7962 15.2135C14.8372 15.1215 14.8963 15.0387 14.97 14.97L15.141 14.798C15.823 14.116 16.28 13.658 16.575 13.27C16.858 12.9 16.922 12.684 16.922 12.5C16.922 12.316 16.858 12.1 16.575 11.73C16.28 11.343 15.823 10.884 15.141 10.202L14.97 10.03C14.8296 9.88939 14.7507 9.69876 14.7507 9.50001C14.7507 9.30126 14.8296 9.11064 14.97 8.97001ZM7.97001 8.97001C8.11218 8.83753 8.30023 8.76541 8.49453 8.76884C8.68883 8.77227 8.87422 8.85098 9.01163 8.98839C9.14904 9.12581 9.22776 9.31119 9.23119 9.50549C9.23461 9.69979 9.16249 9.88784 9.03001 10.03L8.85901 10.202C8.17701 10.884 7.72101 11.342 7.42501 11.73C7.14201 12.1 7.07901 12.316 7.07901 12.5C7.07901 12.684 7.14201 12.9 7.42501 13.27C7.72101 13.657 8.17701 14.116 8.85901 14.798L9.03101 14.97C9.10261 15.0392 9.15971 15.122 9.19897 15.2135C9.23823 15.3051 9.25887 15.4035 9.25969 15.5031C9.26051 15.6027 9.24149 15.7014 9.20373 15.7936C9.16598 15.8857 9.11025 15.9694 9.0398 16.0398C8.96935 16.1102 8.88558 16.1658 8.79339 16.2035C8.7012 16.2412 8.60243 16.2601 8.50285 16.2592C8.40327 16.2583 8.30486 16.2376 8.21338 16.1982C8.12189 16.1589 8.03916 16.1017 7.97001 16.03L7.76201 15.822C7.12601 15.187 6.59601 14.657 6.23201 14.18C5.84801 13.676 5.57901 13.144 5.57901 12.5C5.57901 11.856 5.84901 11.324 6.23201 10.82C6.59601 10.343 7.12601 9.81301 7.76201 9.17801L7.97001 8.97001Z" fill="#B76FFF"/>
          </symbol>
        </svg>

        <svg width="20" height="21" viewBox="0 0 20 21" fill="none" display="none" xmlns="http://www.w3.org/2000/svg">
          <symbol id="icon-external">
            <path d="M13.0333 6.35417H10.015V4.6875H15.8483V10.5208H14.1817V7.5625L10.0867 11.6575L8.90833 10.4792L13.0333 6.35417Z" fill="currentColor"/>
            <path d="M9.15167 6.3125H4.15167V16.3125H14.1517V11.3125H12.485V14.6458H5.81834V7.97917H9.15167V6.3125Z" fill="currentColor"/>
          </symbol>
        </svg>

        <input type="text" id="UrlMatcher" class="path-input" placeholder="Test a URL (Example: /books/123 )">

        <ul class="route-list">
				</ul>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}
