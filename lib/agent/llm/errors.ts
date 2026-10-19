// Provider-neutral LLM failures. `retryable: false` tells extraction not to spend its one retry.
export type LlmErrorKind = "refusal" | "max_tokens" | "rate_limit" | "auth" | "api" | "timeout";

export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    readonly retryable: boolean,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export class LlmRefusalError extends LlmError {
  constructor(readonly category: string | null, explanation?: string | null) {
    super(
      "refusal",
      `Model declined${category ? ` (${category})` : ""}${explanation ? `: ${explanation}` : ""}`,
      false,
      explanation ?? undefined,
    );
    this.name = "LlmRefusalError";
  }
}
