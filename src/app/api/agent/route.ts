import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { aiEnabled, languageModel } from "@/server/ai/model";
import { agentSystemPrompt } from "@/server/ai/prompts";
import { consumeQuota } from "@/server/ai/quota";
import { pesutTools } from "@/server/ai/tools";
import { getCurrentUser } from "@/server/auth";
import { getProfile } from "@/server/db/profile";
import { env } from "@/server/env";

export const maxDuration = 60;

const Body = z.object({
  locale: z.string(),
  // Bounded so a long or tampered history can't run up the bill.
  messages: z
    .array(z.looseObject({ role: z.enum(["user", "assistant"]), parts: z.array(z.unknown()) }))
    .min(1)
    .max(40),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "notSignedIn" }, { status: 401 });
  if (!aiEnabled()) return Response.json({ error: "aiDisabled" }, { status: 503 });

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || JSON.stringify(body.data.messages).length > 40_000) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  if (!(await consumeQuota("chat"))) return Response.json({ error: "quota" }, { status: 429 });

  const locale = isLocale(body.data.locale) ? body.data.locale : "id";
  const profile = await getProfile(user.id);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
  // Only the recent turns go to the model.
  const messages = (body.data.messages as unknown as UIMessage[]).slice(-12);

  const result = streamText({
    model: languageModel("agent", "chat"),
    system: agentSystemPrompt({ locale, name: profile?.name ?? "teman", today }),
    messages: await convertToModelMessages(messages),
    tools: pesutTools({ me: user.id, locale, siteUrl: env.NEXT_PUBLIC_SITE_URL }),
    stopWhen: stepCountIs(5),
    maxOutputTokens: 800,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: () => "Pesut tersedak. Coba lagi sebentar.",
    }),
  });
}
