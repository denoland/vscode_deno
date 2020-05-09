import ts from "typescript/lib/tsserverlibrary";
import denoPkg from "typescript-deno-plugin/package.json";

import { generateHelpMessage, parseArguments } from "./utils/args";
import { createLogger } from "./logger";
import { ServerHost } from "./server_host";
import { Connection } from "./connection";

// Parse command line arguments
const options = parseArguments(process.argv);

if (options.help) {
  console.error(generateHelpMessage(process.argv));
  process.exit(0);
}

// Create a logger that logs to file. OK to emit verbose entries.
const logger = createLogger({
  logFile: options.logFile,
  logVerbosity: options.logVerbosity,
});

// ServerHost provides native OS functionality
const host = new ServerHost();

// Establish a new server that encapsulates lsp connection.
const connection = new Connection({
  host,
  logger,
  // pluginProbeLocations: resolveDenoPluginLocations(),
});

// Log initialization info
connection.info(`Deno language server process ID: ${process.pid}.`);
connection.info(`Using typescript v${ts.version} from extension bundled.`);
connection.info(
  `Using typescript-deno-plugin v${denoPkg.version} from extension bundled.`,
);
connection.info(`Log file: ${logger.getLogFileName()}`);
if (process.env.Deno_DEBUG === "true") {
  connection.info("Deno Language Service is running under DEBUG mode.");
}
if (process.env.TSC_NONPOLLING_WATCHER !== "true") {
  connection.warn(
    `Using less efficient polling watcher. Set TSC_NONPOLLING_WATCHER to true.`,
  );
}

connection.listen();
