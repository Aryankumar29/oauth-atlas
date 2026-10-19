import { z } from "zod";

export const archetypeSchema = z.enum([
  "self-serve",
  "verification-heavy",
  "marketplace",
  "enterprise",
  "fintech",
  "long-tail",
]);

export const tierSchema = z.enum(["tested", "verified", "indexed"]);

export const managedOAuthSchema = z.enum(["yes", "no", "partial", "unknown"]);

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
  "self-serve-review",
  "verification",
  "security-assessment",
  "marketplace-review",
  "partner-only",
  "admin-consent",
  "unknown",
]);

export const ownerSchema = z.enum(["agent", "human", "both"]);

export const appSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  website: z.string().url(),
  category: z.string().min(1),
  archetype: archetypeSchema,
  docsUrl: z.string().url().optional(),
  consoleUrl: z.string().url().optional(),
  managedOAuth: managedOAuthSchema.default("unknown"),
  tier: tierSchema.default("indexed"),
  lastVerified: z.string().optional(),
});

export const timeEstimateSchema = z.object({
  handsOnHours: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  }),
  timeToFirstTestUser: z.string().min(1),
  timeToPublicLaunch: z.string().min(1),
  approvalWaitDays: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
    })
    .optional(),
  cost: z.string().optional(),
  confidence: confidenceSchema,
  basis: z.string().min(1),
});

export const requirementSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  requiredFor: z.enum(["test", "public", "both"]),
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

export const blockerSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(1),
  affects: z.enum(["test", "public", "both"]),
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
  verdict: z.object({
    difficulty: z.number().int().min(1).max(5),
    approvalModel: approvalModelSchema,
    summary: z.string().min(1),
    canTestBeforeApproval: z.union([z.boolean(), z.literal("unknown")]),
  }),
  fastestPath: z.object({
    managedPath: z.string().min(1),
    ownAppPath: z.string().min(1),
    recommendation: z.string().min(1),
  }),
  time: timeEstimateSchema,
  requirements: z.array(requirementSchema).default([]),
  scopes: z.array(scopeSchema).default([]),
  steps: z.array(stepSchema).default([]),
  blockers: z.array(blockerSchema).default([]),
  agentTasks: z.array(z.string()).default([]),
  humanTasks: z.array(z.string()).default([]),
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
export type Evidence = z.infer<typeof evidenceSchema>;
export type Correction = z.infer<typeof correctionSchema>;
export type AgentRunStep = z.infer<typeof agentRunStepSchema>;
export type Archetype = z.infer<typeof archetypeSchema>;
export type Tier = z.infer<typeof tierSchema>;
export type ApprovalModel = z.infer<typeof approvalModelSchema>;
