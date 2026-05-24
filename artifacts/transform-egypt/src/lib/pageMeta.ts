export interface PageMeta {
  title: string;
  description: string;
}

export const SITE_URL = "https://transform-egypt.com";

export const pageMeta: Record<string, PageMeta> = {
  "/": {
    title: "TransforM Egypt — #1 Hair Extensions & Luxury Beauty in Cairo",
    description:
      "Egypt's #1 premium luxury beauty salon. Hair extensions, lash extensions, microblading, facials & professional makeup in Cairo. Celebrity-level results for every client.",
  },
  "/boutique": {
    title: "Luxury Boutique — Shop Premium Hair Extensions | TransforM Egypt",
    description:
      "Shop premium Indian, Russian, Brazilian & Turkish hair extensions, plus professional beauty products. Curated by Egypt's #1 luxury beauty salon.",
  },
  "/book": {
    title: "Book Your VIP Appointment | TransforM Egypt",
    description:
      "Reserve your VIP beauty experience at TransforM Egypt. Hair extensions, lashes, microblading, bridal & more. First consultation is free.",
  },
  "/transformations": {
    title: "Real Transformations & Before/After Gallery | TransforM Egypt",
    description:
      "Drag-to-compare before & after gallery of real TransforM Egypt clients. Hair extensions, lash sets, microblading and full bridal transformations.",
  },
  "/reviews": {
    title: "Client Reviews & Testimonials | TransforM Egypt",
    description:
      "Read 500+ five-star reviews from TransforM Egypt clients. Real testimonials from women across Cairo, Dubai and the Middle East.",
  },
  "/services": {
    title: "Signature Beauty Services — Hair, Lash, Brows & More | TransforM",
    description:
      "Premium hair extensions, lash extensions, microblading, lip blushing, bridal packages, facials and nails — all under the TransforM standard.",
  },
  "/cart": {
    title: "Shopping Cart | TransforM Egypt",
    description: "Review your TransforM Egypt boutique selection and complete your premium beauty order.",
  },
  "/locations": {
    title: "Our 6 Locations in Cairo & North Coast | TransforM Egypt",
    description:
      "Visit TransforM Egypt at City Stars, Sofitel Downtown, or O Mall New Alamein. Hours, addresses, WhatsApp. (Cairo Festival City, Nile Ritz-Carlton & Walk of Cairo branches are temporarily closed for renovation.)",
  },
  "/team": {
    title: "Meet Our Master Artists | TransforM Egypt Stylists",
    description:
      "Meet Mervat Atalla — Founder & CEO, beauty expert and image consultant featured on Heya w Bas with Radwa El Sherbiny — and the senior stylists who deliver every TransforM transformation. Available for VIP private consultations.",
  },
  "/gift-cards": {
    title: "Gift Cards — Give the TransforM Experience | TransforM Egypt",
    description:
      "Luxury TransforM Egypt gift cards for weddings, birthdays and bridal showers. Tiers from EGP 2,500. Same-day digital delivery.",
  },
  "/lucky": {
    title: "Your perfect look in 30 seconds — Spin the wheel | TransforM Egypt",
    description:
      "Spin. Unlock. Transform. Take the 30-second TransforM beauty experience and instantly unlock an exclusive offer. Only 5 grand-prize winners daily — every spin wins something.",
  },
  "/try-on": {
    title: "AI Try-On — See Your Transformation | TransforM Egypt",
    description: "Upload your photo and see an AI-generated preview of your hair transformation. Hair extensions, color, volume, and more — visualized before you book.",
  },
  "/blog": {
    title: "TransforM Journal — Expert Beauty Guides | TransforM Egypt",
    description: "Expert beauty guides from TransforM Egypt's master stylists. Hair extensions, lash extensions, microblading, bridal packages and skincare advice.",
  },
  "/blog/best-hair-extensions-cairo-2025": {
    title: "Best Hair Extensions in Cairo 2025 — Complete Buyer's Guide | TransforM",
    description: "Tape-in, keratin bond, or clip-in? We break down every extension type available in Egypt, what they cost, how long they last, and which one is right for your hair goals.",
  },
  "/blog/microblading-vs-powder-brows": {
    title: "Microblading vs Powder Brows — Which Is Right for You? | TransforM",
    description: "Confused between hair-stroke brows and the soft powder look? We compare technique, healing time, longevity, and cost so you can choose with confidence.",
  },
  "/blog/bridal-makeup-packages-egypt-2025": {
    title: "Bridal Makeup Packages in Egypt 2025 — Complete Guide | TransforM",
    description: "From trial sessions to the big day: what every Egyptian bride needs to know about booking hair, makeup, lashes, and skincare for her wedding.",
  },
  "/blog/how-long-do-hair-extensions-last": {
    title: "How Long Do Hair Extensions Last? Complete Care Guide | TransforM",
    description: "Tape-in, keratin bond, or clip-in — each type has a different lifespan. Here is exactly how long your extensions will last and how to make them last longer.",
  },
  "/blog/lash-extensions-vs-lash-lifts": {
    title: "Lash Extensions vs Lash Lifts: What's the Difference? | TransforM",
    description: "Extensions give drama. Lifts give curl. We break down the difference in time, cost, maintenance, and results so you can pick the right lash service.",
  },
  "/blog/first-hair-extension-appointment": {
    title: "5 Things to Know Before Your First Hair Extension Appointment | TransforM",
    description: "Nervous about your first extension fitting? Here is exactly what happens during the consultation, the fitting, and the first 48 hours.",
  },
  "/book/confirmed": {
    title: "Booking Confirmed — TransforM Egypt",
    description: "Your booking request has been received. The TransforM team will contact you shortly to confirm your appointment.",
  },
  "/admin": {
    title: "Lucky Leads — Admin | TransforM Egypt",
    description: "Internal lead management dashboard for the Lucky giveaway campaign.",
  },
  "/privacy": {
    title: "Privacy Policy | TransforM Egypt",
    description: "How TransforM Egypt collects, uses and protects your personal data. Read our full privacy policy.",
  },
  "/terms": {
    title: "Terms of Service | TransforM Egypt",
    description: "Terms and conditions for using TransforM Egypt services, booking appointments, and purchasing products.",
  },
};

// Routes that get a per-route prerendered HTML file at build time.
// Excludes admin (private), cart (per-user, dynamic), and confirmation pages
// (no value for Google to index a thank-you page).
export const PRERENDER_ROUTES = Object.keys(pageMeta).filter(
  (r) => r !== "/admin" && r !== "/cart" && r !== "/book/confirmed",
);
