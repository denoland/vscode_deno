/**
 * Return true if the specified `project` contains mod.ts file.
 * @param project
 * @param denoMod path that uniquely identifies `mod.ts`.
 */
export function isDenoProject(
  project: ts.server.Project,
  denoMod: string,
): boolean {
  return true;
  // TODO: @justjavac
  // project.markAsDirty(); // Must mark project as dirty to rebuild the program.
  // if (project.isNonTsProject()) {
  //   return false;
  // }
  // for (const fileName of project.getFileNames()) {
  //   if (fileName.endsWith(denoMod)) {
  //     return true;
  //   }
  // }
  // return false;
}
