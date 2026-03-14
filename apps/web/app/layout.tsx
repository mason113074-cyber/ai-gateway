import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Gateway",
  description: "Admin console for agent access, policy, approval, and audit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Overview</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/agents">Agents</Link>
          <Link href="/keys">API Keys</Link>
          <Link href="/logs">Logs</Link>
          <Link href="/approvals">Approvals</Link>
          <Link href="/audit">Audit</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
