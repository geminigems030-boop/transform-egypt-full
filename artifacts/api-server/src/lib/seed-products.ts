/**
 * Idempotent product seed.
 *
 * Runs once on api-server boot. If the `products` table is empty (typical
 * for a freshly-deployed production database where Replit's publish flow
 * migrates SCHEMA but not DATA), this inserts the canonical TransforM Egypt
 * catalog so the boutique isn't blank in production.
 *
 * On subsequent boots — and on the development database which already has
 * data — the COUNT(*) check short-circuits and nothing is written.
 *
 * To refresh / re-import the catalog manually, TRUNCATE products and restart.
 */
import { db, productsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// Postgres advisory lock id used to serialize concurrent boot-time seeders.
// If two api-server replicas (or a rolling restart) try to seed at the same
// time, the loser blocks until the winner's transaction commits, then sees a
// non-empty count and skips. Distinct from LUCKY_ADVISORY_LOCK_ID (81234567)
// in routes/lucky.ts so the two locks never contend with each other.
const SEED_ADVISORY_LOCK_ID = 81234568;

type SeedProduct = {
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  price: string;
  originalPrice: string | null;
  category: string;
  images: string[];
  badge: string | null;
  inStock: boolean;
  rating: string;
  reviewCount: number;
  features: string[];
};

const PRODUCTS: SeedProduct[] = [
  {
    name: "Tape-In Hair Extensions - Natural Blonde",
    nameAr: "إضافات الشعر اللاصقة - أشقر طبيعي",
    description:
      "Premium 100% human hair tape-in extensions. Seamless, lightweight, and virtually undetectable. 20 pieces per pack.",
    descriptionAr:
      "إضافات شعر لاصقة من الشعر الطبيعي بنسبة 100%. سلسة وخفيفة وغير ملحوظة تقريبًا. 20 قطعة في العبوة.",
    price: "4500.00",
    originalPrice: "5500.00",
    category: "hair-extensions",
    images: ["/products/tape-in-natural-blonde.jpg"],
    badge: "BESTSELLER",
    inStock: true,
    rating: "4.90",
    reviewCount: 128,
    features: [
      "100% Human Hair",
      "Ethically Sourced",
      "6-12 Month Lifespan",
      "Heat Stylable",
      "Color Treated",
    ],
  },
  {
    name: "Keratin Bond Extensions - Dark Brown",
    nameAr: "إضافات الكيراتين - بني داكن",
    description:
      "Long-lasting keratin bond extensions for maximum hold and natural movement. Includes 50 strands.",
    descriptionAr:
      "إضافات كيراتين طويلة الأمد لقوة تثبيت قصوى وحركة طبيعية. تشمل 50 خصلة.",
    price: "6500.00",
    originalPrice: null,
    category: "hair-extensions",
    images: ["/products/keratin-bond-dark-brown.jpg"],
    badge: null,
    inStock: true,
    rating: "4.80",
    reviewCount: 89,
    features: [
      "100% Human Hair",
      "50 Strands",
      "Heat Stylable",
      "8-12 Month Lifespan",
    ],
  },
  {
    name: "Clip-In Extensions Set - Ombre",
    nameAr: "طقم إضافات كليب - أومبري",
    description:
      "Instant volume and length with 8-piece clip-in set. Perfect for special occasions. No commitment required.",
    descriptionAr:
      "حجم وطول فوري مع طقم 8 قطع قابلة للتثبيت. مثالية للمناسبات الخاصة. لا يلزم الالتزام.",
    price: "2800.00",
    originalPrice: "3200.00",
    category: "hair-extensions",
    images: ["/products/clip-in-ombre.jpg"],
    badge: "SALE",
    inStock: true,
    rating: "4.70",
    reviewCount: 203,
    features: ["8-Piece Set", "Reusable", "No Damage", "Instant Application"],
  },
  {
    name: "Full Lace Wig - Natural Wave",
    nameAr: "باروكة الدانتيل الكاملة - موجة طبيعية",
    description:
      "Luxury full lace wig with pre-plucked hairline for the most natural look. 24-inch length.",
    descriptionAr:
      "باروكة دانتيل فاخرة كاملة مع خط شعر منقوش مسبقًا للمظهر الأكثر طبيعية. طول 24 بوصة.",
    price: "12000.00",
    originalPrice: null,
    category: "wigs",
    images: ["/products/full-lace-wig-wave.png"],
    badge: "NEW",
    inStock: true,
    rating: "5.00",
    reviewCount: 34,
    features: [
      "Full Lace",
      "Pre-plucked",
      "Baby Hair",
      "Swiss Lace",
      "Customizable",
    ],
  },
  {
    name: "TransforM Hair Care Kit",
    nameAr: "طقم العناية بالشعر ترانسفورم",
    description:
      "Complete maintenance kit for hair extensions. Sulfate-free shampoo, conditioning treatment, and detangling brush.",
    descriptionAr:
      "طقم صيانة كامل لإضافات الشعر. شامبو خالٍ من الكبريتات وعلاج مكيف وفرشاة لإزالة التشابك.",
    price: "950.00",
    originalPrice: "1200.00",
    category: "hair-care",
    images: ["/products/hair-care-kit.png"],
    badge: "BESTSELLER",
    inStock: true,
    rating: "4.90",
    reviewCount: 567,
    features: [
      "Sulfate-Free",
      "Paraben-Free",
      "Extension Safe",
      "3-Piece Kit",
    ],
  },
  {
    name: "Micro-Ring Extensions - Black",
    nameAr: "إضافات الحلقات الدقيقة - أسود",
    description:
      "No heat, no glue micro-ring extensions for the most damage-free application. 100 strands included.",
    descriptionAr:
      "إضافات حلقات دقيقة بدون حرارة وبدون غراء للتطبيق الأكثر أمانًا. تشمل 100 خصلة.",
    price: "5500.00",
    originalPrice: null,
    category: "hair-extensions",
    images: ["/products/micro-ring-black.png"],
    badge: null,
    inStock: true,
    rating: "4.80",
    reviewCount: 72,
    features: [
      "No Heat Required",
      "No Glue",
      "100 Strands",
      "Reusable Rings",
    ],
  },
  {
    name: "THS Magic Brush — Loop Bristles",
    nameAr: "فرشاة THS ماجيك — لووب بريسلز",
    description:
      "Keep extension bonds tangle-free with The THS Loop Brush. Carefully designed with loop bristles to prevent the snagging that ordinary brushes cause. A must-have for all extension types — especially strand-by-strand techniques. Free shipping included.",
    descriptionAr:
      "فرشاة THS Loop بتحمي البوندز من التشابك. تصميم اللووب بريسلز بيمنع الشد والكسر اللي بتسببه الفرش العادية. لازمة لكل أنواع الاكستنشن — خصوصاً الاسترند باي استرند. شحن مجاني.",
    price: "1500.00",
    originalPrice: "3000.00",
    category: "Accessories",
    images: ["/products/ths-brush-1.webp", "/products/ths-brush-2.webp"],
    badge: "OFFER 50%",
    inStock: true,
    rating: "5.00",
    reviewCount: 64,
    features: [
      "Loop bristles — no snag, no breakage",
      "Safe on all extension types",
      "Ergonomic non-slip matte grip",
      "Hanging hole for easy storage",
      "Free shipping included",
      "50% OFF — was EGP 3,000",
    ],
  },
  {
    name: 'Gushli 100% Human Hair Weft Extensions — 22"',
    nameAr: "وصلات شعر Gushli ويفت 100% شعر طبيعي — 22 إنش",
    description:
      "100% Premium Human Hair, double-drawn for full density from top to ends. 22 inches, 120g net. Continuous weft design — can be cut and customized without shedding. Suitable for sewing, micro-rings, or custom clip-ins. Soft, flexible lace weft. Long-lasting 3–9 months. Available in 3 shades: MoonStone (cool ashy brown), Champagne (dark roots + beige blonde), DaisyBlend (brown + blonde sun-kissed).",
    descriptionAr:
      "شعر طبيعي 100% Double Drawn بكثافة كاملة من الجذور للأطراف. الطول 22 إنش، الوزن 120 جرام صافي. تصميم ويفت متصل قابل للقص والتخصيص بدون تساقط. مناسب للخياطة، المايكرو رينجز، أو كليب إن. شريط ناعم ومرن. عمر استخدام 3–9 شهور. متوفر بـ 3 درجات: MoonStone، Champagne، DaisyBlend.",
    price: "15000.00",
    originalPrice: "25000.00",
    category: "Tape-In",
    images: [
      "/products/gushli-weft-daisyblend-package.png",
      "/products/gushli-weft-model.png",
    ],
    badge: "OFFER 40%",
    inStock: true,
    rating: "5.00",
    reviewCount: 47,
    features: [
      "100% Premium Human Hair",
      "Double-drawn — full density root to tip",
      "22 inches · 120g net",
      "Continuous weft — cut & customize, no shedding",
      "3 shades: MoonStone · Champagne · DaisyBlend",
      "3–9 months with proper care",
    ],
  },
  {
    name: "Platin Anti-Static Detangling Brush",
    nameAr: "فرشاة بلاتين مضادة للكهرباء الساكنة لفك التشابك",
    description:
      "Pain-free anti-knot massage detangler for women, men, and kids. Suitable for all hair types — long, thick, curly, or straight. Reduces frizz and flyaways, scalp-massage comfort, gentle on extensions.",
    descriptionAr:
      "فرشاة بلاتين مضادة للكهرباء الساكنة، مشط فك تشابك مريح وخالي من الألم للنساء والرجال والأطفال. مناسبة لكل أنواع الشعر — الطويل والكثيف والمجعد والناعم. بتقلل الفريز والشعر المتطاير، مريحة لفروة الرأس وآمنة على الاكستنشن.",
    price: "1000.00",
    originalPrice: "2500.00",
    category: "Accessories",
    images: ["/products/platin-detangling-brush-gold.png"],
    badge: "OFFER 60%",
    inStock: true,
    rating: "5.00",
    reviewCount: 88,
    features: [
      "Anti-static — reduces frizz & flyaways",
      "Pain-free detangling",
      "Suitable for all hair types",
      "Scalp-massage comfort",
      "Safe on extensions",
      "Free shipping included",
    ],
  },
  {
    name: "Gushli Heat X-treme Styling Brush",
    nameAr: "فرشاة Gushli هيت إكستريم للتصفيف",
    description:
      "Natural bristles help with styling, balance hair oil, and reduce frizz for a smoother, healthier appearance. Removes residue from the hair. Foldable design for travel. Waterproof paint surface and non-slip handle for a comfortable grip.",
    descriptionAr:
      "فرشاة Gushli هيت إكستريم بشعيرات طبيعية بتساعد على التصفيف، توازن زيت الشعر، وتقلل الفريز لمظهر ناعم وصحي. بتشيل البقايا من الشعر. تصميم قابل للطي للسفر. سطح مقاوم للماء ومقبض مانع للانزلاق.",
    price: "1500.00",
    originalPrice: "3000.00",
    category: "Accessories",
    images: [
      "/products/gushli-xtreme-brush-model.png",
      "/products/gushli-xtreme-brush-closeup.jpeg",
      "/products/gushli-xtreme-brush-detail.jpeg",
    ],
    badge: "OFFER 50%",
    inStock: true,
    rating: "5.00",
    reviewCount: 52,
    features: [
      "Natural bristles — reduces frizz, adds shine",
      "Balances oil & removes residue",
      "Foldable — travel-friendly",
      "Waterproof paint surface",
      "Non-slip ergonomic handle",
      "Free shipping included",
    ],
  },
  {
    name: "TransforM X Platin — Hair Mist (Jasmine)",
    nameAr: "ترانسفورم × بلاتين — ميست الشعر ياسمين",
    description:
      "Platin Jasmine Paris Hair Parfume — a luxurious hair mist with a delicate jasmine fragrance. Long-lasting scent for all hair types. 50ml.",
    descriptionAr:
      "ميست الشعر ياسمين باريس من بلاتين — عطر شعر فاخر برائحة الياسمين الرقيقة. رائحة تدوم طويلاً لكل أنواع الشعر. 50 مل.",
    price: "850.00",
    originalPrice: null,
    category: "Accessories",
    images: ["/products/platin-jasmine-hair-mist.png"],
    badge: "NEW",
    inStock: true,
    rating: "5.00",
    reviewCount: 23,
    features: [
      "Platin Jasmine Paris",
      "Long-lasting fragrance",
      "For all hair types",
      "50ml",
      "Luxury hair parfume",
    ],
  },
  {
    name: "TransforM X The Hair Shop — Repair Shampoo",
    nameAr: "ترانسفورم × ذا هير شوب — شامبو إصلاح الشعر",
    description:
      "Gentle Cleansing Wash by The Hair Shop — specially formulated for hair extensions. Sulfate-free, paraben-free. Nourishes and repairs with every wash. 12 FL OZ / 355ml.",
    descriptionAr:
      "غسول تنظيف لطيف من ذا هير شوب — مُصمَّم خصيصاً للاكستنشن. خالٍ من السلفات والبارابين. يغذي ويصلح مع كل غسلة. 355 مل.",
    price: "950.00",
    originalPrice: null,
    category: "Haircare",
    images: [
      "/products/ths-repair-shampoo-model.png",
      "/products/ths-repair-shampoo-mask-duo.png",
    ],
    badge: "NEW",
    inStock: true,
    rating: "5.00",
    reviewCount: 41,
    features: [
      "Sulfate-Free",
      "Paraben-Free",
      "Formulated for hair extensions",
      "Gentle Cleansing Formula",
      "12 FL OZ / 355ml",
    ],
  },
  {
    name: "TransforM X The Hair Shop — Repair Mask",
    nameAr: "ترانسفورم × ذا هير شوب — ماسك إصلاح الشعر",
    description:
      "Deep Conditioning Mask by The Hair Shop — intense nourishing repair for hair extensions. Restores moisture, softness and shine. 8 FL OZ / 236ml.",
    descriptionAr:
      "ماسك تكييف عميق من ذا هير شوب — إصلاح مكثف ومغذٍّ للاكستنشن. يعيد الترطيب والنعومة واللمعان. 236 مل.",
    price: "1100.00",
    originalPrice: null,
    category: "Haircare",
    images: [
      "/products/ths-repair-mask.png",
      "/products/ths-repair-shampoo-mask-duo.png",
    ],
    badge: "NEW",
    inStock: true,
    rating: "5.00",
    reviewCount: 38,
    features: [
      "Deep Conditioning",
      "Intense Nourishing Repair",
      "Formulated for hair extensions",
      "Restores moisture & shine",
      "8 FL OZ / 236ml",
    ],
  },
  {
    name: "TransforM X Schwarzkopf — Color Booster",
    nameAr: "ترانسفورم × شوارتزكوف — بوستر اللون",
    description:
      "Schwarzkopf Professional Fibre Clinix AHA Vibrancy Booster — a salon-grade color booster that enhances vibrancy and protects color-treated hair. 45ml net.",
    descriptionAr:
      "بوستر لمعان اللون المهني من شوارتزكوف فايبر كلينيكس — يعزز تألق اللون ويحمي الشعر المصبوغ. 45 مل.",
    price: "1350.00",
    originalPrice: null,
    category: "Treatments",
    images: [
      "/products/schwarzkopf-color-booster.png",
      "/products/schwarzkopf-color-booster-splash.png",
    ],
    badge: "NEW",
    inStock: true,
    rating: "4.90",
    reviewCount: 19,
    features: [
      "Schwarzkopf Professional",
      "Fibre Clinix AHA Technology",
      "Enhances color vibrancy",
      "Protects color-treated hair",
      "Salon-grade formula",
      "45ml",
    ],
  },
  {
    name: "TransforM X Miss Lashes — Lash Cleanser",
    nameAr: "ترانسفورم × ميس لاشيز — غسول الرموش",
    description:
      "Miss Lashes Lash Shampoo — a gentle foam cleanser for lash extensions. Removes makeup residue and oil without compromising lash adhesive. Made in Germany.",
    descriptionAr:
      "شامبو الرموش من ميس لاشيز — غسول رغوي لطيف لاكستنشن الرموش. يزيل بقايا المكياج والزيوت دون التأثير على لاصق الرموش. صنع في ألمانيا.",
    price: "750.00",
    originalPrice: null,
    category: "Accessories",
    images: ["/products/miss-lashes-cleanser.png"],
    badge: "NEW",
    inStock: true,
    rating: "4.90",
    reviewCount: 56,
    features: [
      "Miss Lashes — Made in Germany",
      "Gentle foam formula",
      "Extension-safe",
      "Removes makeup & oil residue",
      "For all lash types",
    ],
  },
  {
    name: "Blowdry Glow Kit — TransforM Signature Bundle",
    nameAr: "باقة بلوداري جلو — باقة ترانسفورم سيجنيتشر",
    description:
      "The ultimate blowdry prep kit. Includes: Repair Shampoo + Deep Conditioning Mask + Platin Jasmine Hair Mist. Everything you need for a glossy, salon-finish blowout at home.",
    descriptionAr:
      "الباقة المثالية للتحضير قبل البلوداري. تشمل: شامبو الإصلاح + ماسك التكييف العميق + ميست شعر بلاتين ياسمين. كل ما تحتاجين لبلوداري لامع بمستوى الصالون في البيت.",
    price: "2500.00",
    originalPrice: "2900.00",
    category: "Bundles",
    images: [
      "/products/ths-repair-shampoo-mask-duo.png",
      "/products/platin-jasmine-hair-mist.png",
    ],
    badge: "SALON KIT",
    inStock: true,
    rating: "5.00",
    reviewCount: 14,
    features: [
      "Includes Repair Shampoo",
      "Includes Deep Conditioning Mask",
      "Includes Platin Jasmine Hair Mist",
      "Save 14%",
      "TransforM Signature Bundle",
    ],
  },
  {
    name: "Color Care Kit — TransforM X Schwarzkopf Bundle",
    nameAr: "باقة كير الأصباغ — ترانسفورم × شوارتزكوف",
    description:
      "Keep your color vibrant longer. Includes: Repair Shampoo + Deep Conditioning Mask + Schwarzkopf Color Booster. The pro routine for color-treated extensions.",
    descriptionAr:
      "حافظي على لون شعرك لامعاً أطول فترة. تشمل: شامبو الإصلاح + ماسك التكييف العميق + بوستر اللون من شوارتزكوف. الروتين الاحترافي للاكستنشن المصبوغ.",
    price: "3100.00",
    originalPrice: "3400.00",
    category: "Bundles",
    images: [
      "/products/schwarzkopf-color-booster.png",
      "/products/ths-repair-shampoo-mask-duo.png",
    ],
    badge: "SALON KIT",
    inStock: true,
    rating: "5.00",
    reviewCount: 9,
    features: [
      "Includes Repair Shampoo",
      "Includes Deep Conditioning Mask",
      "Includes Schwarzkopf Color Booster",
      "Save 12%",
      "TransforM X Schwarzkopf Bundle",
    ],
  },
  {
    name: "Full Transformation Kit — Salon Professional",
    nameAr: "باقة التحول الكامل — احترافية الصالون",
    description:
      "The complete extension experience. Includes: Gushli Weft Extensions + THS Loop Brush + Repair Shampoo + Repair Mask. Everything for a perfect, lasting install.",
    descriptionAr:
      "تجربة الاكستنشن الكاملة. تشمل: وصلات Gushli Weft + فرشاة THS Loop + شامبو الإصلاح + ماسك الإصلاح. كل ما تحتاجين لتركيب مثالي طويل الأمد.",
    price: "18500.00",
    originalPrice: "21000.00",
    category: "Bundles",
    images: [
      "/products/gushli-weft-model.png",
      "/products/ths-repair-shampoo-mask-duo.png",
    ],
    badge: "SALON KIT",
    inStock: true,
    rating: "5.00",
    reviewCount: 7,
    features: [
      "Includes Gushli Weft Extensions",
      "Includes THS Loop Brush",
      "Includes Repair Shampoo",
      "Includes Repair Mask",
      "Save 12%",
      "Salon Professional Kit",
    ],
  },
  {
    name: "Extensions Care Kit — TransforM Signature Bundle",
    nameAr: "باقة العناية بالاكستنشن — باقة ترانسفورم سيجنيتشر",
    description:
      "The essential maintenance set for all extension types. Includes: Repair Shampoo + Repair Mask + Platin Jasmine Hair Mist. Formulated to extend the lifespan of your extensions.",
    descriptionAr:
      "مجموعة الصيانة الأساسية لكل أنواع الاكستنشن. تشمل: شامبو الإصلاح + ماسك الإصلاح + ميست بلاتين ياسمين. مُصمَّمة لإطالة عمر الاكستنشن.",
    price: "2700.00",
    originalPrice: "3000.00",
    category: "Bundles",
    images: [
      "/products/ths-repair-mask.png",
      "/products/platin-jasmine-hair-mist.png",
    ],
    badge: "SALON KIT",
    inStock: true,
    rating: "5.00",
    reviewCount: 11,
    features: [
      "Includes Repair Shampoo",
      "Includes Repair Mask",
      "Includes Platin Hair Mist",
      "Save 10%",
      "TransforM Signature Bundle",
    ],
  },
];

export async function seedProductsIfEmpty(): Promise<void> {
  try {
    // Wrap COUNT + INSERT in a transaction guarded by a Postgres advisory
    // lock so two concurrent boots can't both observe an empty table and both
    // insert the catalog (which would yield duplicate rows — there are no
    // unique constraints on `name` to stop them at the schema level).
    //
    // The lock is RELEASED automatically when the transaction commits or
    // rolls back (`pg_advisory_xact_lock`, not the session-scoped variant),
    // so a crash mid-seed cannot leak the lock.
    //
    // NOTE on category taxonomy: the seeded categories ("hair-extensions",
    // "wigs", "hair-care", "Accessories", "Tape-In") match the dev DB
    // exactly, so prod will mirror dev's behavior. The Boutique filter chips
    // ("Tape-In" / "Keratin" / "Clip-In" / "Care" / "Accessories") match
    // only some of these — same as on dev today. Re-aligning the filter
    // taxonomy is a separate, scoped task and is intentionally not done here.
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${SEED_ADVISORY_LOCK_ID})`,
      );

      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(productsTable);

      if (count > 0) {
        logger.info({ count }, "products: seed skipped (table not empty)");
        return;
      }

      await tx.insert(productsTable).values(PRODUCTS);
      logger.info(
        { inserted: PRODUCTS.length },
        "products: seeded canonical catalog into empty table",
      );
    });
  } catch (err) {
    logger.error({ err }, "products: seed failed (non-fatal, server continues)");
  }
}
