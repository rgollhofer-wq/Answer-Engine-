import OpenAI from "openai";
import { LlmProvider, LlmRequest } from "./llm.js";

export class OpenAiProvider implements LlmProvider {
  public readonly model: string;
  private readonly client: OpenAI;

  constructor(options: { apiKey: string; model: string; timeoutMs: number }) {
    this.model = options.model;
    this.client = new OpenAI({ apiKey: options.apiKey, timeout: options.timeoutMs });
  }

  async completeJson<T>(request: LlmRequest): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: request.temperature,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content) as T;
  }
}
