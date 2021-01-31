// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

// Provides aspect oriented programming (AOP) capabilities.  These concepts are
// useful when "proxying" or "monkey patching" methods.

/** Extract the return type from a maybe function. */
// deno-lint-ignore no-explicit-any
export type ReturnType<T = (...args: any) => any> = T extends // deno-lint-ignore no-explicit-any
(...args: any) => infer R ? R
  : // deno-lint-ignore no-explicit-any
  any;
/** Extract the parameter types from a maybe function. */
// deno-lint-ignore no-explicit-any
export type Parameters<T = (...args: any) => any> = T extends // deno-lint-ignore no-explicit-any
(...args: infer P) => any ? P
  : never;

type AroundAdvice<T, J extends keyof T> = (
  this: T,
  fn: T[J],
  ...args: Parameters<T[J]>
) => ReturnType<T[J]>;

/** Provide around advice for a join point. */
export function around<
  T,
  J extends keyof T,
>(
  target: T,
  joinPoint: J,
  advice: AroundAdvice<T, J>,
): void {
  const maybeOriginalFunction = target[joinPoint];
  if (typeof maybeOriginalFunction !== "function") {
    throw new TypeError("The target join point is not a function.");
  }
  const fn = maybeOriginalFunction.bind(target);
  Object.defineProperty(target, joinPoint, {
    value(...args: Parameters<T[J]>) {
      return advice.call(target, fn, ...args);
    },
    configurable: true,
  });
}
