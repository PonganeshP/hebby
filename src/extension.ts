import * as vscode from "vscode";
import { AVATARS, AVATAR_LIST, Avatar, AvatarId } from "./avatars";
import { Scheduler, Step, Choice } from "./scheduler";
import { showGreeting } from "./greeting";
import { askWithAvatar } from "./popup";

const K = {
  enabled: "enabled",
  avatar: "avatar",
  name: "name",
  onboarded: "onboarded",
} as const;

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const state = ctx.globalState;
  const getAvatar = (): Avatar =>
    AVATARS[state.get<AvatarId>(K.avatar, "fox")] ?? AVATARS.fox;
  const getName = (): string => state.get<string>(K.name, getAvatar().label);
  const isEnabled = (): boolean => state.get<boolean>(K.enabled, true);

  // ---- Status bar (right side, like Copilot) ----
  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  status.command = "hebby.menu";
  const renderStatus = () => {
    const a = getAvatar();
    status.text = isEnabled()
      ? `${a.emoji} ${getName()}`
      : `$(circle-slash) ${getName()}`;
    status.tooltip = isEnabled()
      ? "Hebby is on - click for options"
      : "Hebby is off - click to enable";
  };
  status.show();

  // ---- Reminder prompt ----
  const prompt = async (step: Step): Promise<Choice> => {
    const style = vscode.workspace
      .getConfiguration("hebby")
      .get<string>("popupStyle", "avatar");
    if (style === "avatar") {
      return askWithAvatar(getAvatar(), getName(), step.text);
    }
    const picked = await vscode.window.showInformationMessage(
      `${getAvatar().emoji} ${getName()}: ${step.text}`,
      "Yes",
      "Skip",
      "Remind me later",
    );
    if (picked === "Yes") {
      return "yes";
    }
    if (picked === "Remind me later") {
      return "later";
    }
    return "skip"; // Skip or notification dismissed
  };
  const scheduler = new Scheduler(prompt);

  // ---- Actions ----
  const applyEnabled = (on: boolean) => {
    state.update(K.enabled, on);
    renderStatus();
    if (on) {
      scheduler.start();
    } else {
      scheduler.stop();
    }
  };

  const chooseAvatar = async (): Promise<boolean> => {
    const pick = await vscode.window.showQuickPick(
      AVATAR_LIST.map((a) => ({ label: `${a.emoji} ${a.label}`, id: a.id })),
      {
        title: "Choose your buddy",
        placeHolder: "Who should keep you company?",
        ignoreFocusOut: true,
      },
    );
    if (!pick) {
      return false;
    }
    const previousDefault = getAvatar().label;
    await state.update(K.avatar, pick.id);
    // if the user never customised the name, keep it in sync with the animal
    if (getName() === previousDefault) {
      await state.update(K.name, AVATARS[pick.id].label);
    }
    renderStatus();
    return true;
  };

  const chooseName = async (): Promise<boolean> => {
    const name = await vscode.window.showInputBox({
      title: "Name your buddy",
      value: getName(),
      prompt: "What should your buddy be called?",
      ignoreFocusOut: true,
      validateInput: (v) =>
        v.trim().length === 0
          ? "Name cannot be empty"
          : v.length > 20
            ? "Max 20 characters"
            : undefined,
    });
    if (name === undefined) {
      return false;
    }
    await state.update(K.name, name.trim());
    renderStatus();
    return true;
  };

  const onboard = async () => {
    await chooseAvatar();
    await chooseName();
    await state.update(K.onboarded, true);
    vscode.window.showInformationMessage(
      `${getAvatar().emoji} ${getName()} is ready! Click the status bar icon any time to customise.`,
    );
  };

  const menu = async () => {
    const items = [
      {
        label: isEnabled()
          ? "$(circle-slash) Disable Hebby"
          : "$(check) Enable Hebby",
        run: () => applyEnabled(!isEnabled()),
      },
      {
        label: "$(account) Change avatar",
        run: async () => {
          await chooseAvatar();
        },
      },
      {
        label: "$(edit) Rename avatar",
        run: async () => {
          await chooseName();
        },
      },
      { label: "$(bell) Remind me now (test)", run: () => scheduler.fireNow() },
    ];
    const pick = await vscode.window.showQuickPick(items, {
      title: `${getName()} - Hebby`,
    });
    await pick?.run();
  };

  ctx.subscriptions.push(
    status,
    scheduler,
    vscode.commands.registerCommand("hebby.menu", menu),
    vscode.commands.registerCommand("hebby.toggle", () =>
      applyEnabled(!isEnabled()),
    ),
    vscode.commands.registerCommand("hebby.changeAvatar", chooseAvatar),
    vscode.commands.registerCommand("hebby.rename", chooseName),
    vscode.commands.registerCommand("hebby.remindNow", () =>
      scheduler.fireNow(),
    ),
  );

  // ---- Startup ----
  renderStatus();
  if (!state.get<boolean>(K.onboarded, false)) {
    await onboard();
  }
  if (isEnabled()) {
    showGreeting(getAvatar(), getName());
    scheduler.start();
  }
}

export function deactivate(): void {}
