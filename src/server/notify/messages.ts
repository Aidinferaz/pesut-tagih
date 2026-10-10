import "server-only";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/format";

/**
 * What Pesut says outside the app. Written by hand rather than generated, so
 * the daily job costs nothing and never goes off-script. The longer a debt
 * waits, the more dramatic the roast; never cruel (see the prompts' rules).
 */

type Tier = { from: number; lines: Record<Locale, string[]> };

const REMINDERS: Tier[] = [
  {
    from: 0,
    lines: {
      id: [
        "Psst, {name}. {amount} buat {creditor} di {group} lagi nunggu dijemput. Jangan sampai dia kedinginan.",
        "Halo {name}! Pesut di sini. Ada {amount} buat {creditor} ({group}) yang belum berangkat. Yuk antar.",
      ],
      en: [
        "Psst, {name}. {amount} for {creditor} in {group} is waiting to be picked up. Don't leave it out in the cold.",
        "Hi {name}! Pesut here. {amount} for {creditor} ({group}) hasn't set off yet. Shall we send it?",
      ],
    },
  },
  {
    from: 3,
    lines: {
      id: [
        "{name}, sudah {days} hari {amount}-mu ke {creditor} berenang sendirian di {group}. Dia mulai bikin puisi sedih.",
        "Kabar dari Sungai Mahakam: {amount} untuk {creditor} masih belum sampai, {name}. Sudah {days} hari. Pesut mulai curiga.",
      ],
      en: [
        "{name}, your {amount} for {creditor} has been swimming alone in {group} for {days} days. It's started writing sad poetry.",
        "News from the Mahakam: {amount} for {creditor} still hasn't arrived, {name}. {days} days now. Pesut is getting suspicious.",
      ],
    },
  },
  {
    from: 7,
    lines: {
      id: [
        "{name}. {days} hari. {amount}. {creditor} masih menunggu di dermaga {group} sambil menatap cakrawala. Tolong, demi drama ini segera berakhir.",
        "Pesut sudah pakai jubah untuk urusan ini, {name}. {amount} ke {creditor}, telat {days} hari. Jangan paksa aku menyemprot.",
      ],
      en: [
        "{name}. {days} days. {amount}. {creditor} is still waiting on the pier of {group}, staring at the horizon. Please, end this drama.",
        "Pesut has put on the cape for this one, {name}. {amount} to {creditor}, {days} days late. Don't make me use the water jet.",
      ],
    },
  },
  {
    from: 14,
    lines: {
      id: [
        "Ini pengingat ke-sekian, {name}. {amount} untuk {creditor} sudah {days} hari jadi legenda di {group}. Anak cucu pesut akan menceritakannya.",
        "{days} hari, {name}. Bahkan buaya Mahakam sudah bayar utangnya. {amount} ke {creditor}, sekarang ya.",
      ],
      en: [
        "Reminder number who-knows, {name}. {amount} for {creditor} has been a legend in {group} for {days} days. Future dolphins will tell the tale.",
        "{days} days, {name}. Even the Mahakam crocodiles have paid their debts. {amount} to {creditor}, now please.",
      ],
    },
  },
];

/** A stable choice, so a re-run of the same day's job picks the same line. */
function pick<T>(items: T[], seed: string): T {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return items[Math.abs(h) % items.length];
}

export function reminderText(
  locale: Locale,
  facts: { name: string; amount: string; creditor: string; group: string; days: number },
  seed: string,
) {
  const tier = [...REMINDERS].reverse().find((t) => facts.days >= t.from) ?? REMINDERS[0];
  return format(pick(tier.lines[locale], seed), facts);
}

const EVENTS = {
  id: {
    expenseLogged: "{actor} mencatat {title} di {group}. Bagianmu {amount}.",
    paid: "{actor} bilang sudah transfer {amount} ke kamu ({group}). Cek rekening, lalu konfirmasi di Pesut Tagih.",
    confirmed: "{actor} sudah menerima transfermu {amount} ({group}). Lunas! Pesut bangga.",
    rejected: "{actor} bilang transfer {amount} ({group}) belum masuk. Cek lagi ya.",
    recapTitle: "Rekap mingguan {group}",
    recapLine: "• {from} → {to}",
    recapLineAmount: "• {from} → {to}: {amount}",
    recapEmpty: "Semua lunas minggu ini. Pesut boleh libur.",
    open: "Buka Pesut Tagih",
    linked: "Tersambung! Mulai sekarang Pesut akan menagih dan mengabari kamu di sini.",
    linkHelp:
      'Untuk menyambungkan akun, buka Pengaturan di Pesut Tagih lalu tekan "Sambungkan Telegram".',
    groupLinked: "Grup ini sekarang tersambung ke {group}. Pesut akan kirim rekap tiap Senin.",
    groupLinkHelp:
      "Buat kode di halaman grup Pesut Tagih (khusus admin), lalu kirim /hubungkan <kode> di sini.",
    unlinked: "Oke, Pesut tidak akan mengirim pesan ke sini lagi.",
  },
  en: {
    expenseLogged: "{actor} logged {title} in {group}. Your share is {amount}.",
    paid: "{actor} says they sent you {amount} ({group}). Check your account, then confirm in Pesut Tagih.",
    confirmed: "{actor} received your {amount} ({group}). Settled! Pesut is proud.",
    rejected: "{actor} says the {amount} ({group}) hasn't arrived. Please check.",
    recapTitle: "Weekly recap for {group}",
    recapLine: "• {from} → {to}",
    recapLineAmount: "• {from} → {to}: {amount}",
    recapEmpty: "All settled this week. Pesut gets a day off.",
    open: "Open Pesut Tagih",
    linked: "Connected! From now on Pesut will chase and update you here.",
    linkHelp: 'To connect your account, open Settings in Pesut Tagih and press "Connect Telegram".',
    groupLinked: "This chat is now linked to {group}. Pesut will post a recap every Monday.",
    groupLinkHelp:
      "Create a code on the group page in Pesut Tagih (admins only), then send /hubungkan <code> here.",
    unlinked: "Okay, Pesut won't message you here any more.",
  },
} as const;

export type EventKey = keyof (typeof EVENTS)["id"];

export function eventText(
  locale: Locale,
  key: EventKey,
  vars: Record<string, string | number> = {},
) {
  return format(EVENTS[locale][key], vars);
}
