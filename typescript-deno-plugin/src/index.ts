import ts_module from "typescript/lib/tsserverlibrary";
import { DenoPlugin } from "./plugin";
// @ts-ignore
module.exports = function init({
  typescript,
}: {
  typescript: typeof ts_module;
}) {
  const plugin = new DenoPlugin();
  return plugin;
};
