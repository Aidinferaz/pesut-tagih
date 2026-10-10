import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { runDaily } from "@/server/notify/daily";

export const maxDuration = 60;

/** Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET". Anyone else gets a 401. */
function authorized(request: Request) {
  if (!env.CRON_SECRET) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runDaily());
}
