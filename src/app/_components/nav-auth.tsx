"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth/client";

function initials(input: string) {
  const parts = input.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return input.slice(0, 2).toUpperCase();
}

export function NavAuth() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>…</span>;
  }

  if (!session?.user) {
    return (
      <a href="/login" className="btn btn-primary" style={{ textDecoration: "none" }}>
        Sign in
      </a>
    );
  }

  const label = session.user.name || session.user.email;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.3rem 0.6rem 0.3rem 0.3rem",
          background: "white",
          border: "1px solid var(--border)",
          borderRadius: 999,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--brand-soft)",
            color: "var(--brand)",
            fontSize: "0.7rem",
            fontWeight: 700,
          }}
        >
          {initials(label)}
        </span>
        <span style={{ fontSize: "0.85rem", fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        style={{ fontSize: "0.85rem", padding: "0.4rem 0.7rem" }}
        onClick={async () => {
          await signOut();
          router.push("/login");
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
