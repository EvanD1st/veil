import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VEIL — Good taste. Quiet bids.",
  description: "A private auction house. Discover something extraordinary, seal your offer, and reveal the winning price.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
