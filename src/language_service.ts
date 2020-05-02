// import ts_module from "typescript/lib/tsserverlibrary";
import { TypeScriptServiceHost } from "./typescript_host";

/**
 * Create an instance of a Deno `LanguageService`.
 */
export function createLanguageService(host: TypeScriptServiceHost) {
  console.log(host);
}
