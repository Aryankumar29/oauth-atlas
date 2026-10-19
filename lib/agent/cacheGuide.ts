import type { Store } from "@/lib/agent/types";
import { difficulty } from "@/lib/difficulty";
import { guideSchema, type Guide } from "@/lib/schema";

// Validates a guide file and writes it to guide:{slug} (demo-cache fallback, SPEC §9.14).
export async function cacheGuide(raw: unknown, store: Store): Promise<Guide> {
  const parsed = guideSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid guide:\n${issues.join("\n")}`);
  }
  const guide = parsed.data;
  // /generate shows the live-gen banner only for agent guides; never serve a hand-written guide there.
  if (guide.generatedBy !== "agent" && guide.app.tier !== "generated") {
    throw new Error(`Refusing to cache ${guide.slug}: generatedBy must be "agent" or app.tier "generated"`);
  }
  const d = difficulty(guide.gates, { profile: guide.verdict.profile });
  if (d.score !== guide.verdict.difficulty) {
    throw new Error(`verdict.difficulty ${guide.verdict.difficulty} != computed ${d.score}`);
  }
  await store.putGuide(guide);
  return guide;
}
