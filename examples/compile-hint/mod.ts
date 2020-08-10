// @deno-types="./types/foo.d.ts"
import { foo, bar } from "./foo.js";

function getName(name: string) {
  console.log(name);
}

getName(foo);

bar();
