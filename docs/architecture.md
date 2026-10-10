# Arsitektur

Pesut Tagih adalah satu aplikasi Next.js (App Router) di atas Supabase. Tidak ada server
terpisah: halaman, aksi, API, dan cron hidup di repo ini.

```
Browser ── Next.js (Vercel) ──► Supabase Postgres (RLS di semua tabel)
              │                  Supabase Storage (struk, bukti transfer, QRIS)
              ├─► LLM (Azure Foundry / OpenRouter)      src/server/ai
              ├─► Telegram · Web Push · Fonnte          src/server/notify
              └─► /api/cron/daily (Vercel Cron, 09.00 WITA)
```

## Peta folder

| Folder                 | Isi                                                                             | Aturan                                                                        |
| ---------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/domain/`          | Logika murni: uang, pembagian, penyelesaian utang, umur utang, jadwal pengingat | Tidak boleh mengimpor Next, React, atau Supabase. Semua diuji di `*.test.ts`. |
| `src/server/db/`       | Query baca, selalu lewat sesi orang yang login                                  | RLS yang memutuskan apa yang terlihat.                                        |
| `src/server/actions/`  | Server actions (form)                                                           | Semua input divalidasi zod. Penulisan multi-baris lewat fungsi database.      |
| `src/server/ai/`       | Pemilih provider, prompt, tool agent, kuota                                     | Satu-satunya tempat yang tahu provider LLM.                                   |
| `src/server/notify/`   | Kanal pesan, template, dispatcher, cron harian                                  | Memakai secret key; tidak pernah melayani permintaan browser.                 |
| `src/components/`      | UI, dikelompokkan per fitur                                                     | Komponen tidak menjalankan query sendiri.                                     |
| `src/i18n/`            | Kamus `id` (sumber) dan `en`                                                    | Tipe `Dictionary` memaksa `en` punya semua kunci.                             |
| `supabase/migrations/` | Skema, RLS, fungsi                                                              | Satu file per perubahan; jangan edit migrasi yang sudah di produksi.          |
| `supabase/tests/`      | Test pgTAP untuk RLS dan fungsi                                                 | Dijalankan `npm run db:test` dan di CI.                                       |
| `e2e/`                 | Test Playwright dari sudut pandang pengguna                                     | Memakai login email dev dan AI mock.                                          |

## Cara saldo dihitung

Saldo **tidak disimpan**. Setiap kali halaman dibuka:

1. `expense_shares` menyatakan berapa bagian tiap orang di tiap urunan (jumlahnya selalu sama
   dengan total; dijaga constraint di database).
2. `groupPosition` (`src/domain/ledger.ts`) menghitung saldo dari urunan dan transfer yang sudah
   dikonfirmasi, lalu `simplifyDebts` (`src/domain/settle.ts`) menyusun transfer sesedikit mungkin,
   mengutamakan pasangan yang memakai bank/e-wallet yang sama.
3. Transfer yang masih menunggu konfirmasi tidak mengubah saldo, tapi sudah dikeluarkan dari saran
   transfer supaya tidak dibayar dua kali.

Uang selalu rupiah bulat (integer). Pembagian memakai metode sisa terbesar (`allocate` di
`src/domain/money.ts`) sehingga jumlah bagian selalu pas dengan total.

## Model keamanan

- **RLS di semua tabel.** Orang hanya bisa membaca grup tempat dia menjadi anggota. Kolom yang boleh
  diubah dibatasi dengan _column grant_, bukan hanya policy.
- **Penulisan penting lewat fungsi `security definer`** (`create_expense`, `mark_paid`,
  `decide_settlement`, ...) yang memeriksa `auth.uid()` sendiri. Tabel buku besar tidak bisa
  ditulis langsung dari browser.
- **Log aktivitas append-only**, diisi trigger; tidak ada yang bisa mengubah atau menghapusnya.
- **Secret key hanya di server** (`server-only`): cron, webhook Telegram, dan notifikasi.
- **Token** (undangan, Telegram) disimpan sebagai hash SHA-256 dan kedaluwarsa.
- **AI**: tool agent hanya membaca lewat sesi pengguna; usulan urunan harus disimpan oleh pengguna;
  isi data pengguna diperlakukan sebagai data, bukan instruksi; ada kuota harian per orang.
- **Header**: CSP, HSTS, `frame-ancestors 'none'`, dan lainnya di `next.config.ts`.

## Menambah sesuatu

- **Bank/e-wallet baru**: tambahkan di `src/domain/providers.ts` **dan** buat migrasi yang
  memperbarui check constraint `payment_methods.provider`.
- **Teks baru**: tambahkan kunci di `src/i18n/dictionaries/id.ts`; TypeScript akan menagih versi `en`.
- **Kolom/tabel baru**: buat migrasi (`npx supabase migration new <nama>`), aktifkan RLS,
  tulis test pgTAP, lalu `npm run db:types`.
- **Provider LLM baru**: satu `case` di `src/server/ai/model.ts`.

## Test

| Perintah           | Yang diuji                                  |
| ------------------ | ------------------------------------------- |
| `npm test`         | Logika domain (unit + property test)        |
| `npm run db:test`  | RLS dan fungsi database (pgTAP)             |
| `npm run test:e2e` | Alur pengguna lengkap di desktop dan mobile |

CI menjalankan semuanya, ditambah lint, typecheck, `npm audit`, build, CodeQL, dan gitleaks.
