import { createPendingOrder, json, errorResponse } from "../lib/checkout.mjs";
import { createCheckoutSession } from "../lib/stripe.mjs";
import { orders } from "../lib/store.mjs";

export default async (req) => {
  try {
    const { order, origin } = await createPendingOrder(req);
    const session = await createCheckoutSession(order, origin);
    await orders().set(`stripe:${session.id}`, order.id);
    return json(200, { url: session.url });
  } catch (err) { return errorResponse(err); }
};

export const config = { path: "/api/checkout/stripe", method: "POST" };
