import * as semverPackage from "semver";
import { Options, Range, SemVer } from "semver";

export const semver = {
  ...semverPackage,

  satisfies: (
    version: string | SemVer,
    range: string | Range,
    optionsOrLoose?: boolean | Options,
  ): boolean => {
    return semverPackage.satisfies(
      version,
      range,
      optionsOrLoose ?? { includePrerelease: true },
    );
  },
};
