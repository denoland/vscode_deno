import got from "got";
import * as yup from "yup";

export const IMPORT_REG = /^.*?[import|export].+?from.+?['"](?<url>[0-9a-zA-Z-_@~:/.?#:&=%+]*)/;

export function parseURLFromImportStatement(line: string): URL | undefined {
  const matchedGroups = line.match(IMPORT_REG)?.groups;
  if (!matchedGroups) {
    return undefined;
  }
  const url = matchedGroups["url"];
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return new URL(url);
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
    {}
  ).json();
  return await wellKnownValidator.validate(wellknown);
}

export async function getWellKnown(origin: string): Promise<WellKnown> {
  return fetchWellKnown(origin);
}
