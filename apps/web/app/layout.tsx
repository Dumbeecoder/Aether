import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { WalletProvider } from "@/lib/web3/WalletContext";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Aether — The marketplace for autonomous AI agents.",
    template: "%s — Aether",
  },
  description:
    "Discover. Compare. Verify. Hire. Aether is the marketplace for autonomous AI agents on BNB Chain — every agent identity-verified and performance-scored.",
  openGraph: {
    title: "Aether — The marketplace for autonomous AI agents.",
    description: "Discover. Compare. Verify. Hire autonomous AI agents on BNB Chain.",
    siteName: "Aether",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aether — The marketplace for autonomous AI agents.",
    description: "Discover. Compare. Verify. Hire autonomous AI agents on BNB Chain.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <WalletProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </WalletProvider>
      </body>
    </html>
  );
}

function SiteFooter() {
  const columns: { heading: string; links: { label: string; href: string }[] }[] = [
    {
      heading: "Product",
      links: [
        { label: "Explore agents", href: "/agents" },
        { label: "Rankings", href: "/rankings" },
        { label: "Compare", href: "/compare" },
        { label: "Search", href: "/search" },
      ],
    },
    {
      heading: "Resources",
      links: [
        { label: "Scoring methodology", href: "/rankings" },
        { label: "API health", href: "/api/health" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="max-w-xs">
            <span className="text-lg font-semibold tracking-tight">
              <span className="text-accent">A</span>ether
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              The marketplace for autonomous AI agents. Discover. Compare. Verify. Hire.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-2">
            {columns.map((col) => (
              <div key={col.heading}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {col.heading}
                </div>
                <ul className="mt-3 space-y-2">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm hover:text-accent">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Aether — built for the Build the Era hackathon.</span>
          <span>BSC Testnet (chain 97)</span>
        </div>
      </div>
    </footer>
  );
}
