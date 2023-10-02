// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as vscode from "vscode";
import * as fs from "fs";
import { extname } from "path";

// from Fresh source
// https://github.com/denoland/fresh/blob/main/src/server/context.ts#L1131
/** Transform a filesystem URL path to a `path-to-regex` style matcher. */
function pathToPattern(path: string) {
  const parts = path.split("/");
  if (parts[parts.length - 1] === "index") {
    if (parts.length === 1) {
      return "/";
    }
    parts.pop();
  }

  let route = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Case: /[...foo].tsx
    if (part.startsWith("[...") && part.endsWith("]")) {
      route += `/:${part.slice(4, part.length - 1)}*`;
      continue;
    }

    // Route groups like /foo/(bar) should not be included in URL
    // matching. They are transparent and need to be removed here.
    // Case: /foo/(bar) -> /foo
    // Case: /foo/(bar)/bob -> /foo/bob
    // Case: /(foo)/bar -> /bar
    if (part.startsWith("(") && part.endsWith(")")) {
      continue;
    }

    // Disallow neighbouring params like `/[id][bar].tsx` because
    // it's ambiguous where the `id` param ends and `bar` begins.
    if (part.includes("][")) {
      throw new SyntaxError(
        `Invalid route pattern: "${path}". A parameter cannot be followed by another parameter without any characters in between.`,
      );
    }

    // Case: /[[id]].tsx
    // Case: /[id].tsx
    // Case: /[id]@[bar].tsx
    // Case: /[id]-asdf.tsx
    // Case: /[id]-asdf[bar].tsx
    // Case: /asdf[bar].tsx
    let pattern = "";
    let groupOpen = 0;
    let optional = false;
    for (let j = 0; j < part.length; j++) {
      const char = part[j];
      if (char === "[") {
        if (part[j + 1] === "[") {
          // Disallow optional dynamic params like `foo-[[bar]]`
          if (part[j - 1] !== "/" && !!part[j - 1]) {
            throw new SyntaxError(
              `Invalid route pattern: "${path}". An optional parameter needs to be a full segment.`,
            );
          }
          groupOpen++;
          optional = true;
          pattern += "{/";
          j++;
        }
        pattern += ":";
        groupOpen++;
      } else if (char === "]") {
        if (part[j + 1] === "]") {
          // Disallow optional dynamic params like `[[foo]]-bar`
          if (part[j + 2] !== "/" && !!part[j + 2]) {
            throw new SyntaxError(
              `Invalid route pattern: "${path}". An optional parameter needs to be a full segment.`,
            );
          }
          groupOpen--;
          pattern += "}?";
          j++;
        }
        if (--groupOpen < 0) {
          throw new SyntaxError(`Invalid route pattern: "${path}"`);
        }
      } else {
        pattern += char;
      }
    }

    route += (optional ? "" : "/") + pattern;
  }

  // Case: /(group)/index.tsx
  if (route === "") {
    route = "/";
  }

  return route;
}

interface Routes {
  route: string;
  file: string;
}

interface RouteWithPattern extends Routes {
  pattern: string;
}

export async function getAllRoutes() {
  const currentProject = vscode.workspace.workspaceFolders?.[0];
  const projectPath = currentProject?.uri.fsPath;

  if (!projectPath) {
    return [];
  }

  const filename = `${projectPath}/fresh.gen.ts`;

  const input = await fs.promises.readFile(filename, "utf8");

  const routes: Routes[] = input.split("\n").filter((line: string) =>
    line.includes("./routes") && !line.includes("import")
  ).map((
    line: string,
  ) =>
    line.split(":")[0].trim().replace(/"/g, "").replace(/^\.\//g, "").replace(
      /^routes\//,
      "",
    )
  ).map(
    (item) => {
      return {
        file: item,
        route: item.substring(0, item.length - extname(item).length),
      };
    },
  );

  const patterns: RouteWithPattern[] = routes.map((route) => {
    const pattern = pathToPattern(route.route);
    return {
      route: route.route,
      file: route.file,
      pattern,
    };
  });

  return patterns;
}
