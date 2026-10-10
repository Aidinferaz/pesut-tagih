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

    /** Shared secret Vercel Cron sends as "Authorization: Bearer <secret>". */
    CRON_SECRET: optional,

    /** Telegram bot from @BotFather. Unset means Telegram is switched off. */
    TELEGRAM_BOT_TOKEN: optional,
    TELEGRAM_BOT_USERNAME: optional,
    /** Random string; Telegram echoes it in X-Telegram-Bot-Api-Secret-Token on every webhook call. */
    TELEGRAM_WEBHOOK_SECRET: optional,

    /** Web Push keys (generate with `npx web-push generate-vapid-keys`). */
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
    VAPID_PRIVATE_KEY: optional,
    VAPID_SUBJECT: optional,

    /** WhatsApp through the Fonnte gateway; anything else keeps the wa.me share links only. */
    WA_GATEWAY: z.enum(["fonnte", "none"]).default("none"),
    FONNTE_TOKEN: optional,
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
    if (v.TELEGRAM_BOT_TOKEN && (!v.TELEGRAM_BOT_USERNAME || !v.TELEGRAM_WEBHOOK_SECRET)) {
      ctx.addIssue({
        code: "custom",
        message: "Telegram needs TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET too",
      });
    }
    if (v.WA_GATEWAY === "fonnte" && !v.FONNTE_TOKEN) {
      ctx.addIssue({ code: "custom", message: "WA_GATEWAY=fonnte needs FONNTE_TOKEN" });
    }
    if (v.VAPID_PRIVATE_KEY && (!v.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !v.VAPID_SUBJECT)) {
      ctx.addIssue({
        code: "custom",
        message: "Web Push needs NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_SUBJECT too",
      });
    }
    if (v.AI_PROVIDER === "mock" && process.env.NODE_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        message: "AI_PROVIDER=mock is for development and tests only",
      });
    }
  });

export const env = schema.parse(process.env);
