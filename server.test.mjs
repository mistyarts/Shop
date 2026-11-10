import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// In-memory stand-in for Netlify Blobs
const mem = new Map();
globalThis.__ORDER_STORE__ = {
  get: async (k, o) => (mem.has(k) ? (o?.type === "json" ? JSON.parse(mem.get(k)) : mem.get(k)) : null),
  set: async (k, v) => void mem.set(k, String(v)),
  setJSON: async (k, v) => void mem.set(k, JSON.stringify(v))
};

// Fake Prodigi / Stripe / PayPal on top of fetch
const calls = [];
let prodigiFail = false, quoteShip = "6.50";
globalThis.fetch = async (url, init = {}) => {
  const body = init.body ? (String(init.headers?.["Content-Type"] || "").includes("json") ? JSON.parse(init.body) : init.body) : null;
  calls.push({ url: String(url), method: init.method, body, headers: init.headers });
  const ok = (data, status = 200) => new Response(JSON.stringify(data), { status });
  url = String(url);
  if (url.includes("sandbox.prodigi.com/v4.0/quotes")) return ok({ outcome: "Created", quotes: [{ shipmentMethod: "Standard", costSummary: { items: { amount: "9.00" }, shipping: { amount: quoteShip, currency: "USD" } } }] });
  if (url.includes("sandbox.prodigi.com/v4.0/Orders")) return prodigiFail ? ok({ outcome: "Error" }, 400) : ok({ outcome: "Created", order: { id: "ord_123" } });
  if (url.includes("api.stripe.com/v1/checkout/sessions")) return ok({ id: "cs_test_1", url: "https://checkout.stripe.com/pay/cs_test_1" });
  if (url.includes("/v1/oauth2/token")) return ok({ access_token: "tok" });
  if (url.endsWith("/v2/checkout/orders")) return ok({ id: "PP_ORDER_1", links: [{ rel: "payer-action", href: "https://paypal.test/approve" }] });
  if (url.includes("/capture")) return ok({ status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "COMPLETED", amount: { value: "total" } }] } }] });
  throw new Error("unexpected fetch " + url);
};

process.env.PRODIGI_API_KEY = "k"; process.env.STRIPE_SECRET_KEY = "sk_test"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
process.env.PAYPAL_CLIENT_ID = "id"; process.env.PAYPAL_CLIENT_SECRET = "sec";

const { priceCart, validateCustomer } = await import("../netlify/lib/cart.mjs");
const quoteFn = (await import("../netlify/functions/quote.mjs")).default;
const stripeCo = (await import("../netlify/functions/checkout-stripe.mjs")).default;
const ppCo = (await import("../netlify/functions/checkout-paypal.mjs")).default;
const ppCap = (await import("../netlify/functions/paypal-capture.mjs")).default;
const hook = (await import("../netlify/functions/stripe-webhook.mjs")).default;
const catalog = (await import("../public/catalog.mjs")).default;

const post = (path, body, headers = {}) => new Request("https://shop.test" + path, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });
const customer = { name: "Ann", email: "ann@example.com", address: { line1: "1 Main St", townOrCity: "Austin", stateOrCounty: "TX", postalOrZipCode: "78701", countryCode: "US" } };
const printCart = [{ art: "macaw", size: "8x10", qty: 2 }, { art: "gerbera", size: "8x8", qty: 1 }];
const webhookReq = (orderId, sessionId, amount) => {
  const raw = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: sessionId, payment_status: "paid", payment_intent: "pi_1", amount_total: amount, metadata: { orderId } } } });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", "whsec_x").update(`${t}.${raw}`).digest("hex");
  return post("/api/stripe/webhook", raw, { "stripe-signature": `t=${t},v1=${sig}` });
};
beforeEach(() => { mem.clear(); calls.length = 0; prodigiFail = false; });

