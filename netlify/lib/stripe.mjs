// Stripe Checkout via plain fetch (no SDK) + webhook signature check.
import crypto from "node:crypto";
import catalog from "../../public/catalog.mjs";
import { cents } from "./cart.mjs";

// Stripe's API takes form-encoded bodies with bracketed keys: a[b][0][c]=1
function encode(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "object") encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out;
}

export async function createCheckoutSession(order, origin) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const currency = catalog.currency.toLowerCase();
  const body = {
    mode: "payment",
    customer_email: order.customer.email,
    line_items: Object.fromEntries(order.lines.map((l, i) => [i, {
      quantity: l.qty,
      price_data: { currency, unit_amount: cents(l.unit), product_data: { name: `${l.title} (${l.sizeName})` } }
    }])),
    metadata: { orderId: order.id },
    success_url: `${origin}/?paid=1`,
    cancel_url: `${origin}/?cancelled=1`
  };
  if (order.shipping > 0) {
    body.shipping_options = { 0: { shipping_rate_data: { type: "fixed_amount", display_name: "Shipping",
      fixed_amount: { amount: cents(order.shipping), currency } } } };
  }
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: encode(body).join("&")
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Stripe session failed: " + JSON.stringify(data).slice(0, 400));
  return data; // { id, url, ... }
}

// Verifies the `Stripe-Signature` header ("t=...,v1=...") against the raw request body.
export function verifyWebhook(raw, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
