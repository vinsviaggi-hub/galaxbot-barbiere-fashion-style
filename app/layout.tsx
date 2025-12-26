import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Idee per la Testa",
  description: "Pannello prenotazioni e gestione appuntamenti.",
  applicationName: "Idee per la Testa",

  // ✅ per “Aggiungi a Home” su iPhone
  appleWebApp: {
    capable: true,
    title: "Idee per la Testa",
    statusBarStyle: "default",
  },

  // ✅ icone (Next prenderà anche app/icon.png e app/apple-icon.png)
  icons: {
    icon: [{ url: "/icon.png" }],
    apple: [{ url: "/apple-icon.png" }],
  },

  // se hai app/manifest.ts, questo endpoint esiste già:
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}