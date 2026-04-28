"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/client";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: string;
  available: boolean;
};

type SlotWithAvailability = {
  id: string | null;
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
  orderCount: number;
  remaining: number;
  isFull: boolean;
};

type Cart = Record<string, number>;

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const categoryEmoji: Record<string, string> = {
  main: "🍛",
  drink: "🥤",
  snack: "🥟",
  dessert: "🍰",
};

export function MenuClient({ items }: { items: MenuItem[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [cart, setCart] = useState<Cart>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSlotLabel, setSuccessSlotLabel] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // ── Slot picker state ────────────────────────────────────────────────────
  const [slots, setSlots] = useState<SlotWithAvailability[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotWithAvailability | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      try {
        const r = await fetch("/api/pickup-slots");
        const data = await r.json();

        if (!r.ok) {
          throw new Error("Failed to load pickup slots.");
        }

        if (!Array.isArray(data)) {
          throw new Error("Received an invalid pickup slots response.");
        }

        if (!cancelled) {
          setSlots(data);
        }
      } catch {
        if (!cancelled) {
          setSlots([]);
          setError("Unable to load pickup slots. Please try again later.");
        }
      } finally {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      }
    }

    void loadSlots();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Menu grouping ────────────────────────────────────────────────────────
  const byCategory = useMemo(() => {
    return items.reduce<Record<string, MenuItem[]>>((acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    }, {});
  }, [items]);

  const totalCents = useMemo(() => {
    return items.reduce((sum, item) => sum + (cart[item.id] ?? 0) * item.priceCents, 0);
  }, [items, cart]);

  const totalCount = Object.values(cart).reduce((a, b) => a + b, 0);

  function setQty(id: string, qty: number) {
    setSuccessId(null);
    setSuccessSlotLabel(null);
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  async function placeOrder() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Object.entries(cart).map(([menuItemId, quantity]) => ({
            menuItemId,
            quantity,
          })),
          pickupSlotStartTime: selectedSlot?.startTime ?? undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const order = await res.json();
      setCart({});
      setSuccessId(order.id);
      setSuccessSlotLabel(
        order.pickupSlot?.label ?? selectedSlot?.label ?? null,
      );
      setSelectedSlot(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const loggedIn = !!session?.user;
  const canOrder = totalCount > 0 && !!selectedSlot;

  return (
    <section>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", margin: "0 0 0.4rem" }}>Today&apos;s menu</h1>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: "1rem" }}>
          Pre-order now — pick it up hot and skip the line.
        </p>
      </div>

      {successId && (
        <div
          style={{
            background: "var(--success-soft)",
            border: "1px solid var(--success)",
            color: "var(--success)",
            padding: "0.85rem 1rem",
            borderRadius: "var(--radius)",
            marginBottom: "1.25rem",
            fontSize: "0.9rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <span>
            <strong>Order placed.</strong>{" "}
            {successSlotLabel
              ? `Pick up at ${successSlotLabel}. ✓`
              : "We'll have it ready shortly."}
          </span>
          <a
            href="/orders"
            className="btn btn-secondary"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
          >
            View orders →
          </a>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "var(--danger-soft)",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            padding: "0.85rem 1rem",
            borderRadius: "var(--radius)",
            marginBottom: "1.25rem",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {Object.entries(byCategory).map(([category, list]) => (
        <div key={category} style={{ marginBottom: "2.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
            <span aria-hidden style={{ fontSize: "1.2rem" }}>
              {categoryEmoji[category] ?? "•"}
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: "1.05rem",
                textTransform: "capitalize",
                fontWeight: 700,
              }}
            >
              {category}
            </h2>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{list.length} items</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.6rem" }}>
            {list.map((item) => {
              const qty = cart[item.id] ?? 0;
              return (
                <li
                  key={item.id}
                  className={item.available ? "card menu-item" : "card"}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "1rem 1.1rem",
                    background: item.available ? "var(--card)" : "var(--card-alt)",
                    opacity: item.available ? 1 : 0.7,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "1rem" }}>{item.name}</div>
                    {item.description && (
                      <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    )}
                    {!item.available && (
                      <span className="badge badge-soldout" style={{ marginTop: 6 }}>
                        Sold out
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexShrink: 0 }}>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, fontSize: "0.95rem" }}>
                      {formatPrice(item.priceCents)}
                    </span>
                    {item.available && qty === 0 && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          if (!loggedIn) {
                            router.push("/login");
                            return;
                          }
                          setQty(item.id, 1);
                        }}
                      >
                        Add
                      </button>
                    )}
                    {item.available && loggedIn && qty > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          background: "var(--card-alt)",
                          borderRadius: 8,
                          padding: "0.25rem 0.4rem",
                        }}
                      >
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => setQty(item.id, qty - 1)}
                          aria-label="Decrease"
                        >
                          −
                        </button>
                        <span style={{ minWidth: 18, textAlign: "center", fontWeight: 600, fontSize: "0.9rem" }}>
                          {qty}
                        </span>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => setQty(item.id, qty + 1)}
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* ── Slot picker ─────────────────────────────────────────────────── */}
      {loggedIn && (
        <div
          className="card"
          style={{
            padding: "1.1rem 1.25rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.85rem",
            }}
          >
            <span aria-hidden style={{ fontSize: "1.1rem" }}>📅</span>
            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Choose your pickup time</span>
            {selectedSlot && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "0.8rem",
                  color: "var(--brand)",
                  fontWeight: 600,
                }}
              >
                {selectedSlot.label}
              </span>
            )}
          </div>

          {slotsLoading ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
              Loading available slots…
            </p>
          ) : slots.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
              No slots available today.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                overflowX: "auto",
                paddingBottom: "0.25rem",
                // Hide scrollbar on webkit but still scrollable
                scrollbarWidth: "none",
              }}
            >
              {slots.map((slot) => {
                const isSelected = selectedSlot?.startTime === slot.startTime;
                return (
                  <button
                    key={slot.startTime}
                    type="button"
                    disabled={slot.isFull}
                    onClick={() => setSelectedSlot(isSelected ? null : slot)}
                    style={{
                      flexShrink: 0,
                      border: isSelected
                        ? "2px solid var(--brand)"
                        : "1.5px solid var(--border-strong)",
                      borderRadius: "999px",
                      padding: "0.4rem 0.9rem",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      background: isSelected ? "var(--brand-soft)" : "var(--card)",
                      color: isSelected
                        ? "var(--brand)"
                        : slot.isFull
                          ? "var(--muted)"
                          : "var(--text)",
                      cursor: slot.isFull ? "not-allowed" : "pointer",
                      opacity: slot.isFull ? 0.55 : 1,
                      transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.15rem",
                      lineHeight: 1.2,
                      minWidth: "5.5rem",
                    }}
                    aria-pressed={isSelected}
                    aria-label={`${slot.label} — ${slot.isFull ? "Full" : `${slot.remaining} left`}`}
                  >
                    <span>{slot.label}</span>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 500,
                        color: slot.isFull
                          ? "var(--danger)"
                          : slot.remaining <= 2
                            ? "var(--warning)"
                            : "var(--muted)",
                      }}
                    >
                      {slot.isFull ? "Full ✗" : `${slot.remaining} left`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Sticky cart bar ──────────────────────────────────────────────── */}
      {totalCount > 0 && (
        <div
          style={{
            position: "sticky",
            bottom: "1rem",
            background: "#0f172a",
            color: "white",
            padding: "0.85rem 1rem 0.85rem 1.25rem",
            borderRadius: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "var(--shadow-lg)",
            marginTop: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--brand)",
                fontSize: "0.85rem",
                fontWeight: 700,
              }}
            >
              {totalCount}
            </span>
            <div style={{ fontSize: "0.95rem" }}>
              <div style={{ fontSize: "0.75rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Your order
              </div>
              <strong style={{ fontVariantNumeric: "tabular-nums", fontSize: "1.05rem" }}>
                {formatPrice(totalCents)}
              </strong>
              {selectedSlot && (
                <div style={{ fontSize: "0.72rem", opacity: 0.75, marginTop: 1 }}>
                  Pickup: {selectedSlot.label}
                </div>
              )}
              {!selectedSlot && loggedIn && (
                <div style={{ fontSize: "0.72rem", opacity: 0.6, marginTop: 1, color: "#fbbf24" }}>
                  Select a pickup time ↑
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={placeOrder}
            disabled={submitting || !canOrder}
            className="btn btn-light"
          >
            {submitting ? "Placing…" : "Place order →"}
          </button>
        </div>
      )}
    </section>
  );
}
