import { verifyWebhook } from "../lib/stripe.mjs";
import { fulfill } from "../lib/fulfill.mjs";
import { getOrder, saveOrder } from "../lib/store.mjs";
import { cents } from "../lib/cart.mjs";

// Stripe calls this after a payment. We verify the signature, then send the order to Prodigi.
export default async (req) => {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET)) {
    console.error("Bad Stripe signature");
    return new Response("Bad signature", { status: 400 });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return new Response("Bad body", { status: 400 }); }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (session.payment_status === "paid" && orderId) {
      const order = await getOrder(orderId);
      if (order && order.status === "pending" && session.amount_total !== cents(order.total)) {
        // Paid amount doesn't match what we expect: don't print, flag it for a human.
        order.status = "paid-amount-mismatch";
        order.error = `Stripe charged ${session.amount_total}, expected ${cents(order.total)}`;
        await saveOrder(order);
        console.error("AMOUNT MISMATCH", orderId, order.error);
      } else if (order) {
        await fulfill(orderId, { paidVia: "stripe", paymentRef: session.payment_intent || session.id });
      }
    }
  }
  return new Response("ok", { status: 200 });
};

export const config = { path: "/api/stripe/webhook", method: "POST" };
