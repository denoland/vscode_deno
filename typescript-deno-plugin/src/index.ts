import ts_module from "typescript/lib/tsserverlibrary";
import { DenoPlugin } from "./plugin";

module.exports = function init({
  typescript
}: {
  typescript: typeof ts_module;
}) {
  const plugin = new DenoPlugin(typescript);

  return plugin;
};
