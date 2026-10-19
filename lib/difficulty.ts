import type { Gate, GateType } from "@/lib/schema";

// SPEC §5.2 — deterministic difficulty. Pure: no I/O, no LLM input.

export const GATE_WEIGHTS: Record<GateType, 1 | 2 | 3 | 4 | 5> = {
  "self-serve": 1,
  "testing-cap": 2,
  "listing-throttle": 2,
  "sandbox-to-prod": 2,
  "paid-access": 2,
  "scope-review": 3,
  "marketplace-review": 3,
  "admin-consent": 3,
  "publisher-verification": 3,
  "app-review": 4,
  "business-verification": 4,
  "security-assessment": 5,
  "partner-program": 5,
  "no-self-serve": 5,
};

export const DIFFICULTY_LABELS = {
  1: "Instant",
  2: "Easy",
  3: "Moderate",
  4: "Hard",
  5: "Very hard",
} as const;

export type DifficultyScore = keyof typeof DIFFICULTY_LABELS;

export type DifficultyResult = {
  score: DifficultyScore;
  label: (typeof DIFFICULTY_LABELS)[DifficultyScore];
  rationale: string[];
};

export type DifficultyOptions = {
  // e.g. "send-only": gates listing this profile in skipForProfiles are ignored.
  profile?: string;
};

type ScorableGate = Pick<Gate, "type" | "name" | "requiredFor" | "skipForProfiles">;

export function difficulty(
  gates: readonly ScorableGate[],
  opts: DifficultyOptions = {},
): DifficultyResult {
  const scoring = gates.filter(
    (g) =>
      g.requiredFor.includes("production-ready") &&
      !(opts.profile && g.skipForProfiles?.includes(opts.profile)),
  );

  if (scoring.length === 0) {
    return {
      score: 1,
      label: DIFFICULTY_LABELS[1],
      rationale: ["No gates required for production-ready"],
    };
  }

  const score = Math.max(...scoring.map((g) => GATE_WEIGHTS[g.type])) as DifficultyScore;
  const rationale = scoring
    .filter((g) => GATE_WEIGHTS[g.type] === score)
    .map((g) => `${g.name} (${g.type}, weight ${score})`);

  return { score, label: DIFFICULTY_LABELS[score], rationale };
}
