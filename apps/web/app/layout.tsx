import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Control Tower",
  description: "Admin console for agent access, policy, approval, and audit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Overview</Link>
          <Link href="/agents">Agents</Link>
          <Link href="/approvals">Approvals</Link>
          <Link href="/audit">Audit</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
