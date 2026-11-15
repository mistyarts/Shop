import { createPendingOrder, json, errorResponse } from "../lib/checkout.mjs";
import { createPayPalOrder } from "../lib/paypal.mjs";
import { orders } from "../lib/store.mjs";

export default async (req) => {
  try {
    const { order, origin } = await createPendingOrder(req);
    const { paypalOrderId, approveUrl } = await createPayPalOrder(order, origin);
    await orders().set(`pp:${paypalOrderId}`, order.id);
    return json(200, { url: approveUrl });
  } catch (err) { return errorResponse(err); }
};

export const config = { path: "/api/checkout/paypal", method: "POST" };
