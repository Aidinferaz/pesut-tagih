import "server-only";
import { z } from "zod";

/**
 * Server configuration, validated once. A missing or malformed value fails
 * loudly at startup instead of surfacing as a confusing runtime error.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const schema = z
  .object({
    NEXT_PUBLIC_SITE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
    SUPABASE_SECRET_KEY: z.string().min(20),
    /** Development only: show an email sign-in next to Google (links land in Mailpit). */
    DEV_EMAIL_LOGIN: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true" && process.env.NODE_ENV !== "production"),

    /** Which LLM backs Pesut. Unset means the AI features are switched off. */
    AI_PROVIDER: z.enum(["azure", "openrouter", "mock"]).optional(),
    /** Microsoft Foundry OpenAI v1 endpoint, e.g. https://<resource>.services.ai.azure.com/openai/v1 */
    AZURE_OPENAI_BASE_URL: optional,
    AZURE_OPENAI_API_KEY: optional,
    OPENROUTER_API_KEY: optional,
    /** Deployment (Azure) or model id (OpenRouter) for the chat agent and receipt reading. */
    AI_AGENT_MODEL: z.string().default("gpt-5-mini"),
    /** A cheaper model for short jobs: reminder messages, parsing a typed expense. */
    AI_FAST_MODEL: z.string().default("gpt-5-nano"),
    AI_DAILY_CHATS: z.coerce.number().int().min(0).default(40),
    AI_DAILY_SCANS: z.coerce.number().int().min(0).default(10),
  })
  .superRefine((v, ctx) => {
    if (v.AI_PROVIDER === "azure" && (!v.AZURE_OPENAI_BASE_URL || !v.AZURE_OPENAI_API_KEY)) {
      ctx.addIssue({
        code: "custom",
        message: "AI_PROVIDER=azure needs AZURE_OPENAI_BASE_URL and AZURE_OPENAI_API_KEY",
      });
    }
    if (v.AI_PROVIDER === "openrouter" && !v.OPENROUTER_API_KEY) {
      ctx.addIssue({ code: "custom", message: "AI_PROVIDER=openrouter needs OPENROUTER_API_KEY" });
    }
    if (v.AI_PROVIDER === "mock" && process.env.NODE_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        message: "AI_PROVIDER=mock is for development and tests only",
      });
    }
  });

export const env = schema.parse(process.env);
