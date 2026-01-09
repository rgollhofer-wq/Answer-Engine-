export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  timeoutMs: number;
}

export interface LlmProvider {
  model: string;
  completeJson<T>(request: LlmRequest): Promise<T>;
}
