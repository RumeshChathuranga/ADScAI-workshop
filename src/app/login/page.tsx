"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const res = await signIn.email({ email, password });
        if (res.error) {
          setError(res.error.message ?? "Sign-in failed");
          return;
        }
      } else {
        const res = await signUp.email({ email, password, name });
        if (res.error) {
          setError(res.error.message ?? "Sign-up failed");
          return;
        }
      }
      router.push("/menu");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "2rem" }}>
      <section
        className="card"
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "2rem",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "1.5rem" }}>
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
            {mode === "signin"
              ? "Sign in to place orders and track pickups."
              : "It only takes a moment."}
          </p>
        </div>

        <form onSubmit={onSubmit}>
          {mode === "signup" && (
            <label style={{ display: "block", marginBottom: "0.85rem" }}>
              <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: 4 }}>
                Name
              </span>
              <input
                className="input"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label style={{ display: "block", marginBottom: "0.85rem" }}>
            <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: 4 }}>
              Email
            </span>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label style={{ display: "block", marginBottom: "1rem" }}>
            <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: 4 }}>
              Password
            </span>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>
          {error && (
            <div
              style={{
                background: "var(--danger-soft)",
                border: "1px solid var(--danger)",
                color: "var(--danger)",
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              {error}
            </div>
          )}
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: "100%" }}>
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p style={{ fontSize: "0.85rem", marginTop: "1.25rem", marginBottom: 0, textAlign: "center", color: "var(--muted)" }}>
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                style={{ background: "none", border: "none", color: "var(--brand)", padding: 0, fontWeight: 600 }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                style={{ background: "none", border: "none", color: "var(--brand)", padding: 0, fontWeight: 600 }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </section>
    </div>
  );
}
