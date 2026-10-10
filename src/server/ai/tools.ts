import "server-only";
import { generateText, Output, tool } from "ai";
import { z } from "zod";
import { debtAgeDays } from "@/domain/ledger";
import { matchName } from "@/domain/names";
import { MAX_AMOUNT } from "@/domain/money";
import { providerName } from "@/domain/providers";
import { splitEqual } from "@/domain/split";
import type { Locale } from "@/i18n/config";
import { rupiah } from "@/lib/format";
import { listMyBooks, type GroupBook } from "@/server/db/ledger";
import { languageModel } from "./model";
import { reminderPrompt } from "./prompts";

/**
 * Pesut's tools. They only read, through the signed-in person's session, so
 * row level security limits them to that person's groups. The one tool that
 * looks like a write, propose_expense, returns a draft the person must
 * confirm in the UI; nothing is saved by the model.
 */
export function pesutTools({
  me,
  locale,
  siteUrl,
}: {
  me: string;
  locale: Locale;
  siteUrl: string;
}) {
  let cache: Promise<GroupBook[]> | null = null;
  const books = () => (cache ??= listMyBooks(me));
  const nameIn = (book: GroupBook, id: string) =>
    book.group.members.find((m) => m.id === id)?.name ?? "?";

  const findGroup = async (query: string | undefined) => {
    const all = await books();
    if (!query)
      return all.length === 1
        ? { book: all[0] }
        : { error: "Which group?", groups: all.map((b) => b.group.name) };
    const byId = all.find((b) => b.group.id === query);
    if (byId) return { book: byId };
    const match = matchName(all, query, (b) => b.group.name);
    return match.found
      ? { book: match.found }
      : {
          error: "Group not found or ambiguous",
          groups: (match.candidates.length ? match.candidates : all).map((b) => b.group.name),
        };
  };

  return {
    get_my_overview: tool({
      description:
        "Every group the user is in with their balance, who they should pay, who should pay them, and transfers waiting for confirmation. Call this before answering anything about money.",
      inputSchema: z.object({}),
      execute: async () =>
        (await books()).map((book) => ({
          group: book.group.name,
          group_id: book.group.id,
          my_balance: book.balances.get(me) ?? 0,
          i_should_pay: book.transfers
            .filter((r) => r.from === me)
            .map((r) => ({
              to: nameIn(book, r.to),
              amount: r.amount,
              via: r.via && providerName(r.via),
              admin_fee: r.fee,
            })),
          should_pay_me: book.transfers
            .filter((r) => r.to === me)
            .map((r) => ({ from: nameIn(book, r.from), amount: r.amount })),
          waiting_confirmation: book.settlements
            .filter((s) => s.status === "pending" && (s.from === me || s.to === me))
            .map((s) => ({ from: nameIn(book, s.from), to: nameIn(book, s.to), amount: s.amount })),
        })),
    }),

    get_group: tool({
      description:
        "One group in detail: members with balances, all suggested transfers, recent expenses.",
      inputSchema: z.object({ group: z.string().describe("Group name or id") }),
      execute: async ({ group }) => {
        const found = await findGroup(group);
        if (!("book" in found) || !found.book) return found;
        const book = found.book;
        return {
          group: book.group.name,
          members: book.group.members.map((m) => ({
            name: m.name,
            balance: book.balances.get(m.id) ?? 0,
          })),
          transfers: book.transfers.map((r) => ({
            from: nameIn(book, r.from),
            to: nameIn(book, r.to),
            amount: r.amount,
          })),
          recent_expenses: book.expenses.slice(0, 12).map((e) => ({
            number: e.number,
            title: e.title,
            total: e.total,
            paid_by: nameIn(book, e.paidBy),
            date: e.occurredOn,
          })),
        };
      },
    }),

    propose_expense: tool({
      description:
        "Prepare an expense for the user to confirm, from what they typed (e.g. 'bakso 120rb, I paid, split with Budi and Cici'). Splits evenly. Does NOT save anything.",
      inputSchema: z.object({
        group: z.string().optional().describe("Group name; omit if the user has only one group"),
        title: z.string().min(1).max(80),
        total: z.number().int().positive().max(MAX_AMOUNT).describe("Whole rupiah, e.g. 120000"),
        paid_by: z.string().optional().describe("Name of who paid; omit when it was the user"),
        participants: z
          .array(z.string())
          .optional()
          .describe(
            "Names to split between, including the user if they shared it; omit for everyone",
          ),
      }),
      execute: async ({ group, title, total, paid_by, participants }) => {
        const found = await findGroup(group);
        if (!("book" in found) || !found.book) return { ok: false as const, ...found };
        const book = found.book;
        const members = book.group.members;
        const resolve = (name: string) => matchName(members, name, (m) => m.name);

        const payer = paid_by ? resolve(paid_by) : { found: members.find((m) => m.id === me)! };
        if (!payer.found)
          return {
            ok: false as const,
            error: `Who is "${paid_by}"?`,
            members: members.map((m) => m.name),
          };

        const people = participants?.length
          ? participants.map(resolve)
          : members.map((m) => ({ found: m }));
        const unknown = participants?.filter((_, i) => !people[i].found) ?? [];
        if (unknown.length)
          return {
            ok: false as const,
            error: `Unknown: ${unknown.join(", ")}`,
            members: members.map((m) => m.name),
          };
        const chosen = [...new Map(people.map((p) => [p.found!.id, p.found!])).values()];

        const shares = splitEqual(
          total,
          chosen.map((m) => m.id),
        );
        return {
          ok: true as const,
          draft: {
            groupId: book.group.id,
            groupName: book.group.name,
            title,
            total,
            paidBy: { id: payer.found.id, name: payer.found.name },
            participants: chosen.map((m) => ({ id: m.id, name: m.name })),
            shares: shares.map((s) => ({ name: nameIn(book, s.userId), amount: s.amount })),
          },
        };
      },
    }),

    draft_reminder: tool({
      description:
        "Write a cheeky reminder for someone who owes the user money, ready to send on WhatsApp.",
      inputSchema: z.object({
        debtor: z.string().describe("Name of the person who owes the user"),
        group: z.string().optional(),
      }),
      execute: async ({ debtor, group }) => {
        const all = group
          ? [await findGroup(group)].flatMap((f) => ("book" in f && f.book ? [f.book] : []))
          : await books();
        for (const book of all) {
          const person = matchName(book.group.members, debtor, (m) => m.name).found;
          const route = person && book.transfers.find((r) => r.from === person.id && r.to === me);
          if (!person || !route) continue;
          const days = debtAgeDays(person.id, book.expenses, book.settlements, Date.now());
          const facts = {
            name: person.name,
            amount: rupiah(route.amount, locale),
            creditor: nameIn(book, me),
            group: book.group.name,
            days,
            url: `${siteUrl}/${locale}/groups/${book.group.id}`,
          };
          const { output } = await generateText({
            model: languageModel("fast", "reminder"),
            output: Output.object({ schema: z.object({ message: z.string().max(600) }) }),
            prompt: reminderPrompt(facts, locale),
            maxOutputTokens: 300,
          });
          const message = `${output.message.trim()}\n${facts.url}`;
          return {
            ok: true as const,
            to: person.name,
            amount: route.amount,
            message,
            waUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
          };
        }
        return { ok: false as const, error: `${debtor} doesn't owe the user anything right now.` };
      },
    }),
  };
}

export type PesutTools = ReturnType<typeof pesutTools>;
