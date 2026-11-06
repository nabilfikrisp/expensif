import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export function initLlm(apiKey: string, model: string): { model: LanguageModel } {
  const provider = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  return {
    model: provider(model),
  };
}

export type Llm = ReturnType<typeof initLlm>;