test("prices come from the catalog, bad input is rejected", () => {
  const p = priceCart(printCart);
  assert.equal(p.itemsTotal, 2 * 20 + 18);
  assert.ok(p.hasPhysical && !p.hasDigital);
  assert.throws(() => priceCart([{ art: "macaw", size: "99x99", qty: 1 }]), /size/i);
  assert.throws(() => priceCart([{ art: "nope", size: "8x10", qty: 1 }]), /piece/i);
  assert.throws(() => priceCart([{ art: "macaw", size: "8x10", qty: 0 }]), /quantity/i);
  assert.throws(() => priceCart([{ art: "gerbera", size: "8x10", qty: 1 }]), /size/i, "portrait size on a square piece");
  assert.throws(() => priceCart([]), /empty/i);
});
test("digital-only needs no address; physical does", () => {
  assert.equal(validateCustomer({ name: "A", email: "a@b.co" }, false).address, undefined);
  assert.throws(() => validateCustomer({ name: "A", email: "a@b.co" }, true), /country|ship/i);
  assert.throws(() => validateCustomer({ name: "A", email: "bad" }, false), /email/i);
  assert.throws(() => validateCustomer({ ...customer, address: { ...customer.address, stateOrCounty: "" } }, true), /state/i);
});
test("every catalog size has a sku and a positive price", () => {
  for (const [shape, list] of Object.entries(catalog.sizes)) for (const s of list) { assert.ok(s.sku, shape + s.id); assert.ok(s.price > 0); }
  for (const p of catalog.pieces) assert.ok(!p.shape || catalog.sizes[p.shape], p.id);
});
test("quote returns shipping from Prodigi; digital-only is free", async () => {
  let r = await quoteFn(post("/api/quote", { cart: printCart, country: "US" }));
  const d = await r.json(); assert.equal(d.shipping, 6.5); assert.equal(d.total, 58 + 6.5);
  const q = calls.find((c) => c.url.endsWith("/quotes")).body;
  assert.equal(q.destinationCountryCode, "US"); assert.equal(q.items[0].sku, "GLOBAL-FAP-8X10"); assert.equal(q.items[0].copies, 2);
  r = await quoteFn(post("/api/quote", { cart: [{ art: "macaw", size: "digital", qty: 1 }], country: "" }));
  assert.equal((await r.json()).shipping, 0);
});
test("Stripe: checkout -> signed webhook -> exactly one Prodigi order", async () => {
  const r = await stripeCo(post("/api/checkout/stripe", { cart: printCart, customer }));
  assert.equal((await r.json()).url, "https://checkout.stripe.com/pay/cs_test_1");
  const form = new URLSearchParams(calls.find((c) => c.url.includes("stripe.com")).body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "2000");
  assert.equal(form.get("line_items[0][quantity]"), "2");
  assert.equal(form.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), "650");
  const orderId = form.get("metadata[orderId]");
  const amount = 6450 + 0; // 58.00 + 6.50 = 64.50
  assert.equal((await hook(webhookReq(orderId, "cs_test_1", amount))).status, 200);
  assert.equal((await hook(webhookReq(orderId, "cs_test_1", amount))).status, 200); // retry
  const made = calls.filter((c) => c.url.endsWith("/Orders"));
  assert.equal(made.length, 1, "no double printing");
  const o = made[0].body;
  assert.equal(o.merchantReference, orderId); assert.equal(o.idempotencyKey, orderId);
  assert.equal(o.recipient.address.countryCode, "US"); assert.equal(o.items.length, 2);
  assert.equal(o.items[0].assets[0].url, `https://shop.test/print/macaw.jpg`);
  assert.equal(JSON.parse(mem.get(`order:${orderId}`)).status, "fulfilled");
});
test("webhook rejects bad signature, wrong amount does not print", async () => {
  const r = await stripeCo(post("/api/checkout/stripe", { cart: printCart, customer }));
  const orderId = new URLSearchParams(calls.find((c) => c.url.includes("stripe.com")).body).get("metadata[orderId]");
  assert.equal((await hook(post("/api/stripe/webhook", "{}", { "stripe-signature": "t=1,v1=00" }))).status, 400);
  await hook(webhookReq(orderId, "cs_test_1", 100));
  assert.equal(calls.filter((c) => c.url.endsWith("/Orders")).length, 0);
  assert.equal(JSON.parse(mem.get(`order:${orderId}`)).status, "paid-amount-mismatch");
});
test("Prodigi failure after payment is recorded, not lost", async () => {
  await stripeCo(post("/api/checkout/stripe", { cart: printCart, customer }));
  const orderId = new URLSearchParams(calls.find((c) => c.url.includes("stripe.com")).body).get("metadata[orderId]");
  prodigiFail = true; await hook(webhookReq(orderId, "cs_test_1", 6450));
  const o = JSON.parse(mem.get(`order:${orderId}`)); assert.equal(o.status, "paid-print-failed"); assert.match(o.error, /Prodigi/);
});
test("digital-only order is paid without touching Prodigi and flagged for you", async () => {
  await stripeCo(post("/api/checkout/stripe", { cart: [{ art: "macaw", size: "digital", qty: 1 }], customer: { name: "A", email: "a@b.co" } }));
  const form = new URLSearchParams(calls.find((c) => c.url.includes("stripe.com")).body);
  assert.equal(form.get("shipping_options[0][shipping_rate_data][type]"), null);
  const orderId = form.get("metadata[orderId]"); await hook(webhookReq(orderId, "cs_test_1", 800));
  assert.equal(calls.filter((c) => c.url.includes("prodigi")).length, 0);
  assert.equal(JSON.parse(mem.get(`order:${orderId}`)).status, "paid-send-digital");
});
test("PayPal: create -> capture -> Prodigi order, amounts add up", async () => {
  const r = await ppCo(post("/api/checkout/paypal", { cart: printCart, customer }));
  assert.equal((await r.json()).url, "https://paypal.test/approve");
  const body = calls.find((c) => c.url.endsWith("/v2/checkout/orders")).body.purchase_units[0];
  assert.equal(body.amount.value, "64.50"); assert.equal(body.amount.breakdown.item_total.value, "58.00"); assert.equal(body.amount.breakdown.shipping.value, "6.50");
  // make the fake capture report the right amount
  const real = globalThis.fetch; globalThis.fetch = async (u, i) => String(u).includes("/capture")
    ? new Response(JSON.stringify({ status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "COMPLETED", amount: { value: "64.50" } }] } }] })) : real(u, i);
  const c = await ppCap(post("/api/paypal/capture", { token: "PP_ORDER_1" }));
  assert.equal(c.status, 200); assert.equal(calls.filter((x) => x.url.endsWith("/Orders")).length, 1);
  assert.equal((await ppCap(post("/api/paypal/capture", { token: "PP_ORDER_1" }))).status, 200); // reload
  assert.equal(calls.filter((x) => x.url.endsWith("/Orders")).length, 1);
  assert.equal((await ppCap(post("/api/paypal/capture", { token: "unknown" }))).status, 404);
  globalThis.fetch = real;
});
