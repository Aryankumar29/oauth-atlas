import type { Guide, Milestone } from "@/lib/schema";

export const UNKNOWN = "unknown";

export function humanize(value: string): string {
  return value.replaceAll("-", " ");
}

function range(min: number, max: number, unit: string): string {
  return min === max ? `${min} ${unit}` : `${min}–${max} ${unit}`;
}

export function formatHours(h: Milestone["handsOnHours"] | undefined): string {
  if (!h) return UNKNOWN;
  if (h.max < 1) return range(Math.round(h.min * 60), Math.round(h.max * 60), "min");
  return range(h.min, h.max, "h");
}

export function formatWait(w: Milestone["wait"] | undefined): string {
  if (!w) return UNKNOWN;
  if (w.maxDays === null) return `${w.minDays}+ days`;
  if (w.maxDays === 0) return "no wait";
  if (w.minDays === 0) return `up to ${w.maxDays} ${w.maxDays === 1 ? "day" : "days"}`;
  return range(w.minDays, w.maxDays, w.maxDays === 1 ? "day" : "days");
}

export function milestone(guide: Guide, id: Milestone["id"]): Milestone | undefined {
  return guide.milestones.find((m) => m.id === id);
}

// Fallback guides carry basis "unknown" with all-zero numbers; those zeros are placeholders, not data.
export function isPlaceholderMilestone(m: Milestone): boolean {
  return (
    m.basis === "unknown" &&
    m.handsOnHours.min === 0 &&
    m.handsOnHours.max === 0 &&
    m.wait.minDays === 0 &&
    (m.wait.maxDays === null || m.wait.maxDays === 0)
  );
}

export function milestoneHours(m: Milestone | undefined): string {
  return !m || isPlaceholderMilestone(m) ? UNKNOWN : formatHours(m.handsOnHours);
}

export function milestoneWait(m: Milestone | undefined): string {
  return !m || isPlaceholderMilestone(m) ? UNKNOWN : formatWait(m.wait);
}

// "dev-ready → production-ready" chip for library cards.
export function devToProdChip(guide: Guide): string {
  const wait = milestoneWait(milestone(guide, "production-ready"));
  return `Dev ${milestoneHours(milestone(guide, "dev-ready"))} → Prod ${wait === UNKNOWN ? UNKNOWN : `${wait} wait`}`;
}
