import { Registry } from "./registry";

import { DenoLand, REGISTRY_TYPE as DENOLAND_TYPE } from "./deno_land";
import { NestLand, REGISTRY_TYPE as NESTLAND_TYPE } from "./nest_land";

export const IMP_REG = /^.*?[import|export].+?from.+?['"](?<url>[0-9a-zA-Z-_@~:/.?#:&=%+]*)/;
export const VERSION_REG = /^([\w.\-_]+)$/;
export const MOD_NAME_REG = /^[\w-_]+$/;

const Registries: { [key: string]: Registry } = {
  "deno.land": new DenoLand(),
  "x.nest.land": new NestLand(),
};

export function getRegistries(): { [key: string]: Registry } {
  return { ...Registries };
}

export const SupportedRegistry = Object.keys(Registries);
export type SupportedRegistryType = DENOLAND_TYPE | NESTLAND_TYPE;

export { getKeyOfVersionMap } from "./_utils";

interface ImportUrlInfo {
  domain: string;
  module: string;
  version: string;
  path: string;
}

export function parseImportStatement(text: string): ImportUrlInfo | undefined {
  const reg_groups = text.match(IMP_REG)?.groups;
  if (!reg_groups) {
    return undefined;
  }
  const import_url = reg_groups["url"] ?? "";
  try {
    const url = new URL(import_url);
    const components = url.pathname.split("/");
    const parse = (components: string[]) => {
      const module_info = components[0].split("@");
      if (module_info.length > 1) {
        const module = module_info[0];
        const version = module_info[1].length === 0 ? "latest" : module_info[1];
        const path = "/" + components.slice(1, components.length).join("/");
        return {
          domain: url.hostname,
          module,
          version,
          path,
        };
      } else {
        const module = module_info[0];
        const version = "latest";
        const path = "/" + components.slice(1, components.length).join("/");
        return {
          domain: url.hostname,
          module,
          version,
          path,
        };
      }
    };
    if (components.length > 1) {
      const m = components[1];
      if (m === "x") {
        return parse(components.slice(2, components.length));
      } else {
        return parse(components.slice(1, components.length));
      }
    }
  } catch {
    return undefined;
  }
}
