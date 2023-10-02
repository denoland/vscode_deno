// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as vscode from "vscode";

async function writeFile(newFile: string, body: string) {
  // check if file exists
  let fileExists;
  try {
    fileExists = await vscode.workspace.fs.stat(
      vscode.Uri.file(newFile),
    );
  } catch (_error) {
    // do nothing
  }
  if (fileExists) {
    vscode.window.showErrorMessage("File already exists");
    throw new Error("File already exists");
  }

  vscode.workspace.fs.writeFile(
    vscode.Uri.file(newFile),
    new Uint8Array(Buffer.from(body)),
  );

  vscode.window.showInformationMessage("File Created");
}

function kebabToCamelCase(str: string) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function snakeToCamelCase(str: string) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function camelizeWhatever(str: string) {
  return capitalizeFirstLetter(snakeToCamelCase(kebabToCamelCase(str)));
}

interface Route {
  label: string;
  body: string;
}

const routes: Route[] = [
  {
    label: "Simple JSX Page",
    body:
      `// Document https://fresh.deno.dev/docs/getting-started/create-a-route

export default function __FILENAME__() {
  return (
    <main>
      <h1>__FILENAME__</h1>
      <p>This is the about page.</p>
    </main>
  );
}`,
  },
  {
    label: "Dynamic route",
    body:
      `// Document https://fresh.deno.dev/docs/getting-started/dynamic-routes

import { PageProps } from "$fresh/server.ts";

export default function __FILENAME__(props: PageProps) {
  const { name } = props.params;
  return (
    <main>
      <p>Greetings to you, {name}!</p>
    </main>
  );
}`,
  },
  {
    label: "Handler route",
    body: `// Document https://fresh.deno.dev/docs/concepts/routes#handler-route

import { HandlerContext, Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  GET(_req: Request, _ctx: HandlerContext) {
    return new Response("Hello World");
  },
};`,
  },
];

const asyncRoutes: Route[] = [
  {
    label: "Async component route with defineHelper (Recommended)",
    body: `// Document https://fresh.deno.dev/docs/concepts/routes#define-helper

import { defineRoute } from "$fresh/server.ts";

export default defineRoute(async (req, ctx) => {
  // const data = await loadData();
  const data = { name: "World" };

  return (
    <div class="page">
      <h1>Hello {data.name}</h1>
    </div>
  );
});`,
  },
  {
    label: "Mixed handler and component route",
    body:
      `// Document https://fresh.deno.dev/docs/concepts/routes#mixed-handler-and-component-route

import { Handlers, PageProps } from "$fresh/server.ts";

interface Data {
  foo: number;
}

export const handler: Handlers<Data> = {
  async GET(_req, ctx) {
    // const value = await loadFooValue();
    return ctx.render({ foo: 1 });
  },
};

export default function __FILENAME__(props: PageProps<Data>) {
  return <p>foo is: {props.data.foo}</p>;
}`,
  },
  {
    label: "Async component route",
    body: `// Document https://fresh.deno.dev/docs/concepts/routes#handler-route

import { RouteContext } from "$fresh/server.ts";
  
  export default async function __FILENAME__(req: Request, ctx: RouteContext) {
  // const value = await loadFooValue();
  return <p>foo is: {1}</p>;
}`,
  },
];

function addTsxExtensionIfMissing(fileName: string) {
  if (fileName.endsWith(".tsx")) {
    return fileName;
  }
  return fileName + ".tsx";
}

export async function generateRoute(uri: vscode.Uri) {
  if (!uri) {
    vscode.window.showErrorMessage(
      "Please left click on a folder in the explorer and try again from context menu",
    );
    return;
  }

  const fileName = await vscode.window.showInputBox({
    prompt: "Enter file name",
    placeHolder: "index.tsx",
    value: "index.tsx",
  });
  if (!fileName) {
    return;
  }

  const newFile = uri.fsPath + "/" + addTsxExtensionIfMissing(fileName);
  const optAsync = await vscode.window.showQuickPick([
    "No",
    "Yes",
  ], {
    placeHolder: "Do you need async route? (example: data fetching)",
  });
  if (!optAsync) {
    return;
  }

  let body = "";

  if (optAsync === "Yes") {
    body = (await vscode.window.showQuickPick(asyncRoutes, {
      placeHolder: "Select a snippet",
    }))?.body ?? "";
  } else {
    body = (await vscode.window.showQuickPick(routes, {
      placeHolder: "Select a snippet",
    }))?.body ?? "";
  }
  if (!body) {
    return;
  }

  body = body.replace(
    /__FILENAME__/g,
    camelizeWhatever(fileName.replace(".tsx", "")),
  );

  try {
    await writeFile(newFile, body);
  } catch (error: unknown) {
    if (error instanceof Error) {
      vscode.window.showErrorMessage(error.message);
    }
  }
}

async function generateFile(
  uri: vscode.Uri,
  body: string,
  defaultFileName = "index.tsx",
) {
  if (!uri) {
    vscode.window.showErrorMessage(
      "Please left click on a folder in the explorer and try again from context menu",
    );
    return;
  }

  const fileName = await vscode.window.showInputBox({
    prompt: "Enter file name",
    placeHolder: defaultFileName,
    value: defaultFileName,
  });

  if (!fileName) {
    return;
  }

  const newFile = uri.fsPath + "/" + addTsxExtensionIfMissing(fileName);

  const nameForClass = camelizeWhatever(fileName.split(".")[0]);
  body = body.replace(/__FILENAME__/g, nameForClass);

  try {
    await writeFile(newFile, body);
  } catch (error: unknown) {
    if (error instanceof Error) {
      vscode.window.showErrorMessage(error.message);
    }
  }
}

export async function generateLayout(uri: vscode.Uri) {
  const body = `// Document https://fresh.deno.dev/docs/concepts/layouts

import { LayoutProps } from "$fresh/server.ts";

export default function Layout({ Component, state }: LayoutProps) {
  return (
    <div class="layout">
      <Component />
    </div>
  );
}`;

  await generateFile(uri, body, "_layout.tsx");
}

export async function generateComponent(uri: vscode.Uri) {
  const body = `import { JSX } from "preact";

export function __FILENAME__(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props}>
      <h1>__FILENAME__</h1>
    </div>
  );
}`;

  await generateFile(uri, body);
}

export async function generateIsland(uri: vscode.Uri) {
  const body = `// Document https://fresh.deno.dev/docs/concepts/islands

import type { Signal } from "@preact/signals";

interface __FILENAME__Props {
  count: Signal<number>;
}

export default function __FILENAME__(props: __FILENAME__Props) {
  return (
    <div>
      <button onClick={() => props.count.value -= 1}>-1</button>
      <p>{props.count}</p>
      <button onClick={() => props.count.value += 1}>+1</button>
    </div>
  );
}`;

  await generateFile(uri, body);
}
