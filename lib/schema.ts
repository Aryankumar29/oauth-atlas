import { z } from "zod";

// v1 contract — see SPEC.md §5. Do not change without updating the spec and seed.

export const tierSchema = z.enum(["tested", "verified", "generated", "queued"]);

export const managedSchema = z.enum(["yes", "no", "unknown"]);

export const confidenceSchema = z.enum(["high", "medium", "low"]);

export const evidenceStatusSchema = z.enum([
  "tested",
  "primary",
  "secondary",
  "inferred",
  "conflicting",
  "stale",
]);

export const approvalModelSchema = z.enum([
  "none",
  "listing-review",
  "scope-verification",
  "app-review",
  "partner-program",
  "admin-consent",
  "unknown",
]);

export const ownerSchema = z.enum(["agent", "human", "both"]);

export const milestoneIdSchema = z.enum([
  "dev-ready",
  "pilot-ready",
  "production-ready",
]);

export const MILESTONE_IDS = milestoneIdSchema.options;

export const gateTypeSchema = z.enum([
  "self-serve",
  "testing-cap",
  "listing-throttle",
  "sandbox-to-prod",
  "scope-review",
  "marketplace-review",
  "admin-consent",
  "publisher-verification",
  "app-review",
  "business-verification",
  "paid-access",
  "security-assessment",
  "partner-program",
  "no-self-serve",
]);

export const basisSchema = z.enum([
  "official-sla",
  "official-estimate",
  "community",
  "estimate",
  "unknown",
]);

export const sourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  quote: z.string().optional(),
  fetchedAt: z.string().min(1),
});

export const claimSchema = z.object({
  value: z.string().min(1),
  status: evidenceStatusSchema,
  sources: z.array(sourceSchema).default([]),
  lastChecked: z.string().min(1),
  note: z.string().optional(),
  // Required in spirit for status "tested": which kind of test backs it.
  testKind: z.enum(["probe", "attempt"]).optional(),
});

export const composioSchema = z.object({
  toolkitSlug: z.string().optional(),
  managed: managedSchema,
  checkedAt: z.string().min(1),
});

export const appSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  website: z.string().url(),
  category: z.string().min(1),
  approvalModel: approvalModelSchema,
  docsUrl: z.string().url().optional(),
  consoleUrl: z.string().url().optional(),
  composio: composioSchema,
  tier: tierSchema,
  lastVerified: z.string().optional(),
});

export const milestoneSchema = z
  .object({
    id: milestoneIdSchema,
    definition: z.string().min(1),
    handsOnHours: z.object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
    }),
    wait: z.object({
      minDays: z.number().nonnegative(),
      maxDays: z.number().nonnegative().nullable(),
    }),
    basis: basisSchema,
    limitsUntilNext: z.array(claimSchema).default([]),
  })
  .refine((m) => m.handsOnHours.min <= m.handsOnHours.max, {
    message: "handsOnHours.min must be <= max",
  })
  .refine((m) => m.wait.maxDays === null || m.wait.minDays <= m.wait.maxDays, {
    message: "wait.minDays must be <= maxDays",
  });

export const gateSchema = z.object({
  type: gateTypeSchema,
  name: z.string().min(1),
  appliesWhen: z.string().min(1),
  // Empty = conditional gate: rendered, but not scored (SPEC §5.2).
  requiredFor: z.array(z.enum(["pilot-ready", "production-ready"])),
  // Optional profile tags (e.g. "send-only") this gate is skipped for.
  skipForProfiles: z.array(z.string()).optional(),
  cost: claimSchema.optional(),
  duration: claimSchema.optional(),
  recurring: claimSchema.optional(),
});

export const probeSchema = z.object({
  url: z.string().url(),
  method: z.string().min(1),
  status: z.number().int(),
  redirect: z.string().optional(),
  observed: z.string().min(1),
  at: z.string().min(1),
  // "attempt": a setup step the agent tried itself (T-014). Unset means a plain probe.
  kind: z.enum(["probe", "attempt"]).optional(),
});

export const requirementSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  requiredFor: milestoneIdSchema,
  owner: ownerSchema,
  evidenceIds: z.array(z.string()).default([]),
});

