import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Knowledge — Anlat & Öğren",
    short_name: "Knowledge",
    description: "Anlamadığını sor, bildiğini anlat ve birlikte öğren.",
    start_url: "/sorular",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#070b14",
    theme_color: "#070b14",
    categories: ["education", "social"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
