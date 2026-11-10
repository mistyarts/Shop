import { priceCart, validateCustomer, HttpError } from "./cart.mjs";
import { quoteShipping } from "./prodigi.mjs";
import { saveOrder } from "./store.mjs";

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function readJson(req) {
  try { return await req.json(); } catch { throw new HttpError(400, "Bad request."); }
}

export const originOf = (req) => process.env.SITE_URL || new URL(req.url).origin;
// Where Prodigi downloads the full-resolution print files from.
export const assetBaseOf = (origin) => process.env.PRINT_ASSET_BASE || `${origin}/print`;

export function errorResponse(err) {
  if (err instanceof HttpError) return json(err.status, { error: err.message });
  console.error(err);
  return json(500, { error: "Something went wrong on our side. Please try again in a moment." });
}

async function shippingFor(priced, countryCode, origin) {
  if (!priced.hasPhysical) return 0;
  try {
    return await quoteShipping(priced.lines, countryCode, assetBaseOf(origin));
  } catch (err) {
    console.error("Shipping quote failed:", err.message);
    throw new HttpError(502, "We couldn't calculate shipping right now. Please try again shortly.");
  }
}

// POST /api/quote  { cart, country }
export async function quote(req) {
  const body = await readJson(req);
  const priced = priceCart(body.cart);
  const country = String(body.country || "").toUpperCase();
  const shipping = priced.hasPhysical ? await shippingFor(priced, country, originOf(req)) : 0;
  return { itemsTotal: priced.itemsTotal, shipping, total: Math.round((priced.itemsTotal + shipping) * 100) / 100 };
}

// Validates everything, re-prices on the server, re-quotes shipping, and saves a pending order.
export async function createPendingOrder(req) {
  const body = await readJson(req);
  const priced = priceCart(body.cart);
  const customer = validateCustomer(body.customer, priced.hasPhysical);
  const origin = originOf(req);
  const shipping = await shippingFor(priced, customer.address?.countryCode, origin);
  const order = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending",
    lines: priced.lines,
    itemsTotal: priced.itemsTotal,
    shipping,
    total: Math.round((priced.itemsTotal + shipping) * 100) / 100,
    hasPhysical: priced.hasPhysical,
    hasDigital: priced.hasDigital,
    customer,
    assetBase: assetBaseOf(origin)
  };
  await saveOrder(order);
  return { order, origin };
}
