import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { NavAuth } from "./_components/nav-auth";
import { NavLinks } from "./_components/nav-links";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "Canteen — pre-order your meal",
  description: "Pre-order canteen workshop app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "saturate(180%) blur(8px)",
            WebkitBackdropFilter: "saturate(180%) blur(8px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            className="header-inner"
            style={{
              maxWidth: 1040,
              margin: "0 auto",
              padding: "0.75rem 1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
            }}
          >
            <a
              href="/menu"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                color: "var(--text)",
                fontWeight: 700,
                fontSize: "1.05rem",
                letterSpacing: "-0.01em",
                textDecoration: "none",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "var(--brand)",
                  color: "white",
                  fontSize: "1rem",
                }}
              >
                🍽
              </span>
              Canteen
            </a>
            <div style={{ flex: 1 }}>
              <NavLinks />
            </div>
            <NavAuth />
          </div>
        </header>
        <main
          className="page"
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            padding: "2rem 1.5rem 4rem",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
