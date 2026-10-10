# Pesut Tagih

Aplikasi urunan untuk circle: catat pengeluaran bersama, hitung siapa harus bayar ke siapa
(dengan rute transfer yang menghindari biaya admin antarbank), dan biarkan Pesut — maskot
pesut Mahakam berjubah — yang mengingatkan dan menagih.

## Menjalankan secara lokal

```bash
nvm use            # Node 24
npm ci
cp .env.example .env.local
npm run dev
```

## Skrip

| Perintah            | Fungsi                               |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Server pengembangan                  |
| `npm test`          | Unit & property test logika keuangan |
| `npm run lint`      | ESLint                               |
| `npm run typecheck` | Pemeriksaan TypeScript               |
| `npm run format`    | Prettier                             |

## Struktur

```
src/domain/   Logika murni: uang, pembagian, penyelesaian utang (tanpa framework)
src/app/      Halaman dan route Next.js
```

Dokumentasi arsitektur dan panduan deploy menyusul di `docs/`.
