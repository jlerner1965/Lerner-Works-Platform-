import type { Locator, Page } from "@playwright/test";

/**
 * Counts what a person does in the dashboard, per task: the screens opened, the fields filled
 * and the links or buttons pressed, with the scripted wall time. Shared by the walk-through
 * (SB-06) and the proof build (B4). The counts are the comparable measure between phases; the
 * time is the script's, which types instantly and never reads.
 */
export interface TaskCount { task: string; screens: number; fields: number; actions: number; ms: number }

export class Recorder {
  readonly tasks: TaskCount[] = [];
  private current: TaskCount | null = null;
  private startedAt = 0;
  constructor(private readonly page: Page) {}
  start(task: string): void {
    this.finish();
    this.current = { task, screens: 0, fields: 0, actions: 0, ms: 0 };
    this.startedAt = Date.now();
  }
  finish(): void {
    if (!this.current) return;
    this.current.ms = Date.now() - this.startedAt;
    this.tasks.push(this.current);
    this.current = null;
  }
  private get task(): TaskCount {
    if (!this.current) throw new Error("no task started");
    return this.current;
  }
  /** A screen reached by typing or choosing an address (the dashboard home, a link opened by hand). */
  async open(url: string): Promise<void> {
    this.task.screens += 1;
    await this.page.goto(url);
  }
  /** A link that opens another screen. */
  async follow(link: Locator): Promise<void> {
    this.task.screens += 1;
    this.task.actions += 1;
    await link.click();
  }
  /** A screen the person lands on after an action (the overview after creating a site, the editor after creating a draft). */
  arrive(): void {
    this.task.screens += 1;
  }
  async fill(field: Locator, value: string): Promise<void> {
    this.task.fields += 1;
    await field.fill(value);
  }
  /** A select, a checkbox or a file chooser: one field. */
  async choose(field: Locator, value: string | { label: string } | { index: number }): Promise<void> {
    this.task.fields += 1;
    await field.selectOption(value);
  }
  async check(field: Locator): Promise<void> {
    this.task.fields += 1;
    await field.check();
  }
  async attach(field: Locator, file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
    this.task.fields += 1;
    await field.setInputFiles(file);
  }
  async press(button: Locator): Promise<void> {
    this.task.actions += 1;
    await button.click();
  }
  totals(): Omit<TaskCount, "task"> {
    return this.tasks.reduce((sum, t) => ({ screens: sum.screens + t.screens, fields: sum.fields + t.fields, actions: sum.actions + t.actions, ms: sum.ms + t.ms }), { screens: 0, fields: 0, actions: 0, ms: 0 });
  }
}
