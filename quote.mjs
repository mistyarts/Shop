import { quote, json, errorResponse } from "../lib/checkout.mjs";

export default async (req) => {
  try { return json(200, await quote(req)); } catch (err) { return errorResponse(err); }
};

export const config = { path: "/api/quote", method: "POST" };
