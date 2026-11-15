// Runs once an order is PAID: sends physical prints to Prodigi, flags digital files for you to send.
import { createOrder } from "./prodigi.mjs";
import { getOrder, saveOrder } from "./store.mjs";

async function notify(text) {
  // Optional: set NOTIFY_URL to an ntfy.sh topic (or any URL that accepts a plain-text POST).
  if (!process.env.NOTIFY_URL) return;
  try { await fetch(process.env.NOTIFY_URL, { method: "POST", body: text }); } catch { /* never block an order on a notification */ }
}

export async function fulfill(orderId, { paidVia, paymentRef }) {
  const order = await getOrder(orderId);
  if (!order) throw new Error("Order not found: " + orderId);
  if (order.status !== "pending") return order; // already handled (webhook retries, page reloads)

  order.paidVia = paidVia;
  order.paymentRef = paymentRef;
  order.paidAt = new Date().toISOString();

  if (order.hasPhysical) {
    try {
      const res = await createOrder({ orderId: order.id, customer: order.customer, lines: order.lines, assetBase: order.assetBase });
      order.prodigiOrderId = res.order?.id || null;
      order.status = order.hasDigital ? "paid-send-digital" : "fulfilled";
    } catch (err) {
      console.error("PRODIGI ORDER FAILED for", order.id, err.message);
      order.status = "paid-print-failed";
      order.error = err.message;
    }
  } else {
    order.status = "paid-send-digital";
  }

  await saveOrder(order);

  const items = order.lines.map((l) => `${l.qty}x ${l.title} (${l.sizeName})`).join(", ");
  const todo = [];
  if (order.status === "paid-print-failed") todo.push("PRINT ORDER FAILED: check Netlify function logs and place it in the Prodigi dashboard");
  if (order.hasDigital) todo.push("Email the digital file(s) to " + order.customer.email);
  await notify(`New paid order ${order.id}: ${items}. ${order.customer.name} <${order.customer.email}>. Total $${order.total}. ${todo.join(" | ") || "Prints sent to Prodigi."}`);
  return order;
}
