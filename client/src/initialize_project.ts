// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import { MultiStepInput } from "./multi_step_input";

const quickPickYesNo = [
  { label: "Yes" },
  { label: "No" },
];

export interface InitWorkspaceSettings {
  lint: boolean;
  unstable: boolean;
}

export function pickInitWorkspace() {
  interface State extends InitWorkspaceSettings {
    title: string;
    step: number;
    totalSteps: number;
  }

  const title = "Initialize Project";

  async function pickLint(input: MultiStepInput, state: Partial<State>) {
    const pick = await input.showQuickPick({
      title,
      step: 1,
      totalSteps: 2,
      placeholder: "Enable Deno linting?",
      items: quickPickYesNo,
      shouldResume: () => Promise.resolve(false),
    });
    state.lint = pick.label === "Yes" ? true : false;
    return (input: MultiStepInput) => pickUnstable(input, state);
  }

  async function pickUnstable(input: MultiStepInput, state: Partial<State>) {
    const pick = await input.showQuickPick({
      title,
      step: 2,
      totalSteps: 2,
      placeholder: "Enable Deno unstable APIs?",
      items: quickPickYesNo,
      shouldResume: () => Promise.resolve(false),
    });
    state.unstable = pick.label === "Yes" ? true : false;
  }

  async function collectInputs() {
    const state: Partial<State> = {};
    await MultiStepInput.run((input) => pickLint(input, state));
    return state as InitWorkspaceSettings;
  }

  return collectInputs();
}
