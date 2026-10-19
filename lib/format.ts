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
  if (h.max < 1) return `${Math.round(h.min * 60)}–${Math.round(h.max * 60)} min`;
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

// "dev-ready → production-ready" chip for library cards.
export function devToProdChip(guide: Guide): string {
  const dev = milestone(guide, "dev-ready");
  const prod = milestone(guide, "production-ready");
  return `Dev ${formatHours(dev?.handsOnHours)} → Prod ${formatWait(prod?.wait)} wait`;
}
