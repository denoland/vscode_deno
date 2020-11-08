import { MultiStepInput } from "./mutistep_helper";
import { QuickPickItem } from "vscode";

interface State extends Partial<ProjectSetting> {
  title: string;
  step: number;
  totalSteps: number;
}

export interface ProjectSetting {
  lint: boolean;
  unstable: boolean;
}

export async function initProject(): Promise<ProjectSetting> {
  const title = "Init";
  const totalSteps = 2;

  async function lint(input: MultiStepInput, state: Partial<State>) {
    const pick = await input.showQuickPick({
      title,
      step: 1,
      totalSteps,
      placeholder: "Enable deno lint?",
      items: (["Yes", "No"].map((label) => ({
        label,
      })) as unknown[]) as QuickPickItem[],
      buttons: [],
      shouldResume: async () => false,
    });

    if (pick.label === "Yes") {
      state.lint = true;
    } else {
      state.lint = false;
    }

    return (input: MultiStepInput) => unstable(input, state);
  }

  async function unstable(input: MultiStepInput, state: Partial<State>) {
    const pick = await input.showQuickPick({
      title,
      step: 2,
      totalSteps,
      placeholder:
        "Enable unstable mode? Note: unstable mode is required to use deno lint",
      items: (["Yes", "No"].map((label) => ({
        label,
      })) as unknown[]) as QuickPickItem[],
      buttons: [],
      shouldResume: async () => false,
    });

    if (pick.label === "Yes") {
      state.unstable = true;
    } else {
      state.unstable = false;
    }

    return;
  }

  async function collectInputs(): Promise<ProjectSetting> {
    const state: Partial<State> = {};
    await MultiStepInput.run((input) => lint(input, state));
    return state as ProjectSetting;
  }

  return collectInputs();
}
