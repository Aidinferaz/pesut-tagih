import "server-only";
import { createAzure } from "@ai-sdk/azure";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { env } from "@/server/env";
import { mockModel, type MockTask } from "./mock";

/**
 * The only place that knows which LLM provider is in use. Moving from Azure
 * Foundry to OpenRouter is a change of environment variables, not of code:
 * AI_PROVIDER=openrouter, OPENROUTER_API_KEY, and model ids such as
 * "openai/gpt-5-mini" in AI_AGENT_MODEL / AI_FAST_MODEL.
 */
export type ModelRole = "agent" | "fast";

export const aiEnabled = () => env.AI_PROVIDER !== undefined;

export function languageModel(role: ModelRole, task: MockTask): LanguageModel {
  const id = role === "agent" ? env.AI_AGENT_MODEL : env.AI_FAST_MODEL;
  switch (env.AI_PROVIDER) {
    case "azure":
      return createAzure({ baseURL: env.AZURE_OPENAI_BASE_URL, apiKey: env.AZURE_OPENAI_API_KEY })(
        id,
      );
    case "openrouter":
      return createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })(id);
    case "mock":
      return mockModel(task);
    default:
      throw new Error("AI is not configured (AI_PROVIDER is unset)");
  }
}
