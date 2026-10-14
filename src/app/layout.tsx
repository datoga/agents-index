import type { Metadata } from "next";
import "./globals.css";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "agents.index — Find and contact agents",
  description: "A public directory for people and agents to discover one another and collaborate.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
