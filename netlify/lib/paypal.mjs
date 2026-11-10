// PayPal Orders v2 via plain fetch (no SDK). Defaults to the SANDBOX; set PAYPAL_ENV=live to go live.
import catalog from "../../public/catalog.mjs";
import { fmt } from "./cart.mjs";

const base = () => (process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

async function token() {
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error("PayPal keys are not set");
  const res = await fetch(base() + "/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) throw new Error("PayPal auth failed: " + res.status);
  return (await res.json()).access_token;
}

async function api(method, path, body) {
  const res = await fetch(base() + path, {
    method,
    headers: { Authorization: "Bearer " + (await token()), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Returns { paypalOrderId, approveUrl }
export async function createPayPalOrder(order, origin) {
  const cur = catalog.currency;
  const { ok, data } = await api("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: order.id,
      custom_id: order.id,
      description: "Mistyarts order",
      amount: {
        currency_code: cur,
        value: fmt(order.total),
        breakdown: { item_total: { currency_code: cur, value: fmt(order.itemsTotal) }, shipping: { currency_code: cur, value: fmt(order.shipping) } }
      },
      items: order.lines.map((l) => ({
        name: `${l.title} (${l.sizeName})`.slice(0, 127),
        quantity: String(l.qty),
        unit_amount: { currency_code: cur, value: fmt(l.unit) },
        category: l.digital ? "DIGITAL_GOODS" : "PHYSICAL_GOODS"
      }))
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Mistyarts",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: `${origin}/?paypal=return`,
          cancel_url: `${origin}/?cancelled=1`
        }
      }
    }
  });
  if (!ok) throw new Error("PayPal create order failed: " + JSON.stringify(data).slice(0, 400));
  const link = (data.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!link) throw new Error("PayPal gave no approval link");
  return { paypalOrderId: data.id, approveUrl: link.href };
}

// Returns { completed, amount }
export async function capturePayPalOrder(paypalOrderId) {
  const { ok, data } = await api("POST", `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {});
  if (!ok) {
    const already = JSON.stringify(data).includes("ORDER_ALREADY_CAPTURED");
    if (already) return { completed: true, amount: null, already: true };
    throw new Error("PayPal capture failed: " + JSON.stringify(data).slice(0, 400));
  }
  const cap = data.purchase_units?.[0]?.payments?.captures?.[0];
  return { completed: data.status === "COMPLETED" && cap?.status === "COMPLETED", amount: cap ? Number(cap.amount.value) : null };
}
