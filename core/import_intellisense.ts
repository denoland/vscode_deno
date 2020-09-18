import got from "got";
import { Key, pathToRegexp } from "path-to-regexp";
import * as yup from "yup";

export const IMPORT_REG = /^(?<rest>.*?[import|export].+?from.+?['"])(?<url>[0-9a-zA-Z-_@~:/.?#:&=%+]*)/;

const map = new Map();

export function parseURLFromImportStatement(
  line: string
): [URL, number] | undefined {
  const matchGroups = line.match(IMPORT_REG)?.groups;
  if (!matchGroups) {
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

const wellKnownValidator = yup
  .object()
  .strict(true)
  .required()
  .shape({
    version: yup.number().required().equals([1]),
    registries: yup
      .array()
      .required()
      .of(
        yup
          .object()
          .required()
          .strict(true)
          .shape({
            schema: yup.string().required(),
            variables: yup
              .array()
              .required()
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
                      .matches(/^https:\/\//),
                  })
              ),
          })
      ),
  });

export type WellKnown = yup.InferType<typeof wellKnownValidator>;

async function fetchWellKnown(origin: string): Promise<WellKnown> {
  const wellknown = await got(
    `${origin}/.well-known/deno-import-intellisense.json`,
    { cache: map }
  ).json();
  const wk = await wellKnownValidator.validate(wellknown);

  for (const registry of wk.registries) {
    const keys: Key[] = [];
    pathToRegexp(registry.schema, keys);
    for (const key of keys) {
      if (!registry.variables.find((v) => v.key == key.name)) {
        throw new Error(
          `ValidationError: registry with schema ${registry.schema} is missing variable declaration for ${key.name}`
        );
      }
    }
  }

  return wk;
}

export async function getWellKnown(origin: string): Promise<WellKnown> {
  return fetchWellKnown(origin);
}
