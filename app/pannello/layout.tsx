import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/pannello/manifest.webmanifest",
};

export default function PannelloLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}