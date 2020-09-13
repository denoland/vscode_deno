import { MultiStepInput } from "./mutistep_helper";
import { QuickPickItem } from "vscode";

interface State {
  title: string;
  step: number;
  totalSteps: number;

  lint: boolean;
}

export interface ProjectSetting {
  lint: boolean;
}

export async function initProject(): Promise<ProjectSetting> {
  const title = "Init vscode-deno project settings";

  async function lint(input: MultiStepInput, state: Partial<State>) {
    const pick = await input.showQuickPick({
      title,
      step: 1,
      totalSteps: 1,
      placeholder: "Enable deno lint?",
      items: (["Enable", "Disable"].map((label) => ({
        label,
      })) as unknown[]) as QuickPickItem[],
      buttons: [],
      shouldResume: async () => false,
    });

    if (pick.label === "Enable") {
      state.lint = true;
    } else {
      state.lint = false;
    }
  }

  async function collectInputs() {
    const state = {} as Partial<State>;
    await MultiStepInput.run((input) => lint(input, state));
    return state as State;
  }

  return await collectInputs();
}
