# Pesut Tagih

Aplikasi urunan untuk circle Pesut. Catat pengeluaran bersama, lihat siapa harus transfer ke siapa
lewat rute yang bebas biaya admin, dan biarkan Pesut, pesut Mahakam voxel berjubah, yang
mengingatkan dan menagih.

- **Catat urunan** dengan bagi rata, nominal pasti, atau per item (pajak, service, diskon dibagi
  proporsional). Bisa juga dari foto struk atau satu kalimat ("bakso 120rb, aku yang bayar").
- **Rute transfer termurah**: utang diringkas jadi transfer sesedikit mungkin, dan pengirim
  dipasangkan dengan penerima yang memakai bank/e-wallet yang sama.
- **Bayar → bukti → konfirmasi**, dengan konfirmasi otomatis bila penerima lupa.
- **Tagihan bulanan** (Netflix, WiFi) dibuat otomatis.
- **Pesut menagih** lewat Telegram, notifikasi HP, dan WhatsApp, makin telat makin pedas.
- **Tanya Pesut**: agent AI yang menjawab dari buku besar dan menyiapkan pesan tagihan.
- **Transparan**: buku besar per grup dan log aktivitas yang tidak bisa diubah.
- Bahasa Indonesia & Inggris, tema terang & gelap, bisa di-install sebagai aplikasi (PWA).

## Menjalankan secara lokal

Butuh Node 24 dan Docker.

```bash
nvm use
npm ci
npm run db:start          # Supabase lokal; mencetak URL dan key
cp .env.example .env.local
```

Isi `.env.local` dengan URL dan key dari `db:start`, lalu tambahkan untuk development:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DEV_EMAIL_LOGIN=true      # login lewat email; tautannya muncul di Mailpit (localhost:58324)
AI_PROVIDER=mock          # jawaban AI palsu yang gratis
```

```bash
npm run dev
```

## Skrip

| Perintah                             | Fungsi                               |
| ------------------------------------ | ------------------------------------ |
| `npm run dev`                        | Server pengembangan                  |
| `npm test`                           | Unit & property test logika keuangan |
| `npm run db:test`                    | Test keamanan database (pgTAP)       |
| `npm run test:e2e`                   | Test end-to-end (Playwright)         |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript                  |
| `npm run db:reset`                   | Ulang database lokal dari migrasi    |
| `npm run db:types`                   | Generate tipe TypeScript dari skema  |

## Dokumentasi

- [Arsitektur](docs/architecture.md): peta folder, cara saldo dihitung, model keamanan.
- [Panduan deploy](docs/deploy.md): Supabase, Google OAuth, Azure Foundry, Telegram, Vercel.
