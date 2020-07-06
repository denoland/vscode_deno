import { CodeFixAction } from "typescript/lib/tsserverlibrary";

import { registerCodeFix } from "../codefix_provider";
import { HashMeta } from "../module_resolver/hash_meta";

export const importFixName = "import";
// const importFixId = "fixMissingImport";

const errorCodes: readonly number[] = [
  2304, // Diagnostics.Cannot_find_name_0.code,
  2552, // Diagnostics.Cannot_find_name_0_Did_you_mean_1.code,
  2663, // Diagnostics.Cannot_find_name_0_Did_you_mean_the_instance_member_this_0.code,
  2662, // Diagnostics.Cannot_find_name_0_Did_you_mean_the_static_member_1_0.code,
  2503, // Diagnostics.Cannot_find_namespace_0.code,
  2686, // Diagnostics._0_refers_to_a_UMD_global_but_the_current_file_is_a_module_Consider_adding_an_import_instead.code,
  2693, // Diagnostics._0_only_refers_to_a_type_but_is_being_used_as_a_value_here.code,
];

function replaceCodeActions(codeFixActions: readonly CodeFixAction[]): void {
  for (const codeAction of codeFixActions) {
    if (codeAction.fixName !== importFixName) {
      continue;
    }

    const matchs = codeAction.description.match(
      /\.\..+deno\/deps\/https?\/.+\/\w{64}/,
    );
    if (matchs == null || matchs.length === 0) {
      continue;
    }

    const originImport = matchs[0];
    const meta = HashMeta.create(`${originImport}.metadata.json`);
    if (meta == null) {
      continue;
    }

    const newImport = meta.url.href;
    codeAction.description = codeAction.description.replace(
      originImport,
      newImport,
    );

    for (const change of codeAction.changes) {
      for (const textChange of change.textChanges) {
        textChange.newText = textChange.newText.replace(
          originImport,
          newImport,
        );
      }
    }
  }
}

registerCodeFix({
  errorCodes,
  replaceCodeActions,
});
