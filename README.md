# Mistyarts shop: setup guide

A print shop that takes payment by **card (Stripe)** or **PayPal** and sends each print order straight to **Prodigi**, who print it and ship it to your customer.

```
public/            the website (index.html), catalog.mjs (prices, sizes, pieces), art/ and print/ images
netlify/functions  the checkout code that runs on Netlify
netlify/lib        shared code (Prodigi calls are all in prodigi.mjs)
scripts/           check-skus.mjs, a helper to verify your Prodigi product codes
test/              automated tests (npm test)
```

## 1. Fill in the placeholders (public/catalog.mjs)

1. **Prices**: every `price` is a placeholder. Set what customers pay you.
2. **Prodigi product codes (`sku`)**: these are best guesses. Find the real codes for the print type you want in Prodigi's product catalogue, paste them in, then run `PRODIGI_API_KEY=your-sandbox-key npm run check-skus`. It tells you which codes Prodigi doesn't recognise.
3. **Print files**: `public/print/` holds stand-ins copied from the web images. Replace each with your **full-resolution original**, same filename (`macaw.jpg`, etc.). Prodigi downloads these to print from.

Check your prices cover Prodigi's cost plus shipping. Shipping is charged to the customer at Prodigi's quoted price. Your profit is item price minus Prodigi's item cost.

## 2. Create the accounts (test mode first)

| Service | What to get |
|---|---|
| Prodigi | Account, then the **sandbox** API key (Settings, API) |
| Stripe | Account, then **test mode** secret key (`sk_test_...`) |
| PayPal | developer.paypal.com, then create an app in **Sandbox**; copy Client ID and Secret |

## 3. Deploy to Netlify

Netlify's drag-and-drop upload does not install the one library the checkout needs, so connect a repository instead:

1. Put this folder in a GitHub repository (the `node_modules` folder is not included, and shouldn't be).
2. In Netlify: Add new site, Import an existing project, pick the repo. Settings are read from `netlify.toml`.
3. Site configuration, Environment variables. Add:

| Name | Value |
|---|---|
| `PRODIGI_API_KEY` | your Prodigi key |
| `PRODIGI_ENV` | `sandbox` (change to `live` at launch) |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | from step 4 |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | from your PayPal app |
| `PAYPAL_ENV` | `sandbox` (change to `live` at launch) |
| `NOTIFY_URL` | optional: an ntfy.sh topic URL, to get a phone alert for each paid order |
| `PRINT_ASSET_BASE` | optional: see "Good to know" |

4. Point your domain at the site (Domain management).

## 4. Stripe webhook

Stripe, Developers, Webhooks, Add endpoint:
- URL: `https://YOUR-DOMAIN/api/stripe/webhook`
- Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
- Copy the **signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`, then redeploy.

PayPal needs no webhook: the customer returns to the site and the page finishes the payment.

## 5. Test everything before real money

- Add a print, enter an address, pay with Stripe test card `4242 4242 4242 4242` (any future date, any CVC).
- Repeat with a PayPal **sandbox buyer** account.
- Check the order appears in your Prodigi **sandbox** dashboard.
- Test a digital-only order, and a wrong or unsupported country.

## 6. Go live

Swap to live keys (`sk_live_...`, live PayPal app, live Prodigi key), set `PRODIGI_ENV=live` and `PAYPAL_ENV=live`, create the Stripe webhook again in live mode with its new secret, and place one real order to yourself.

## What happens to each order

- **Prints**: paid, sent to Prodigi automatically, status `fulfilled`.
- **Digital files**: paid, status `paid-send-digital`. **You email the file** to the buyer (the alert, if enabled, says so).
- **Prodigi rejected the order** after payment: status `paid-print-failed`. Check the Netlify function logs, then place it by hand in the Prodigi dashboard or refund.
- **Amount mismatch**: something was charged that doesn't match the order; nothing is printed. Check it by hand.

Orders are stored in Netlify Blobs (Netlify dashboard, Blobs, `orders`). Stripe and PayPal also email you each payment.

## Good to know

- **Prodigi calls are written from Prodigi's public API as I know it and were tested only against a simulated Prodigi.** Compare `netlify/lib/prodigi.mjs` with the OpenAPI spec you downloaded (endpoints `/quotes` and `/Orders`, and the field names). If anything differs, that file is the only place to change. Sandbox testing (step 5) will show any mismatch.
- **Print files are public.** Prodigi needs a link to download each full-resolution file, and by default that is `https://YOUR-DOMAIN/print/<piece>.jpg`, so anyone who guesses the address can download your originals. To limit this, host them somewhere unlisted and set `PRINT_ASSET_BASE` to that folder's web address, or rename the `print` folder to something hard to guess and update the default in `netlify/lib/checkout.mjs`.
- **Sales tax / VAT is not handled.** Check what applies to you and your customers' countries.
- **Commissions are not paid on the site.** They still use the copy-and-send request.
- Run `npm test` after editing `catalog.mjs` or the functions.
