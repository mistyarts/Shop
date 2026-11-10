// Prices a cart from the catalog. The browser only says WHICH piece/size/qty; every price
// comes from catalog.mjs here, so nobody can change a price by editing the page.
import catalog from "../../public/catalog.mjs";

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const cents = (n) => Math.round(n * 100);
export const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);

export function sizesFor(piece) {
  return catalog.sizes[piece.shape || "portrait"];
}

export function priceCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) throw new HttpError(400, "Your order is empty.");
  if (cart.length > 30) throw new HttpError(400, "Too many items in one order.");
  const lines = cart.map((c) => {
    const piece = catalog.pieces.find((p) => p.id === c?.art);
    if (!piece) throw new HttpError(400, "Unknown piece.");
    const qty = Number(c.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new HttpError(400, "Invalid quantity.");
    if (c.size === catalog.digital.id) {
      return { pieceId: piece.id, title: piece.title, sizeId: catalog.digital.id, sizeName: catalog.digital.name,
        qty, unit: catalog.digital.price, digital: true, sku: null };
    }
    const size = sizesFor(piece).find((s) => s.id === c.size);
    if (!size) throw new HttpError(400, "Unknown size.");
    return { pieceId: piece.id, title: piece.title, sizeId: size.id, sizeName: size.name,
      qty, unit: size.price, digital: false, sku: size.sku };
  });
  const itemsTotal = Math.round(lines.reduce((n, l) => n + l.unit * l.qty, 0) * 100) / 100;
  return { lines, itemsTotal, hasPhysical: lines.some((l) => !l.digital), hasDigital: lines.some((l) => l.digital) };
}

export function validateCustomer(c, needsAddress) {
  const str = (v, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const out = { name: str(c?.name), email: str(c?.email, 200), phone: str(c?.phone, 40) };
  if (!out.name) throw new HttpError(400, "Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new HttpError(400, "Please enter a valid email.");
  if (needsAddress) {
    const a = c?.address || {};
    const addr = { line1: str(a.line1), line2: str(a.line2), townOrCity: str(a.townOrCity),
      stateOrCounty: str(a.stateOrCounty), postalOrZipCode: str(a.postalOrZipCode, 20), countryCode: str(a.countryCode, 2).toUpperCase() };
    if (!catalog.countries.some(([code]) => code === addr.countryCode)) throw new HttpError(400, "We can't ship to that country yet.");
    if (!addr.line1 || !addr.townOrCity || !addr.postalOrZipCode) throw new HttpError(400, "Please complete your shipping address.");
    if (catalog.stateRequired.includes(addr.countryCode) && !addr.stateOrCounty) throw new HttpError(400, "Please enter your state or province.");
    out.address = addr;
  }
  return out;
}
