# Panduan deploy

Semua layanan di bawah punya paket gratis yang cukup untuk satu circle (10–30 orang).
Urutannya penting: Supabase dulu, lalu Google, lalu Vercel.

## 1. Supabase (database, login, file)

1. Buat project di [supabase.com](https://supabase.com). Pilih region **Southeast Asia (Singapore)**
   dan simpan **database password**-nya.
2. Dari **Project Settings → API Keys**, catat:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key → `SUPABASE_SECRET_KEY` (rahasia, hanya untuk server)
3. Catat **project ref** (bagian `xxxx` dari `https://xxxx.supabase.co`).
4. Terapkan skema database. Pilih salah satu:
   - Dari laptop: `npx supabase login`, `npx supabase link --project-ref <ref>`, lalu `npx supabase db push`.
   - Lewat GitHub Actions (disarankan, lihat langkah 8).
5. **Authentication → URL Configuration**:
   - Site URL: `https://<domain-kamu>` (misal `https://pesut-tagih.vercel.app`)
   - Redirect URLs: `https://<domain-kamu>/auth/callback`
6. **Authentication → Sign In / Providers**: matikan **Email** (di produksi hanya Google), lalu
   aktifkan **Google** setelah langkah 2.

> Opsional: batasi siapa yang boleh mendaftar. Jalankan di SQL Editor:
> `insert into public.allowed_emails (email) values ('teman@gmail.com'), (...);`
> Selama tabel itu kosong, siapa pun bisa login, tapi tidak melihat apa-apa sebelum diundang ke grup.

## 2. Google OAuth

1. Di [Google Cloud Console](https://console.cloud.google.com), buat project baru.
2. **APIs & Services → OAuth consent screen**: tipe _External_, isi nama aplikasi "Pesut Tagih".
   Selama status _Testing_, tambahkan email anggota circle sebagai _test users_
   (atau _Publish app_ agar semua akun Google bisa masuk).
3. **Credentials → Create credentials → OAuth client ID** → _Web application_.
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
4. Salin **Client ID** dan **Client secret** ke Supabase (**Providers → Google**), lalu simpan.

## 3. Azure Foundry (otak Pesut)

1. Di resource Azure Foundry kamu, buat dua deployment:
   - model kecil yang bisa membaca gambar dan memanggil tool (misal `gpt-5-mini`) → `AI_AGENT_MODEL`
   - model paling murah untuk tugas pendek (misal `gpt-5-nano`) → `AI_FAST_MODEL`

   Isi variabel dengan **nama deployment**, bukan nama model, kalau keduanya berbeda.

2. Ambil endpoint dan key dari halaman resource:
   - `AZURE_OPENAI_BASE_URL=https://<resource>.services.ai.azure.com/openai/v1`
   - `AZURE_OPENAI_API_KEY=...`
3. `AI_PROVIDER=azure`. Atur jatah per orang per hari dengan `AI_DAILY_CHATS` dan `AI_DAILY_SCANS`.

Pindah ke OpenRouter nanti cukup mengganti variabel: `AI_PROVIDER=openrouter`,
`OPENROUTER_API_KEY`, dan nama model seperti `openai/gpt-5-mini`.

## 4. Bot Telegram

1. Chat [@BotFather](https://t.me/BotFather) → `/newbot`. Simpan token dan username bot.
2. Isi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (tanpa `@`), dan `TELEGRAM_WEBHOOK_SECRET`
   (string acak panjang, misal hasil `openssl rand -hex 32`).
3. Setelah aplikasi live (langkah 7), daftarkan webhook:

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d url="https://<domain-kamu>/api/telegram/webhook" \
     -d secret_token="<TELEGRAM_WEBHOOK_SECRET>" \
     -d allowed_updates='["message"]'
   ```

Anggota menyambungkan akunnya di **Pengaturan → Sambungkan Telegram**. Admin grup bisa
menyambungkan grup Telegram dari halaman grup untuk rekap mingguan.

## 5. Web Push

```bash
npx web-push generate-vapid-keys
```

Isi `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT=mailto:email-kamu`.
Di iPhone, notifikasi hanya jalan setelah Pesut Tagih ditambahkan ke Layar Utama.

## 6. WhatsApp lewat Fonnte (opsional)

1. Daftar di [fonnte.com](https://fonnte.com) dan sambungkan **nomor khusus bot**, jangan nomor pribadi:
   gateway tidak resmi melanggar ketentuan WhatsApp dan nomornya bisa diblokir.
2. `WA_GATEWAY=fonnte`, `FONNTE_TOKEN=<token device>`.

Tanpa Fonnte, Pesut tetap menyiapkan tombol "Kirim via WA" berisi pesan tagihan.

## 7. Vercel

1. Di [vercel.com](https://vercel.com), **Add New → Project**, impor repo `pesut-tagih`.
2. Isi semua variabel di **Settings → Environment Variables** (lihat `.env.example`), termasuk:
   - `NEXT_PUBLIC_SITE_URL=https://<domain-kamu>`
   - `CRON_SECRET` (string acak panjang). Vercel otomatis mengirimnya ke `/api/cron/daily`.
   - **Jangan** isi `DEV_EMAIL_LOGIN`, dan jangan pakai `AI_PROVIDER=mock` di produksi (aplikasi menolak start).
3. Deploy. Cron harian (09.00 WITA) terdaftar otomatis dari `vercel.json`.
4. Kembali ke Supabase langkah 5 kalau domainnya berubah.

## 8. GitHub Actions untuk migrasi database

Workflow migrasi hanya memakai connection string database, tanpa token Management API.

1. Di Supabase, tekan **Connect** (atas halaman project) → tab **Connection String** → pilih
   **Session pooler** (bukan _Direct connection_: runner GitHub tidak punya IPv6).
2. Salin URI-nya dan ganti `[YOUR-PASSWORD]` dengan database password.
3. Di GitHub, **Settings → Secrets and variables → Actions**, tambahkan secret `SUPABASE_DB_URL`
   berisi URI tersebut.
4. **Settings → Environments → production**: aktifkan **Required reviewers** dan tambahkan dirimu.

Setiap migrasi baru di `main` akan diterapkan setelah CI lulus dan kamu menyetujuinya
(Actions → run "Migrate production database" → **Review deployments** → **Approve and deploy**).

## Cek setelah deploy

- Login dengan Google, buat grup, undang satu teman.
- Catat urunan, tandai sudah transfer, konfirmasi.
- Tanya Pesut "aku utang berapa?" dan coba scan struk.
- Sambungkan Telegram dan aktifkan notifikasi di HP.
- Panggil cron sekali secara manual:
  `curl -H "Authorization: Bearer <CRON_SECRET>" https://<domain-kamu>/api/cron/daily`
- Cek header keamanan di [securityheaders.com](https://securityheaders.com).
