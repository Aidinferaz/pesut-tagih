/**
 * Synthetic sample data for the design preview. Every name, amount and date
 * here is invented. It runs through the real domain logic, so the balances and
 * routes on screen are what the app would actually compute.
 */
import type { ProviderCode } from "@/domain/providers";
import { computeBalances, planSettlement, type ExpenseEntry } from "@/domain/settle";
import { splitEqual } from "@/domain/split";

export type Member = { id: string; name: string; methods: ProviderCode[] };
export type Group = { id: string; name: string; hull: "band" | "action" | "surface" | "debt" };
export type Expense = ExpenseEntry & {
  number: number;
  title: string;
  total: number;
  recurring?: boolean;
  daysAgo: number;
};

export const ME = "aidin";

export const members: Member[] = [
  { id: "aidin", name: "Aidin", methods: ["bca", "gopay"] },
  { id: "rani", name: "Rani", methods: ["bca", "dana"] },
  { id: "dimas", name: "Dimas", methods: ["gopay", "mandiri"] },
  { id: "bayu", name: "Bayu", methods: ["jago", "gopay"] },
  { id: "nadia", name: "Nadia", methods: ["bca"] },
  { id: "fikri", name: "Fikri", methods: ["dana", "bca"] },
];

export const groups: Group[] = [
  { id: "circle", name: "Circle Pesut", hull: "band" },
  { id: "derawan", name: "Trip Derawan", hull: "action" },
  { id: "kos", name: "Kos Lt.2", hull: "surface" },
  { id: "langganan", name: "Langganan", hull: "debt" },
];

const expense = (
  number: number,
  title: string,
  total: number,
  paidBy: string,
  people: string[],
  daysAgo: number,
  recurring = false,
): Expense => ({
  number,
  title,
  total,
  paidBy,
  shares: splitEqual(total, people),
  daysAgo,
  recurring,
});

export const expenses: Expense[] = [
  expense(
    141,
    "Bakso Pak Kumis",
    186_000,
    "rani",
    ["aidin", "rani", "dimas", "nadia", "fikri", "bayu"],
    9,
  ),
  expense(140, "Bensin ke Tenggarong", 150_000, "dimas", ["aidin", "dimas", "bayu"], 6),
  expense(139, "Netflix Oktober", 186_000, "bayu", ["aidin", "rani", "nadia", "bayu"], 4, true),
  expense(138, "Kopi Janji Jiwa", 96_000, "nadia", ["nadia", "fikri", "aidin"], 2),
];

export const methodBook = new Map(members.map((m) => [m.id, m.methods]));
export const balances = computeBalances(expenses);
export const transfers = planSettlement({ expenses, methods: methodBook, simplify: true });
export const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? id;
