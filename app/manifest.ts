import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Real-Life RPG",
    short_name: "RL-RPG",
    description: "Тіло та навички як ігровий персонаж",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
