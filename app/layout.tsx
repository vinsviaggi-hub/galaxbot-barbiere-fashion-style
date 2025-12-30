// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "4 Zampe",
    template: "%s · 4 Zampe",
  },
  applicationName: "4 Zampe",
  description: "Prenotazioni e assistenza per toelettatura.",
  manifest: "/manifest.webmanifest", // o "/manifest" se lo gestisci così
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}