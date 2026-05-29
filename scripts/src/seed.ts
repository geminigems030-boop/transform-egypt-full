import { db, productsTable, servicesTable, reviewsTable } from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  // Clear existing data
  await db.delete(reviewsTable);
  await db.delete(productsTable);
  await db.delete(servicesTable);

  // Services
  await db.insert(servicesTable).values([
    {
      name: "Hair Extensions",
      nameAr: "إضافات الشعر",
      description: "Premium quality extensions for volume, length, and confidence. Tape-in, keratin, and micro-ring options available.",
      descriptionAr: "إضافات شعر عالية الجودة للحجم والطول والثقة. متوفرة خيارات اللاصق والكيراتين والحلقات الدقيقة.",
      startingPrice: "3500",
      image: "service-hair.png",
      isFeatured: true,
      badge: "MOST POPULAR",
    },
    {
      name: "Lash Extensions",
      nameAr: "إضافات الرموش",
      description: "Stunning lash extensions from natural to dramatic volume. Classic, volume, hybrid, and mega volume options.",
      descriptionAr: "إضافات رموش مذهلة من الطبيعية إلى الحجم الدرامي. خيارات كلاسيكية وحجم وهجين وميغا حجم.",
      startingPrice: "1200",
      image: "service-lashes.png",
      isFeatured: false,
      badge: null,
    },
    {
      name: "Microblading & Brows",
      nameAr: "الميكروبليدينج وتشكيل الحواجب",
      description: "Expert microblading and brow enhancement for perfectly defined, natural-looking brows that last 12-18 months.",
      descriptionAr: "ميكروبليدينج احترافي وتحسين الحواجب للحصول على حواجب محددة بشكل مثالي تدوم 12-18 شهرًا.",
      startingPrice: "2500",
      image: "service-brows.png",
      isFeatured: false,
      badge: null,
    },
    {
      name: "Facials & Skin Treatments",
      nameAr: "العلاجات الجمالية والجلدية",
      description: "Rejuvenating facials and advanced skin treatments for a radiant, youthful glow. Customized for your skin type.",
      descriptionAr: "علاجات تجميلية منعشة وعلاجات جلدية متقدمة للحصول على بشرة مشرقة وشبابية. مخصصة لنوع بشرتك.",
      startingPrice: "800",
      image: "service-facials.png",
      isFeatured: false,
      badge: null,
    },
    {
      name: "Professional Makeup",
      nameAr: "المكياج الاحترافي",
      description: "Celebrity-level makeup artistry for weddings, events, photoshoots, and everyday glam. Long-wearing formulas.",
      descriptionAr: "فن مكياج على مستوى المشاهير للأفراح والفعاليات والتصوير والإطلالة اليومية. تركيبات طويلة الأمد.",
      startingPrice: "500",
      image: "service-hair.png",
      isFeatured: false,
      badge: null,
    },
  ]);

  // Products
  await db.insert(productsTable).values([
    {
      name: "Tape-In Hair Extensions - Natural Blonde",
      nameAr: "إضافات الشعر اللاصقة - أشقر طبيعي",
      description: "Premium 100% human hair tape-in extensions. Seamless, lightweight, and virtually undetectable. 20 pieces per pack.",
      descriptionAr: "إضافات شعر لاصقة من الشعر الطبيعي بنسبة 100%. سلسة وخفيفة وغير ملحوظة تقريبًا. 20 قطعة في العبوة.",
      price: "4500",
      originalPrice: "5500",
      category: "hair-extensions",
      images: ["/images/service-hair.png"],
      badge: "BESTSELLER",
      inStock: true,
      rating: "4.9",
      reviewCount: 128,
      features: ["100% Human Hair", "Ethically Sourced", "6-12 Month Lifespan", "Heat Stylable", "Color Treated"],
    },
    {
      name: "Keratin Bond Extensions - Dark Brown",
      nameAr: "إضافات الكيراتين - بني داكن",
      description: "Long-lasting keratin bond extensions for maximum hold and natural movement. Includes 50 strands.",
      descriptionAr: "إضافات كيراتين طويلة الأمد لقوة تثبيت قصوى وحركة طبيعية. تشمل 50 خصلة.",
      price: "6500",
      originalPrice: null,
      category: "hair-extensions",
      images: ["/images/service-hair.png"],
      badge: null,
      inStock: true,
      rating: "4.8",
      reviewCount: 89,
      features: ["100% Human Hair", "50 Strands", "Heat Stylable", "8-12 Month Lifespan"],
    },
    {
      name: "Clip-In Extensions Set - Ombre",
      nameAr: "طقم إضافات كليب - أومبري",
      description: "Instant volume and length with 8-piece clip-in set. Perfect for special occasions. No commitment required.",
      descriptionAr: "حجم وطول فوري مع طقم 8 قطع قابلة للتثبيت. مثالية للمناسبات الخاصة. لا يلزم الالتزام.",
      price: "2800",
      originalPrice: "3200",
      category: "hair-extensions",
      images: ["/images/service-hair.png"],
      badge: "SALE",
      inStock: true,
      rating: "4.7",
      reviewCount: 203,
      features: ["8-Piece Set", "Reusable", "No Damage", "Instant Application"],
    },
    {
      name: "Full Lace Wig - Natural Wave",
      nameAr: "باروكة الدانتيل الكاملة - موجة طبيعية",
      description: "Luxury full lace wig with pre-plucked hairline for the most natural look. 24-inch length.",
      descriptionAr: "باروكة دانتيل فاخرة كاملة مع خط شعر منقوش مسبقًا للمظهر الأكثر طبيعية. طول 24 بوصة.",
      price: "12000",
      originalPrice: null,
      category: "wigs",
      images: ["/images/service-hair.png"],
      badge: "NEW",
      inStock: true,
      rating: "5.0",
      reviewCount: 34,
      features: ["Full Lace", "Pre-plucked", "Baby Hair", "Swiss Lace", "Customizable"],
    },
    {
      name: "TransforM Hair Care Kit",
      nameAr: "طقم العناية بالشعر ترانسفورم",
      description: "Complete maintenance kit for hair extensions. Sulfate-free shampoo, conditioning treatment, and detangling brush.",
      descriptionAr: "طقم صيانة كامل لإضافات الشعر. شامبو خالٍ من الكبريتات وعلاج مكيف وفرشاة لإزالة التشابك.",
      price: "950",
      originalPrice: "1200",
      category: "hair-care",
      images: ["/images/service-hair.png"],
      badge: "BESTSELLER",
      inStock: true,
      rating: "4.9",
      reviewCount: 567,
      features: ["Sulfate-Free", "Paraben-Free", "Extension Safe", "3-Piece Kit"],
    },
    {
      name: "Micro-Ring Extensions - Black",
      nameAr: "إضافات الحلقات الدقيقة - أسود",
      description: "No heat, no glue micro-ring extensions for the most damage-free application. 100 strands included.",
      descriptionAr: "إضافات حلقات دقيقة بدون حرارة وبدون غراء للتطبيق الأكثر أمانًا. تشمل 100 خصلة.",
      price: "5500",
      originalPrice: null,
      category: "hair-extensions",
      images: ["/images/service-hair.png"],
      badge: null,
      inStock: true,
      rating: "4.8",
      reviewCount: 72,
      features: ["No Heat Required", "No Glue", "100 Strands", "Reusable Rings"],
    },
  ]);

  // Reviews
  await db.insert(reviewsTable).values([
    {
      clientName: "Nadia Hassan",
      clientImage: undefined,
      rating: "5.0",
      text: "TransforM completely changed my life! I went from thin, lifeless hair to the most gorgeous, voluminous extensions. Mervat and her team are true artists. Worth every single penny and more!",
      textAr: "ترانسفورم غيّرت حياتي تمامًا! انتقلت من شعر رفيع وبلا حياة إلى أجمل إضافات بكثافة رائعة. ميرفت وفريقها فنانون حقيقيون. تستحق كل قرش وأكثر!",
      service: "Hair Extensions",
    },
    {
      clientName: "Yasmine Al-Rashid",
      clientImage: undefined,
      rating: "5.0",
      text: "I've been coming to TransforM for 3 years and I wouldn't go anywhere else. The lash extensions are so natural and last 4-6 weeks with perfect maintenance. The salon itself feels like a 5-star experience.",
      textAr: "أتردد على ترانسفورم منذ 3 سنوات ولن أذهب إلى أي مكان آخر. إضافات الرموش طبيعية جدًا وتدوم 4-6 أسابيع مع الصيانة المثالية. الصالون نفسه يشعرك بتجربة 5 نجوم.",
      service: "Lash Extensions",
    },
    {
      clientName: "Sarah El-Masry",
      clientImage: undefined,
      rating: "5.0",
      text: "My microblading results are absolutely stunning. They understood exactly the natural brow shape I wanted and executed it perfectly. I wake up looking polished every single day!",
      textAr: "نتائج الميكروبليدينج الخاصة بي مذهلة تمامًا. فهموا بالضبط شكل الحاجب الطبيعي الذي أردته ونفذوه بشكل مثالي. أستيقظ كل يوم بمظهر أنيق!",
      service: "Microblading",
    },
    {
      clientName: "Mariam Samir",
      clientImage: undefined,
      rating: "5.0",
      text: "I had my bridal package done at TransforM for my wedding and I was absolutely breathtaking. Every guest asked who did my hair and makeup. I cannot thank this team enough!",
      textAr: "أجريت باقة العروس في ترانسفورم لحفل زفافي وكنت رائعة تمامًا. كل ضيف سأل من أعد شعري ومكياجي. لا أستطيع أن أشكر هذا الفريق بما يكفي!",
      service: "Bridal Package",
    },
    {
      clientName: "Layla Mostafa",
      clientImage: undefined,
      rating: "5.0",
      text: "The tape-in extensions I got from TransforM are the most natural-looking I've ever seen. Nobody can tell they're not my real hair! The products they recommended kept them perfect for months.",
      textAr: "إضافات اللاصق التي حصلت عليها من ترانسفورم هي الأكثر طبيعية التي رأيتها على الإطلاق. لا أحد يستطيع أن يعرف أنها ليست شعري الحقيقي! المنتجات التي أوصوا بها أبقتها مثالية لأشهر.",
      service: "Tape-In Extensions",
    },
  ]);

  console.log("Database seeded successfully!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
