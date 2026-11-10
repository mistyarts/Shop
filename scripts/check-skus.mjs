// Checks every print SKU in catalog.mjs against Prodigi so you find typos BEFORE a customer does.
// Usage:  PRODIGI_API_KEY=your-sandbox-key npm run check-skus
import catalog from "../public/catalog.mjs";
import { getProduct } from "../netlify/lib/prodigi.mjs";

const skus = [...new Set(Object.values(catalog.sizes).flat().map((s) => s.sku))];
let bad = 0;
for (const sku of skus) {
  try {
    const data = await getProduct(sku);
    const p = data.product || data;
    console.log("OK     ", sku, p.description ? "- " + p.description : "");
  } catch (err) {
    bad++;
    console.log("MISSING", sku, "-", err.message.slice(0, 120));
  }
}
console.log(bad ? `\n${bad} SKU(s) need fixing in public/catalog.mjs` : "\nAll SKUs found.");
process.exit(bad ? 1 : 0);
