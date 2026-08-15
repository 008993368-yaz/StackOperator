import type { ReactNode } from "react";
import Link from "next/link";
import { getViewer } from "@/lib/access";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "StackOperator",
  description: "CI decisions for GitHub native stacked pull requests",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <nav className="nav">
            <Link className="brand" href="/">
              StackOperator
            </Link>
            <div className="nav-links">
              <Link href="/">Overview</Link>
              <Link href="/stacks">Stacks</Link>
              {viewer.session ? (
                <>
                  <span className="muted">{viewer.session.login}</span>
                  <form action="/api/auth/logout" method="post">
                    <button className="btn" type="submit">
                      Log out
                    </button>
                  </form>
                </>
              ) : viewer.openAccess ? (
                <span className="muted">Open access (local)</span>
              ) : (
                <Link href="/login">Log in</Link>
              )}
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
