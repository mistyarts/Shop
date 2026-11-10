// THE ONE PLACE to edit prices, sizes, and pieces.
// Both the website and the server functions read this file, so they can never disagree.
//
// PLACEHOLDERS to replace before going live:
//   - every `price` (what the customer pays you, in USD)
//   - every `sku`   (Prodigi product code for that print size: look them up in Prodigi's
//                    product catalogue, then run `npm run check-skus` to verify them)

export default {
  currency: "USD",
  contact: "@mistyarts on TikTok", // where commission requests are sent
  shippingMethod: "Standard",      // Prodigi: Budget | Standard | StandardPlus | Express | Overnight

  // Digital download (no printing). Sent to the buyer by hand after payment.
  digital: { id: "digital", name: "Digital file", price: 8 },

  // Print sizes by shape. `sku` is the Prodigi product code. PLACEHOLDER VALUES.
  sizes: {
    portrait: [
      { id: "5x7",   name: "5 × 7 in",   price: 12, sku: "GLOBAL-FAP-5X7" },
      { id: "8x10",  name: "8 × 10 in",  price: 20, sku: "GLOBAL-FAP-8X10" },
      { id: "11x14", name: "11 × 14 in", price: 30, sku: "GLOBAL-FAP-11X14" },
      { id: "16x20", name: "16 × 20 in", price: 48, sku: "GLOBAL-FAP-16X20" }
    ],
    square: [
      { id: "6x6",   name: "6 × 6 in",   price: 12, sku: "GLOBAL-FAP-6X6" },
      { id: "8x8",   name: "8 × 8 in",   price: 18, sku: "GLOBAL-FAP-8X8" },
      { id: "12x12", name: "12 × 12 in", price: 32, sku: "GLOBAL-FAP-12X12" }
    ],
    landscape: [
      { id: "6x4",   name: "6 × 4 in",   price: 10, sku: "GLOBAL-FAP-6X4" },
      { id: "9x6",   name: "9 × 6 in",   price: 18, sku: "GLOBAL-FAP-9X6" },
      { id: "12x8",  name: "12 × 8 in",  price: 28, sku: "GLOBAL-FAP-12X8" },
      { id: "18x12", name: "18 × 12 in", price: 46, sku: "GLOBAL-FAP-18X12" }
    ]
  },

  // Pieces. `src` is the web image shown on the page. The full-resolution file Prodigi
  // prints from lives in public/print/<id>.jpg (replace the stand-ins with your originals).
  // shape: omit for portrait, or "square" / "landscape".
  pieces: [
    { id: "color-face", src: "art/color-face.jpg", w: 1048, h: 1400, title: "Colorful Eyes", medium: "Digital painting, 2020", alt: "Digital painting of a face covered in bright paint, with fingers framing the eyes" },
    { id: "gerbera", src: "art/gerbera.jpg", w: 1225, h: 1237, shape: "square", title: "Peace", medium: "Digital painting", alt: "Digital painting of a coral gerbera hanging upside down with water dripping from its petals" },
    { id: "gold-coral", src: "art/gold-coral.jpg", w: 1011, h: 1400, title: "Vogue", medium: "Digital painting, 2020", alt: "Close portrait of an eye with a gold coral branch held in front of the face" },
    { id: "macaw", src: "art/macaw.jpg", w: 1052, h: 1400, title: "Macaw", medium: "Digital painting", alt: "Digital painting of a blue and gold macaw in profile" },
    { id: "water", src: "art/water.jpg", w: 954, h: 1228, title: "Ripples", medium: "Traditional painting", alt: "Painting of rippling turquoise and deep blue water with bright glints" },
    { id: "starlit-ripples", src: "art/starlit-ripples.jpg", w: 1600, h: 1500, shape: "square", title: "Moments", medium: "Acrylic on canvas", alt: "Acrylic painting of deep blue water with concentric ripples and white sparkling light patterns" },
    { id: "oranges", src: "art/oranges.jpg", w: 704, h: 924, title: "Oranges", medium: "Acrylic", alt: "Acrylic painting of sliced oranges and strawberries on a plate" },
    { id: "monstera", src: "art/monstera.jpg", w: 771, h: 1055, title: "Leaves", medium: "Acrylic on canvas", alt: "Painting of green monstera leaves with holes against a cream background" },
    { id: "rose-on-fire", src: "art/rose-on-fire.jpg", w: 1248, h: 1600, title: "Romance", medium: "Acrylic and collage", alt: "Painting of a red rose engulfed in pale yellow flame against a starry night sky" },
    { id: "dried-roses", src: "art/dried-roses.jpg", w: 1600, h: 1001, shape: "landscape", title: "Rosè", medium: "Acrylic", alt: "Painting of dried red roses and petals resting on an open book" }
  ],

  // Countries offered at checkout (ISO code, name). Remove any Prodigi doesn't serve you well.
  countries: [
    ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["AU", "Australia"], ["NZ", "New Zealand"],
    ["IE", "Ireland"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"],
    ["BE", "Belgium"], ["AT", "Austria"], ["CH", "Switzerland"], ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"],
    ["FI", "Finland"], ["PL", "Poland"], ["PT", "Portugal"], ["JP", "Japan"], ["SG", "Singapore"], ["MX", "Mexico"]
  ],
  stateRequired: ["US", "CA", "AU"]
};
