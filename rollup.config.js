import * as fs from "fs";
import commonjs from "@rollup/plugin-commonjs";

module.exports = [
  {
    input: "client/out/extension.js",
    output: {
      file: "dist/client/index.js",
      format: "cjs",
      exports: "named",
    },
    external: [
      "path",
      "vscode",
      "vscode-languageclient",
    ],
    plugins: [
      commonjs(),
    ],
  },
  {
    input: "server/out/server.js",
    output: {
      file: "dist/server/index.js",
      format: "cjs",
      exports: "named",
    },
    external: [
      "fs",
      "path",
      // 'typescript/lib/tsserverlibrary',
      "vscode-languageserver",
      "vscode-uri",
    ],
    plugins: [
      commonjs({
        ignore: [
          // leave require statements unconverted.
          "conditional-runtime-dependency",
        ],
      }),
    ],
  },
];
