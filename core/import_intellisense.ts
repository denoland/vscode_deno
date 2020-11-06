import got from "got";
import {
  Key,
  pathToRegexp,
  tokensToRegexp,
  parse,
  regexpToFunction,
  Token,
} from "path-to-regexp";
import * as yup from "yup";
import { DiskCache } from "./diskcache";
import { version as VERSION } from "../package.json";

export const IMPORT_REG = /^(?<rest>.*?[import|export](.+?from)?.+?['"])(?<url>[0-9a-zA-Z-_@~:/.?#:&=%+]*)/;

export function parseURLFromImportStatement(
  line: string
): [URL, number] | undefined {
  /* istanbul ignore next */
  const matchGroups = line.match(IMPORT_REG)?.groups;
  /* istanbul ignore next */
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
  console.log(`GET ${origin}/.well-known/deno-import-intellisense.json`);
  const wellknown = await got(
    `${origin}/.well-known/deno-import-intellisense.json`,
    {
      headers: {
        accepts: "application/json",
        "user-agent": `vscodedeno/${VERSION}`,
      },
    }
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

export const wellKnownCache = new DiskCache(
  "import_intellisense_wellknown",
  86400000
);

export async function getWellKnown(origin: string): Promise<WellKnown> {
  try {
    const cached = await wellKnownCache.get<WellKnown>(origin);
    if (cached !== undefined) return cached;
  } catch {
    // ignore and try to fetch
  }
  try {
    const wk = await fetchWellKnown(origin);
    await wellKnownCache.set(origin, wk);
    return wk;
  } catch (err) {
    await wellKnownCache.set(origin, null);
    throw err;
  }
}

export const completionsCache = new DiskCache(
  "import_intellisense_completions",
  86400000
);

const stringArrayValidator = yup.array().required().of(yup.string().required());

export function buildCompletionListURL(
  url: string,
  variables: Record<string, string>
): string {
  for (const name in variables) {
    url = url
      .replace(`\${${name}}`, variables[name])
      .replace(`\${{${name}}}`, encodeURIComponent(variables[name]));
  }
  return url;
}

export async function fetchCompletionList(
  url: string,
  variables: Record<string, string>
): Promise<string[]> {
  const finalURL = buildCompletionListURL(url, variables);
  console.log(`GET ${finalURL}`);
  const resp = await got(finalURL, {
    headers: {
      accepts: "application/json",
      "user-agent": `vscodedeno/${VERSION}`,
    },
    cache: completionsCache,
    cacheOptions: { shared: false },
  }).json();
  return stringArrayValidator.validate(resp);
}

export async function getCompletionsForURL(
  wellknown: WellKnown,
  url: URL,
  urlIndex: number,
  cursorColPosition: number
): Promise<string[]> {
  const positionInPath = cursorColPosition - urlIndex - url.origin.length;
  if (positionInPath < 0) return [];

  const pathname = url.pathname;

  const completions = new Set<string>();

  for (const registry of wellknown.registries) {
    const tokens = parse(registry.schema);
    for (let i = tokens.length; i >= 0; i--) {
      const keys: Key[] = [];
      const matcher = regexpToFunction(
        tokensToRegexp(tokens.slice(0, i), keys),
        keys
      );
      const matched = matcher(pathname);
      if (!matched) continue;

      const values = Object.fromEntries(
        Object.entries(matched.params).map<[string, string]>(
          ([k, v]: [string, string[]]) => {
            if (Array.isArray(v)) {
              return [k, v.join("/")];
            } else {
              return [k, v];
            }
          }
        )
      );

      const completor = findCompletor(
        url.origin,
        urlIndex,
        cursorColPosition,
        tokens.slice(0, i + 1),
        values
      );

      if (!completor) break;
      const [type, value] = completor;
      switch (type) {
        case "literal":
          if (value.startsWith("/")) {
            completions.add(value.slice(1));
          } else {
            completions.add(value);
          }
          break;
        case "variable":
          try {
            const url = registry.variables.find((v) => v.key === value)?.url;
            if (!url) break;
            const list = await fetchCompletionList(url, values);
            for (const v of list) {
              completions.add(v);
            }
          } catch (err) {
            /* something failed while fetching */
            console.error("failed fetching for " + value + ":", err);
          }
          break;
      }
      break;
    }
  }

  return [...completions];
}

export function findCompletor(
  origin: string,
  urlIndex: number,
  cursorColPosition: number,
  tokens: Token[],
  values: Record<string, string>
): ["literal" | "variable", string] | undefined {
  const positionInURL = cursorColPosition - urlIndex;
  let totalLength = origin.length;
  for (const token of tokens) {
    if (typeof token === "string") {
      totalLength += token.length;
      if (positionInURL < totalLength) {
        return ["literal", token];
      }
    } else {
      totalLength += token.prefix.length;
      if (positionInURL < totalLength) {
        return undefined;
      }
      const value = values[token.name] ?? "";
      if (Array.isArray(value)) {
        totalLength += value.join("/").length;
      } else {
        totalLength += value.length;
      }
      if (positionInURL <= totalLength) {
        return ["variable", token.name.toString()];
      }
      totalLength += token.suffix.length;
      if (positionInURL <= totalLength) {
        return ["literal", token.suffix];
      }
    }
  }
}
