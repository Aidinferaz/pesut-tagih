import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pesut Tagih",
  description: "Catat urunan, hitung siapa bayar ke siapa, dan biar Pesut yang menagih.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
