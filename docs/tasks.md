# Tasks

The extension provides several tasks for the Deno CLI which can be integrated
into a project.

## Deno CLI Tasks

The template for a Deno CLI task has the following interface, which can be
configured in a `tasks.json`:

```ts
interface DenoTaskDefinition {
  type: "deno";
  // This is the `deno` command to run (e.g. `run`, `test`, `cache`, etc.)
  command: string;
  // Additional arguments pass on the command line
  args?: string[];
  // The current working directory to execute the command
  cwd?: string;
  // Any environment variables that should be set when executing
  env?: Record<string, string>;
}
```

There are several task templates provided to make it easy for you to configure
up your `tasks.json` which are available via the `Tasks: Configure Task` in the
command pallet.

An example of a `deno run` command would look something like this in the
`tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "deno",
      "command": "run",
      "args": [
        "mod.ts"
      ],
      "problemMatcher": [
        "$deno"
      ],
      "label": "deno: run"
    }
  ]
}
```
