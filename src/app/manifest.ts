import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pesut Tagih",
    short_name: "Pesut Tagih",
    description: "Catat urunan, hitung siapa bayar ke siapa, dan biar Pesut yang menagih.",
    start_url: "/id/home",
    scope: "/",
    display: "standalone",
    background_color: "#f3f5f0",
    theme_color: "#0b5d5e",
    lang: "id",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
