import * as vscode from "vscode";

export type Choice = "yes" | "skip" | "later";

export interface Step {
  id: "water" | "mini" | "walk";
  text: string;
  delayMinutes: number; // wait before this step is shown
}

export type PromptFn = (step: Step) => Thenable<Choice>;

/**
 * Cycle: water (30m) -> mini break (+30m) -> walk (+60m) -> back to water...
 * Yes/Skip move to the next step. "Later" re-asks the same step after the snooze time.
 */
export class Scheduler implements vscode.Disposable {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private generation = 0; // invalidates in-flight prompts after stop()/restart

  constructor(private readonly prompt: PromptFn) {}

  private steps(): Step[] {
    const c = vscode.workspace.getConfiguration("hebby");
    return [
      {
        id: "water",
        text: "Had water? 💧",
        delayMinutes: c.get("waterAfterMinutes", 30),
      },
      {
        id: "mini",
        text: "Time for a mini break ☕",
        delayMinutes: c.get("miniBreakAfterMinutes", 30),
      },
      {
        id: "walk",
        text: "Take a walk 🚶",
        delayMinutes: c.get("walkAfterMinutes", 60),
      },
    ];
  }

  private toMs(minutes: number): number {
    const scale = vscode.workspace
      .getConfiguration("hebby")
      .get("timeScale", 1);
    return Math.max(1000, minutes * 60_000 * scale);
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    this.stop();
    this.running = true;
    const gen = ++this.generation;
    this.arm(0, this.steps()[0].delayMinutes, gen);
  }

  stop(): void {
    this.running = false;
    this.generation++;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /** Fire the next step right away (used by the test command). */
  async fireNow(): Promise<void> {
    if (!this.running) {
      this.start();
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const gen = ++this.generation;
    await this.fire(this.currentIndex, gen);
  }

  private currentIndex = 0;

  private arm(index: number, minutes: number, gen: number): void {
    this.currentIndex = index;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(
      () => void this.fire(index, gen),
      this.toMs(minutes),
    );
  }

  private async fire(index: number, gen: number): Promise<void> {
    const steps = this.steps();
    const step = steps[index];
    let choice: Choice = "skip";
    try {
      choice = await this.prompt(step);
    } catch {
      choice = "skip";
    }
    // extension disabled or restarted while the notification was open
    if (!this.running || gen !== this.generation) {
      return;
    }

    if (choice === "later") {
      const snooze = vscode.workspace
        .getConfiguration("hebby")
        .get("snoozeMinutes", 20);
      this.arm(index, snooze, gen);
    } else {
      const next = (index + 1) % steps.length;
      this.arm(next, steps[next].delayMinutes, gen);
    }
  }

  dispose(): void {
    this.stop();
  }
}
