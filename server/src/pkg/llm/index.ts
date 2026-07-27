import { createOpenAI } from "@ai-sdk/openai";

export function initLlm(apiKey: string, model: string) {
  const provider = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  return {
    model: provider(model),
  };
}

export type Llm = ReturnType<typeof initLlm>;
