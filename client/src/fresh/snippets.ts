import * as vscode from "vscode";

export const simpleRoute = new vscode.CompletionItem("Fresh - Simple Route");
simpleRoute.insertText = new vscode.SnippetString(
  [
    "export default function ${1:Page}(props: PageProps) {",
    "	return (",
    "		<main>",
    "			<h1>About</h1>",
    "			<p>This is the about page.</p>",
    "		</main>",
    "	);",
    "});",
  ].join("\n"),
);

export const customHandlers = new vscode.CompletionItem(
  "Fresh - Custom Handlers",
);
customHandlers.insertText = new vscode.SnippetString([
  "export const handler: Handlers = {",
  "	async GET(_req, ctx) {",
  "    return await ctx.render();",
  "  },",
  "};",
].join("\n"));

export const layout = new vscode.CompletionItem(
  "Fresh - Layouts",
);

layout.insertText = new vscode.SnippetString([
  "export default function Layout({ Component, state }: LayoutProps) {",
  "	// do something with state here",
  "	return (",
  '		<div class="layout">',
  "			<Component />",
  "		</div>",
  "	);",
  "}",
].join("\n"));

export const defineRoute = new vscode.CompletionItem(
  "Fresh - Define Route",
);
defineRoute.insertText = new vscode.SnippetString([
  "export default defineRoute(async (req, ctx) => {",
  "	return (",
  "		<div></div>",
  "	);",
  "});",
].join("\n"));

export const defineLayout = new vscode.CompletionItem(
  "Fresh - Define Layout",
);
defineLayout.insertText = new vscode.SnippetString([
  "export default defineLayout(async (req, ctx) => {",
  "	return (",
  "		<div>",
  "			<ctx.Component />",
  "		</div>",
  "	);",
  "});",
].join("\n"));
