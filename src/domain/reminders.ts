/**
 * When Pesut reminds someone: on each of the group's "after" days (say day 1
 * and day 3 of owing), then every `repeatEvery` days after the last of them.
 * Day 0 is the day the debt appeared, which already got its own notice.
 */
export function shouldRemind(
  ageDays: number,
  afterDays: readonly number[],
  repeatEvery: number,
): boolean {
  if (ageDays <= 0) return false;
  if (afterDays.includes(ageDays)) return true;
  const last = Math.max(0, ...afterDays);
  return ageDays > last && repeatEvery > 0 && (ageDays - last) % repeatEvery === 0;
}
