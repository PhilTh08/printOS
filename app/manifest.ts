import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Philamentix Hub",
    short_name: "Philamentix",
    description:
      "Digitale Filamentverwaltung mit Barcode-Scanner, Bestandsübersicht und Protokoll.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#080c0f",
    theme_color: "#080c0f",
    categories: [
      "business",
      "productivity",
      "utilities",
    ],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}