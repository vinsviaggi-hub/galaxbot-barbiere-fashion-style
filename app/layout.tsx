// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Fashion Style",
    template: "%s · Fashion Style",
  },
  applicationName: "Fashion Style",
  description: "Prenotazioni barber shop e assistenza su WhatsApp.",
  manifest: "/manifest.webmanifest",

  // ✅ Icone: IMPORTANTISSIMO per iPhone (usa apple-touch-icon.png)
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },

  // ✅ Aiuta iOS/Safari a trattarla come “app”
  appleWebApp: {
    capable: true,
    title: "Fashion Style",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}