// Order records live in Netlify Blobs (built into Netlify, no database to set up).
// Tests replace the store by setting globalThis.__ORDER_STORE__.
import { getStore } from "@netlify/blobs";

export function orders() {
  return globalThis.__ORDER_STORE__ || getStore("orders");
}

export const getOrder = (id) => orders().get(`order:${id}`, { type: "json" });
export const saveOrder = (o) => orders().setJSON(`order:${o.id}`, o);
