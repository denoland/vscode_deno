import got from "got";
import { Key, pathToRegexp } from "path-to-regexp";
import * as yup from "yup";
import { DiskCache } from "./diskcache";

export const IMPORT_REG = /^(?<rest>.*?[import|export](.+?from)?.+?['"])(?<url>[0-9a-zA-Z-_@~:/.?#:&=%+]*)/;

export function parseURLFromImportStatement(
  line: string
): [URL, number] | undefined {
  const matchGroups = line.match(IMPORT_REG)?.groups;
  if (!matchGroups) {
    /* istanbul ignore next */
    return undefined;
  }
  const url = matchGroups["url"];
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      return [new URL(url), matchGroups["rest"].length];
    } catch {
      // If creating a URL throws, ignore
      return undefined;
    }
  }
  return undefined;
}

const REPLACEMENT_VARIABLE_REG = /\${{?(\w+)}?}/g;

export function parseReplacementVariablesFromURL(url: string): string[] {
  const matches = url.matchAll(REPLACEMENT_VARIABLE_REG);
  if (!matches) return [];
  return [...matches].map((m) => m[1]);
}

const wellKnownValidator = yup
  .object()
  .strict(true)
  .required()
  .shape({
    version: yup.number().required().equals([1]),
    registries: yup
      .array()
      .defined()
      .of(
        yup
          .object()
          .required()
          .strict(true)
          .shape({
            schema: yup.string().required(),
            variables: yup
              .array()
              .defined()
              .of(
                yup
                  .object()
                  .required()
                  .strict(true)
                  .shape({
                    key: yup.string().required(),
                    url: yup
                      .string()
                      .required()
                      .matches(/^https?:\/\//),
                  })
              ),
          })
      ),
  });

export type WellKnown = yup.InferType<typeof wellKnownValidator>;

export async function fetchWellKnown(origin: string): Promise<WellKnown> {
  const wellknown = await got(
    `${origin}/.well-known/deno-import-intellisense.json`
  ).json();
  return validateWellKnown(wellknown);
}

export async function validateWellKnown(wk: unknown): Promise<WellKnown> {
  const wellknown = await wellKnownValidator.validate(wk);
  for (const registry of wellknown.registries) {
    const keys: Key[] = [];
    pathToRegexp(registry.schema, keys);
    for (const key of keys) {
      if (!registry.variables.find((v) => v.key == key.name)) {
        throw new Error(
          `ValidationError: registry with schema '${registry.schema}' is missing variable declaration for '${key.name}'`
        );
      }
    }
    for (const variable of registry.variables) {
      const keyIndex = keys.findIndex((k) => k.name == variable.key);
      if (keyIndex === -1) {
        throw new Error(
          `ValidationError: registry with schema '${registry.schema}' is missing a path parameter in schema for variable '${variable.key}'`
        );
      }
      const variables = parseReplacementVariablesFromURL(variable.url);
      const limitedKeys = keys.slice(0, keyIndex);
      for (const v of variables) {
        if (variable.key === v) {
          throw new Error(
            `ValidationError: url '${variable.url}' (for variable '${variable.key}' in registry with schema '${registry.schema}') uses variable '${v}', which is not allowed because that would be a self reference`
          );
        }

        if (!limitedKeys.find((k) => k.name == v)) {
          throw new Error(
            `ValidationError: url '${variable.url}' (for variable '${variable.key}' in registry with schema '${registry.schema}') uses variable '${v}', but this is not possible because the schema defines '${v}' to the right of '${variable.key}'`
          );
        }
      }
    }
  }
  return wellknown;
}

const wellKnownCache = new DiskCache("import_intellisense_wellknown", 86400000);

export async function getWellKnown(origin: string): Promise<WellKnown> {
  try {
    const cached = await wellKnownCache.get<WellKnown>(origin);
    if (cached) return cached;
  } catch {
    // ignore and try to fetch
  }
  const wk = await fetchWellKnown(origin);
  await wellKnownCache.set(origin, wk);
  return wk;
}

const completionsCache = new DiskCache(
  "import_intellisense_completions",
  86400000
);

const stringArrayValidator = yup.array().required().of(yup.string().required());

export async function fetchCompletionList(
  url: string,
  variables: Record<string, string>
): Promise<string[]> {
  for (const name in variables) {
    url = url
      .replace(`\${${name}}`, variables[name])
      .replace(`\${{${name}}}`, encodeURIComponent(variables[name]));
  }
  const resp = await got(url, {
    cache: completionsCache,
    cacheOptions: { shared: false },
  }).json();
  return stringArrayValidator.validate(resp);
}
