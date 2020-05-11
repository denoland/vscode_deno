// Copyright 2019-2020 the Deno authors. All rights reserved. MIT license.
// Copyright axetroy(铁手). All rights reserved. MIT license.

import { Readable } from "stream";
import execa from "execa";

/**
 * Return true if the specified `project` contains mod.ts file.
 * @param project
 * @param denoMod path that uniquely identifies `mod.ts`.
 */
export function isDenoProject(
  project: ts.server.Project,
  denoMod: string,
): boolean {
  return true;
  // TODO: @justjavac
  // project.markAsDirty(); // Must mark project as dirty to rebuild the program.
  // if (project.isNonTsProject()) {
  //   return false;
  // }
  // for (const fileName of project.getFileNames()) {
  //   if (fileName.endsWith(denoMod)) {
  //     return true;
  //   }
  // }
  // return false;
}

/**
 * format code using `deno fmt`
 * 
 * ```shell
 * cat file.ts | deno fmt -
 * ```
 * @param code
 * @param cwd 
 */
export async function format(code: string): Promise<string> {
  const reader = Readable.from([code]);

  const subprocess = execa("deno", ["fmt", "-"], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: "pipe",
  });

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    subprocess.on("exit", (exitCode: number) => {
      if (exitCode !== 0) {
        reject(new Error(stderr));
      } else {
        resolve(stdout);
      }
    });
    subprocess.on("error", (err: Error) => {
      reject(err);
    });
    subprocess.stdout.on("data", (data: Buffer) => {
      stdout += data;
    });

    subprocess.stderr.on("data", (data: Buffer) => {
      stderr += data;
    });

    subprocess.stdin && reader.pipe(subprocess.stdin);
  });
}
