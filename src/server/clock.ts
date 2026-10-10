import "server-only";
import { connection } from "next/server";

/** The current time for this request. Marks the render as request-time, never prerendered. */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}
