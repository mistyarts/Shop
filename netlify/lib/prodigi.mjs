// ALL Prodigi API calls live in this one file. If anything differs from the OpenAPI spec you
// downloaded (field names, endpoints), this is the only place to change.
//
// Defaults to the SANDBOX (no real orders). Set PRODIGI_ENV=live to go live.
import catalog from "../../public/catalog.mjs";
import { HttpError } from "./cart.mjs";

const base = () =>
  process.env.PRODIGI_ENV === "live" ? "https://api.prodigi.com/v4.0" : "https://api.sandbox.prodigi.com/v4.0";

async function call(method, path, body) {
  if (!process.env.PRODIGI_API_KEY) throw new Error("PRODIGI_API_KEY is not set");
  const res = await fetch(base() + path, {
    method,
    headers: { "X-API-Key": process.env.PRODIGI_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`Prodigi ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return data;
}

// URL of the full-resolution file Prodigi downloads and prints from.
export function printUrl(pieceId, assetBase) {
  return `${assetBase.replace(/\/$/, "")}/${pieceId}.jpg`;
}

function items(lines, assetBase) {
  return lines.filter((l) => !l.digital).map((l) => ({
    merchantReference: `${l.pieceId}-${l.sizeId}`,
    sku: l.sku,
    copies: l.qty,
    sizing: "fillPrintArea",
    attributes: {},
    assets: [{ printArea: "default", url: printUrl(l.pieceId, assetBase) }]
  }));
}

// Shipping cost for these items to a country, in the catalog currency.
export async function quoteShipping(lines, countryCode, assetBase) {
  const data = await call("POST", "/quotes", {
    shippingMethod: catalog.shippingMethod,
    destinationCountryCode: countryCode,
    currencyCode: catalog.currency,
    items: items(lines, assetBase).map((i) => ({ sku: i.sku, copies: i.copies, attributes: i.attributes, assets: [{ printArea: "default" }] }))
  });
  const q = (data.quotes || []).find((x) => x.shipmentMethod === catalog.shippingMethod) || (data.quotes || [])[0];
  const amount = Number(q?.costSummary?.shipping?.amount);
  if (!q || !Number.isFinite(amount)) throw new Error("Prodigi quote had no shipping amount: " + JSON.stringify(data).slice(0, 400));
  return Math.round(amount * 100) / 100;
}

// Creates the print order. idempotencyKey makes a retried call safe (no double printing).
export async function createOrder({ orderId, customer, lines, assetBase }) {
  const data = await call("POST", "/Orders", {
    merchantReference: orderId,
    idempotencyKey: orderId,
    shippingMethod: catalog.shippingMethod,
    recipient: {
      name: customer.name,
      email: customer.email,
      phoneNumber: customer.phone || undefined,
      address: customer.address
    },
    items: items(lines, assetBase)
  });
  if (data.outcome && !/^created|^onhold|^alreadycreated/i.test(data.outcome)) {
    throw new Error("Prodigi order outcome: " + data.outcome + " " + JSON.stringify(data).slice(0, 400));
  }
  return data;
}

// Used by scripts/check-skus.mjs
export async function getProduct(sku) {
  return call("GET", `/products/${encodeURIComponent(sku)}`);
}

export { HttpError };
