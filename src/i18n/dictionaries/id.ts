/**
 * Indonesian is the source dictionary: its shape defines `Dictionary`, and the
 * English file must provide every key. Pesut's lines are cheeky on purpose.
 */
export const id = {
  meta: {
    title: "Pesut Tagih",
    description: "Catat urunan, hitung siapa bayar ke siapa, dan biar Pesut yang menagih.",
  },
  nav: {
    home: "Beranda",
    transfers: "Transfer",
    activity: "Aktivitas",
    askPesut: "Tanya Pesut",
    settings: "Pengaturan",
    groups: "Grup",
    newGroup: "Grup baru",
    menu: "Menu",
  },
  actions: {
    addExpense: "Catat urunan",
    askPesut: "Tanya Pesut",
    markPaid: "Sudah transfer",
    confirm: "Diterima",
    copy: "Salin",
    copied: "Tersalin",
  },
  theme: {
    label: "Tema",
    light: "Terang",
    dark: "Gelap",
    system: "Ikut sistem",
  },
  language: {
    label: "Bahasa",
    id: "Indonesia",
    en: "English",
  },
  greeting: {
    morning: "Selamat pagi, {name}",
    afternoon: "Selamat siang, {name}",
    evening: "Selamat sore, {name}",
    night: "Selamat malam, {name}",
  },
  home: {
    subtitle: "{group} · {count} anggota",
  },
  balance: {
    title: "Saldo bersih kamu",
    owe: "Kamu berutang ke {count} orang",
    owed: "{count} orang berutang ke kamu",
    even: "Lunas semua. Lambungmu mengapung rata.",
    hullLabel: "Garis air saldo: {state}",
    sinking: "tenggelam karena utang",
    floating: "mengapung, kamu dihutangi",
    level: "rata",
  },
  routes: {
    title: "Rute transfer termurah",
    you: "Kamu",
    via: "via {provider}",
    free: "bebas admin",
    fee: "admin ±{fee}",
    noMethod: "belum ada rekening",
    pendingConfirm: "menunggu konfirmasimu",
    pendingTheirs: "menunggu konfirmasi {name}",
    empty: "Tidak ada yang perlu ditransfer. Pesut menganggur.",
    others: "Antar anggota lain",
    nudge: "Tagih",
  },
  ledger: {
    title: "Buku besar grup",
    closes: "Menutup ke Rp0",
    number: "No.",
    expense: "Urunan",
    paidBy: "Dibayar",
    total: "Total",
    people: "{count} orang",
    recurring: "berulang",
    owedSide: "Dihutangi {amount}",
    oweSide: "Berutang {amount}",
  },
  pesut: {
    name: "Pesut",
    poke: [
      "Aduh. Colek-colek, bayar dulu utangnya.",
      "Jangan pencet aku, pencet tombol transfer.",
      "Aku pesut, bukan fidget toy.",
    ],
    idleOwe: "{amount}-mu ke {name} sudah {days} hari berenang sendirian. Kasihan dia.",
    idleEven: "Semua lunas. Aku jadi pengangguran berjubah.",
    sceneLabel: "Pesut, maskot voxel berjubah. Klik untuk mencolek.",
    paidLine: "Wih, tumben cepat. {name} tinggal konfirmasi, jangan kabur dulu.",
    nudgeLine: "Siap. {name} sudah kusemprot pakai pengingat. Basah kuyup dia.",
    chaseAll: "Suruh Pesut nagih",
    chaseAllLine: "Semua yang telat sudah kusemprot. Sama-sama.",
  },
  demo: {
    preview: "Pratinjau desain",
    banner: "Data contoh — belum tersambung ke database.",
  },
};

type Widen<T> = T extends string
  ? string
  : T extends readonly string[]
    ? readonly string[]
    : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof id>;
