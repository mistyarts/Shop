import { json, readJson, errorResponse } from "../lib/checkout.mjs";
import { capturePayPalOrder } from "../lib/paypal.mjs";
import { fulfill } from "../lib/fulfill.mjs";
import { getOrder, saveOrder, orders } from "../lib/store.mjs";
import { HttpError } from "../lib/cart.mjs";

// The customer comes back from PayPal to the site; the page posts the PayPal order id here.
export default async (req) => {
  try {
    const { token } = await readJson(req);
    const orderId = token ? await orders().get(`pp:${token}`) : null;
    if (!orderId) throw new HttpError(404, "We couldn't find that order.");

    const order = await getOrder(orderId);
    if (!order) throw new HttpError(404, "We couldn't find that order.");
    if (order.status !== "pending") return json(200, { ok: true }); // page reloaded after success

    const cap = await capturePayPalOrder(token);
    if (!cap.completed) throw new HttpError(402, "PayPal didn't complete the payment. You haven't been charged.");
    if (cap.amount !== null && Math.round(cap.amount * 100) !== Math.round(order.total * 100)) {
      order.status = "paid-amount-mismatch";
      order.error = `PayPal captured ${cap.amount}, expected ${order.total}`;
      await saveOrder(order);
      console.error("AMOUNT MISMATCH", orderId, order.error);
      return json(200, { ok: true });
    }
    await fulfill(orderId, { paidVia: "paypal", paymentRef: token });
    return json(200, { ok: true });
  } catch (err) { return errorResponse(err); }
};

export const config = { path: "/api/paypal/capture", method: "POST" };
