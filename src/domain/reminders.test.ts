import { describe, expect, it } from "vitest";
import { shouldRemind } from "./reminders";

describe("shouldRemind", () => {
  const days = Array.from({ length: 25 }, (_, i) => i).filter((d) => shouldRemind(d, [1, 3], 7));
  it("reminds on the configured days, then weekly", () => {
    expect(days).toEqual([1, 3, 10, 17, 24]);
  });
  it("never reminds on the day the debt appeared", () => {
    expect(shouldRemind(0, [0, 1], 7)).toBe(false);
  });
});
