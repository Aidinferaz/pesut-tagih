import "server-only";
import { z } from "zod";

/**
 * Server configuration, validated once. A missing or malformed value fails
 * loudly at startup instead of surfacing as a confusing runtime error.
 */
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SECRET_KEY: z.string().min(20),
  /** Development only: show an email sign-in next to Google (links land in Mailpit). */
  DEV_EMAIL_LOGIN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true" && process.env.NODE_ENV !== "production"),
});

export const env = schema.parse(process.env);