export const scopeSchema = z.object({
  name: z.string().min(1),
  sensitivity: z.enum(["basic", "sensitive", "restricted", "unknown"]),
  whyNeeded: z.string().min(1),
  reviewTrigger: z.string().min(1),
  justificationDraft: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const stepSchema = z.object({
  id: z.string().min(1),
  phase: z.enum(["decide", "create", "configure", "test", "submit", "launch"]),
  title: z.string().min(1),
  actions: z.array(z.string()).min(1),
  owner: ownerSchema,
  timeMinutes: z.number().nonnegative().optional(),
  doneWhen: z.string().min(1),
  artifacts: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
});

export const oauthConfigSchema = z.object({
  redirectUris: z.array(claimSchema).default([]),
  pkce: claimSchema.optional(),
  tokenLifetime: claimSchema.optional(),
  refresh: claimSchema.optional(),
  rateLimits: z.array(claimSchema).default([]),
});

export const blockerSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(1),
  affects: milestoneIdSchema,
  workaround: z.string().optional(),
  agentCanHelp: z.boolean(),
  evidenceIds: z.array(z.string()).default([]),
});

export const evidenceSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceType: z.enum([
    "official-doc",
    "console",
    "policy",
    "pricing",
    "community",
    "test",
    "other",
  ]),
  quote: z.string().optional(),
  retrievedAt: z.string().min(1),
  status: evidenceStatusSchema,
  confidence: confidenceSchema,
});

export const correctionSchema = z.object({
  date: z.string().min(1),
  claim: z.string().min(1),
  before: z.string().min(1),
  after: z.string().min(1),
  reason: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  guideVersion: z.string().min(1),
});

export const guideSchema = z.object({
  slug: z.string().min(1),
  app: appSchema,
  version: z.string().min(1),
  lastVerified: z.string().min(1),
  confidence: confidenceSchema,
  // Generation stopped early; render what exists and flag the rest.
  partial: z.boolean().default(false),
  ownApp: z.object({
    // Composio-specific triggers for this toolkit, beyond the generic §5.1 list.
    triggers: z.array(z.string()).default([]),
    notes: z.string().optional(),
  }).default({ triggers: [] }),
  verdict: z.object({
    // Stored for display; must equal difficulty(gates). Never trust the LLM's value.
    difficulty: z.number().int().min(1).max(5),
    approvalModel: approvalModelSchema,
    summary: z.string().min(1),
    canTestBeforeApproval: z.union([z.boolean(), z.literal("unknown")]),
    // Profile used for scoring (e.g. "send-only"); undefined = default profile.
    profile: z.string().optional(),
  }),
  milestones: z
    .array(milestoneSchema)
    .length(3)
    .refine(
      (ms) => ms.every((m, i) => m.id === MILESTONE_IDS[i]),
      { message: "milestones must be dev-ready, pilot-ready, production-ready in order" },
    ),
  gates: z.array(gateSchema).default([]),
  requirements: z.array(requirementSchema).default([]),
  scopes: z.array(scopeSchema).default([]),
  steps: z.array(stepSchema).default([]),
  oauthConfig: oauthConfigSchema.default({ redirectUris: [], rateLimits: [] }),
  blockers: z.array(blockerSchema).default([]),
  agentTasks: z.array(z.string()).default([]),
  humanTasks: z.array(z.string()).default([]),
  probes: z.array(probeSchema).default([]),
  unknowns: z.array(z.string()).default([]),
  evidence: z.array(evidenceSchema).default([]),
  corrections: z.array(correctionSchema).default([]),
  generatedBy: z.enum(["human", "agent"]),
  runId: z.string().optional(),
});

export const agentRunStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["pending", "running", "done", "failed", "skipped"]),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  detail: z.string().optional(),
});

export type App = z.infer<typeof appSchema>;
export type Guide = z.infer<typeof guideSchema>;
export type GuideInput = z.input<typeof guideSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;
export type MilestoneId = z.infer<typeof milestoneIdSchema>;
export type Gate = z.infer<typeof gateSchema>;
export type GateType = z.infer<typeof gateTypeSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Probe = z.infer<typeof probeSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;
export type Correction = z.infer<typeof correctionSchema>;
export type AgentRunStep = z.infer<typeof agentRunStepSchema>;
export type Tier = z.infer<typeof tierSchema>;
export type Managed = z.infer<typeof managedSchema>;
export type ApprovalModel = z.infer<typeof approvalModelSchema>;
export type ComposioInfo = z.infer<typeof composioSchema>;
