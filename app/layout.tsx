import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VEIL — Digital discoveries. Private bids.",
  description: "Digital goods, sealed bids and verifiable winners. Experimental Zcash testnet payments and protected downloads.",
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
