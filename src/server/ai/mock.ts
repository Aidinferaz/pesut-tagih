import "server-only";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * A free, deterministic stand-in for the real model, for development and the
 * end-to-end tests (AI_PROVIDER=mock). Never allowed in production.
 */
export type MockTask = "chat" | "receipt" | "expense-text" | "reminder";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

const CANNED: Record<Exclude<MockTask, "chat">, unknown> = {
  receipt: {
    merchant: "Warung Uji",
    items: [
      { name: "Nasi goreng", amount: 25000 },
      { name: "Es teh", amount: 5000 },
    ],
    tax: 3000,
    service: 0,
    discount: 0,
    total: 33000,
  },
  "expense-text": {
    title: "Bakso",
    total: 120000,
    paidByName: null,
    participantNames: [],
    unreadable: false,
  },
  reminder: {
    message: "Halo! Pesut di sini. Urunanmu masih ditunggu, transfer ya biar aku bisa pensiun.",
  },
};

export function mockModel(task: MockTask) {
  if (task !== "chat") {
    return new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: JSON.stringify(CANNED[task]) }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      }),
    });
  }
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const lastUser = [...prompt].reverse().find((m) => m.role === "user");
      const said =
        lastUser && Array.isArray(lastUser.content)
          ? lastUser.content.map((p) => ("text" in p ? p.text : "")).join(" ")
          : "";
      const text = `Pesut (mode uji) dengar: "${said.slice(0, 80)}". Aku belum disambungkan ke model sungguhan.`;
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            ...text.split(" ").map((word, i) => ({
              type: "text-delta" as const,
              id: "t",
              delta: (i ? " " : "") + word,
            })),
            { type: "text-end", id: "t" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              logprobs: undefined,
              usage,
            },
          ],
        }),
      };
    },
  });
}
