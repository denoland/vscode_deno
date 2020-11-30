# typescript-deno-plugin

The `typescript-deno-plugin` is a language service plugin for TypeScript. It is
loaded by the extension client.  The main purpose of the plugin is to _disable_
parts of the built in TypeScript/JavaScript language server in Visual Studio
Code when Deno is enabled for a project, as language server information will be
obtained from the Deno CLI Language Server itself.
