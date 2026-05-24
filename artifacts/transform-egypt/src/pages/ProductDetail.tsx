import React, { useState, useEffect } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Star, Heart, ShoppingCart, Zap, Shield, Truck, RotateCcw, ChevronLeft, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGetProduct } from '@workspace/api-client-react';
import { useCart } from '@/lib/cart';
import { useToast } from '@/hooks/use-toast';
import { trackViewContent } from '@/lib/analytics';
import prodTHSBrushOnHair from '@assets/IMG_9722_1777886511537.webp';
import prodTHSBrushDetail from '@assets/IMG_9721_1777886511537.webp';

const localProductFallbacks: Record<number, any> = {
  107: {
    id: 107,
    name: 'THS Magic Brush — Loop Bristles',
    nameAr: 'فرشاة THS ماجيك — لووب بريسلز',
    description:
      'Keep extension bonds tangle-free with The THS Loop Brush. Carefully designed with loop bristles to prevent the snagging that ordinary brushes cause. A must-have for all extension types — especially strand-by-strand techniques.',
    descriptionAr:
      'فرشاة THS Loop بتحمي البوندز من التشابك. تصميم اللووب بريسلز بيمنع الشد والكسر اللي بتسببه الفرش العادية. لازمة لكل أنواع الاكستنشن — خصوصاً الاسترند باي استرند.',
    price: 1500,
    originalPrice: 3000,
    rating: 5,
    reviewCount: 64,
    badge: 'OFFER 50%',
    images: [prodTHSBrushOnHair, prodTHSBrushDetail],
    features: [
      'Loop bristles — no snag, no breakage',
      'Safe on all extension types',
      'Ergonomic non-slip matte grip',
      'Hanging hole for easy storage',
      'Free shipping included',
      '50% OFF — was EGP 3,000',
    ],
    featuresAr: [
      'لووب بريسلز — من غير شد أو تكسير',
      'آمن على كل أنواع الاكستنشن',
      'مقبض مطفي مريح ومانع للانزلاق',
      'فتحة تعليق للتخزين السهل',
      'شحن مجاني',
      'خصم 50٪ — كان 3,000 جنيه',
    ],
    inStock: true,
    stockCount: 25,
    category: 'Accessories',
    hideVariants: true,
  },
};

const lengths = ['12"', '16"', '20"', '24"'];
const colors = [
  { name: 'Natural Black', hex: '#1a1a1a' },
  { name: 'Dark Brown', hex: '#3d1c02' },
  { name: 'Warm Brown', hex: '#7b4f2e' },
  { name: 'Honey Blonde', hex: '#c8a96e' },
  { name: 'Platinum', hex: '#e8e0d0' },
  { name: 'Ombre', hex: 'linear-gradient(to right, #1a1a1a, #c8a96e)' },
];

const AccordionItem = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-taupe">
      <button className="w-full flex justify-between items-center py-4 text-left font-medium text-black hover:text-gold transition-colors" onClick={() => setOpen(!open)}>
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="pb-4 text-gray-600 font-light leading-relaxed text-sm">{children}</div>}
    </div>
  );
};

const fallbackProduct = {
  id: 1,
  name: 'Premium Tape-In Hair Extensions',
  nameAr: 'اكستنشن تيب إن لاكشري',
  description: 'Our signature tape-in extensions use 100% Remy human hair for the most seamless, natural result. Each pack contains 20 wefts for a full head of volume and length.',
  descriptionAr: 'الاكستنشن التيب إن بتاعنا بيستخدم شعر ريمي طبيعي 100٪ علشان أعلى تناسق وأكثر نتيجة طبيعية.',
  price: 3500,
  originalPrice: 4200,
  rating: 4.9,
  reviewCount: 128,
  badge: 'BESTSELLER',
  image: '',
  images: [],
  features: ['100% Remy Human Hair', 'Ethically Sourced', '6–12 Month Lifespan', 'Heat Stylable up to 180°C', 'Color Treated Safe', 'Free Shipping over EGP 1,000'],
  featuresAr: ['شعر ريمي طبيعي 100٪', 'مصدر أخلاقي', 'عمر 6–12 شهراً', 'يتحمل الحرارة حتى 180 درجة', 'آمن للصباغة', 'شحن مجاني فوق 1,000 جنيه'],
  inStock: true,
  stockCount: 8,
};

export default function ProductDetail() {
  const [, params] = useRoute('/boutique/:id');
  const { lang } = useTranslation();
  const { toast } = useToast();
  const productId = params?.id ? parseInt(params.id) : 1;

  const { data, isLoading } = useGetProduct(productId);
  const { addItem } = useCart();
  const [, setLocation] = useLocation();

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedLength, setSelectedLength] = useState(0);
  const [selectedColor, setSelectedColor] = useState(0);
  const [qty, setQty] = useState(1);
  const [wishlist, setWishlist] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const apiProduct = (data as any)?.product ?? ((data as any)?.id ? data : null);
  const product = apiProduct || localProductFallbacks[productId] || fallbackProduct;
  const rawImages = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);
  const images = rawImages.length > 0 ? rawImages : [];
  const hideVariants = product.hideVariants === true || product.category === 'Accessories';

  useEffect(() => {
    if (!product?.id) return;
    trackViewContent({
      contentName: product.name,
      contentCategory: product.category ?? 'product',
      contentIds: [product.id],
      value: typeof product.price === 'number' ? product.price : undefined,
      currency: 'EGP',
    });
  }, [product?.id, product?.name, product?.category, product?.price]);

  // JSON-LD Product schema for Google + Meta product catalog crawlers.
  useEffect(() => {
    if (!product?.id) return;
    const ld = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: rawImages,
      sku: String(product.id),
      brand: { '@type': 'Brand', name: 'TransforM Egypt' },
      offers: {
        '@type': 'Offer',
        url: `https://transform-egypt.com/boutique/${product.id}`,
        priceCurrency: 'EGP',
        price: product.price,
        availability: product.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      },
      ...(product.rating
        ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviewCount ?? 1 } }
        : {}),
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.productJsonld = String(product.id);
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [product?.id, product?.name, product?.price, product?.inStock]);

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      nameAr: product.nameAr,
      price: product.price,
      quantity: qty,
      image: images[0],
    });
    setAddedToCart(true);
    toast({
      title: lang === 'ar' ? 'تمت الإضافة إلى السلة!' : 'Added to Cart!',
      description: lang === 'ar' ? `${product.nameAr || product.name} × ${qty}` : `${product.name} × ${qty}`,
    });
    setTimeout(() => setAddedToCart(false), 3000);
  };

  const handleBuyNow = () => {
    addItem({
      productId: product.id,
      name: product.name,
      nameAr: product.nameAr,
      price: product.price,
      quantity: qty,
      image: images[0],
    });
    setLocation('/checkout');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const savings = product.originalPrice ? product.originalPrice - product.price : 0;

  return (
    <div className="min-h-screen bg-white pt-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-warm-grey mb-8">
          <Link href="/" className="hover:text-gold transition-colors">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link>
          <span>/</span>
          <Link href="/boutique" className="hover:text-gold transition-colors">{lang === 'ar' ? 'المتجر' : 'Boutique'}</Link>
          <span>/</span>
          <span className="text-black">{lang === 'ar' ? (product.nameAr || product.name) : product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          {/* Images */}
          <div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative aspect-square overflow-hidden rounded-sm bg-ivory mb-4 group">
              {product.badge && (
                <div className="absolute top-4 left-4 z-10 bg-gold text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1">
                  {product.badge}
                </div>
              )}
              {images.length > 0 ? (
                <img src={images[selectedImage]} alt={lang === 'ar' ? (product.nameAr || product.name) : product.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-ivory border-2 border-dashed border-gold/50">
                  <p className="text-gold text-xs font-bold uppercase tracking-widest text-center px-4">PRODUCT: {product.name}</p>
                  <p className="text-warm-grey text-[10px] mt-2">Send your product image</p>
                </div>
              )}
            </motion.div>
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {images.map((src: string, i: number) => (
                  <button key={i} onClick={() => setSelectedImage(i)} className={cn("aspect-square overflow-hidden rounded-sm border-2 transition-colors", selectedImage === i ? "border-gold" : "border-transparent hover:border-taupe")}>
                    <img src={src} alt={`View ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-black mb-3">
              {lang === 'ar' ? (product.nameAr || product.name) : product.name}
            </h1>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={cn("w-4 h-4", i < Math.floor(product.rating || 5) ? "text-gold fill-current" : "text-gray-300")} />
                ))}
              </div>
              <a href="#reviews" className="text-sm text-warm-grey hover:text-gold transition-colors">
                {product.rating || 4.9} ({product.reviewCount || 128} {lang === 'ar' ? 'تقييم' : 'reviews'})
              </a>
            </div>

            <div className="flex items-baseline gap-3 mb-6">
              <span className="font-serif text-3xl text-gold">EGP {product.price?.toLocaleString()}</span>
              {product.originalPrice && (
                <>
                  <span className="text-gray-400 line-through text-lg">EGP {product.originalPrice.toLocaleString()}</span>
                  <span className="text-green-600 text-sm font-medium">
                    {lang === 'ar' ? `وفري ${savings.toLocaleString()} جنيه` : `Save EGP ${savings.toLocaleString()}`}
                  </span>
                </>
              )}
            </div>

            <p className="text-gray-600 font-light leading-relaxed mb-8">
              {lang === 'ar' ? (product.descriptionAr || product.description) : product.description}
            </p>

            {/* Length Selector */}
            {!hideVariants && (
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-widest text-black mb-3">
                {lang === 'ar' ? 'الطول' : 'Length'}: <span className="text-gold">{lengths[selectedLength]}</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {lengths.map((len, i) => (
                  <button
                    key={len}
                    onClick={() => setSelectedLength(i)}
                    className={cn(
                      "px-4 py-2 text-sm border rounded-sm transition-all",
                      selectedLength === i ? "bg-gold text-black border-gold font-semibold" : "bg-white text-black border-taupe hover:border-gold"
                    )}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Color Selector */}
            {!hideVariants && (
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-black mb-3">
                {lang === 'ar' ? 'اللون' : 'Color'}: <span className="text-gold">{colors[selectedColor].name}</span>
              </p>
              <div className="flex gap-3 flex-wrap">
                {colors.map((color, i) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(i)}
                    title={color.name}
                    className={cn("w-9 h-9 rounded-full border-2 transition-all hover:scale-110", selectedColor === i ? "border-gold shadow-[0_0_0_2px_rgba(212,175,55,0.4)]" : "border-transparent")}
                    style={{ background: color.hex }}
                    aria-label={color.name}
                  />
                ))}
              </div>
            </div>
            )}

            {/* Stock Status */}
            <div className="flex items-center gap-2 mb-6">
              <span className={cn("w-2 h-2 rounded-full", product.inStock ? "bg-green-500" : "bg-red-500")}></span>
              <span className={cn("text-sm font-medium", product.inStock ? "text-green-600" : "text-red-600")}>
                {product.inStock
                  ? (product.stockCount < 10 ? (lang === 'ar' ? `${product.stockCount || 8} متبقية فقط` : `Only ${product.stockCount || 8} left`) : (lang === 'ar' ? 'متوفر' : 'In Stock'))
                  : (lang === 'ar' ? 'غير متوفر' : 'Out of Stock')}
              </span>
            </div>

            {/* Qty + Add to Cart */}
            <div className="flex gap-4 mb-4">
              <div className="flex items-center border border-taupe rounded-sm">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-4 py-3 text-black hover:text-gold transition-colors font-medium">−</button>
                <span className="px-4 py-3 text-black font-medium min-w-[3rem] text-center">{qty}</span>
                <button onClick={() => setQty(q => Math.min(10, q + 1))} className="px-4 py-3 text-black hover:text-gold transition-colors font-medium">+</button>
              </div>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1 h-auto"
                onClick={handleAddToCart}
                disabled={!product.inStock}
              >
                {addedToCart ? (
                  <><Check className="w-5 h-5 mr-2" />{lang === 'ar' ? 'تمت الإضافة!' : 'Added!'}</>
                ) : (
                  <><ShoppingCart className="w-5 h-5 mr-2" />{lang === 'ar' ? 'أضف للسلة' : 'Add to Cart'}</>
                )}
              </Button>
            </div>

            {/* Buy Now — primary checkout CTA (skips cart) */}
            <div className="mb-4">
              <Button
                variant="shop"
                size="lg"
                className="w-full h-auto"
                onClick={handleBuyNow}
                disabled={!product.inStock}
              >
                <Zap className="w-5 h-5 mr-2" />
                {lang === 'ar'
                  ? `اشتري الآن — EGP ${(product.price * qty).toLocaleString()}`
                  : `Buy Now — EGP ${(product.price * qty).toLocaleString()}`}
              </Button>
            </div>

            <div className="flex gap-4 mb-8">
              <Link href="/book" className="flex-1">
                <Button variant="primary" size="lg" className="w-full h-12">{lang === 'ar' ? 'احجزي الآن' : 'Book Now'}</Button>
              </Link>
              <button
                onClick={() => setWishlist(w => !w)}
                className={cn("w-12 h-12 border rounded-sm flex items-center justify-center transition-colors", wishlist ? "border-gold text-gold bg-gold/10" : "border-taupe text-warm-grey hover:border-gold hover:text-gold")}
                aria-label="Add to wishlist"
              >
                <Heart className={cn("w-5 h-5", wishlist && "fill-current")} />
              </button>
            </div>

            {/* Features */}
            <ul className="grid grid-cols-1 gap-2 mb-8">
              {(lang === 'ar' ? (product.featuresAr || fallbackProduct.featuresAr) : (product.features || fallbackProduct.features)).map((feat: string, i: number) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-gold flex-shrink-0" /> {feat}
                </li>
              ))}
            </ul>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 py-6 border-t border-taupe">
              {[
                { icon: Shield, labelEn: 'Secure Checkout', labelAr: 'دفع آمن' },
                { icon: Truck, labelEn: 'Free Shipping', labelAr: 'شحن مجاني' },
                { icon: RotateCcw, labelEn: 'Easy Returns', labelAr: 'إرجاع سهل' },
              ].map(({ icon: Icon, labelEn, labelAr }) => (
                <div key={labelEn} className="flex flex-col items-center gap-2 text-center">
                  <Icon className="w-6 h-6 text-gold" />
                  <span className="text-xs text-warm-grey">{lang === 'ar' ? labelAr : labelEn}</span>
                </div>
              ))}
            </div>

            {/* Accordion */}
            <div className="mt-6">
              <AccordionItem title={lang === 'ar' ? 'الوصف الكامل' : 'Full Description'}>
                <p>{lang === 'ar' ? (product.descriptionAr || product.description) : product.description}</p>
                <p className="mt-3">Each pack contains 20 high-quality wefts for a full head application. Our hair is double-drawn for consistent density from root to tip.</p>
              </AccordionItem>
              <AccordionItem title={lang === 'ar' ? 'طريقة التطبيق' : 'How to Apply'}>
                <p>We strongly recommend professional application at our salon for the best results and longest lifespan. Book a <Link href="/book" className="text-gold underline">free consultation</Link> to get started.</p>
              </AccordionItem>
              <AccordionItem title={lang === 'ar' ? 'تعليمات العناية' : 'Care Instructions'}>
                <p>Wash with sulphate-free shampoo 2–3 times per week. Always use a leave-in conditioner. Avoid applying heat above 180°C. Sleep in a loose braid to prevent tangling.</p>
              </AccordionItem>
              <AccordionItem title={lang === 'ar' ? 'الشحن والإرجاع' : 'Shipping & Returns'}>
                <p>Free shipping on orders over EGP 1,000. Standard delivery 3–5 business days. Express delivery available. 14-day returns on unused, unopened products.</p>
              </AccordionItem>
            </div>
          </div>
        </div>

        {/* Back to boutique */}
        <div className="border-t border-taupe pt-8">
          <Link href="/boutique" className="inline-flex items-center gap-2 text-warm-grey hover:text-black transition-colors font-medium">
            <ChevronLeft className="w-4 h-4" />
            {lang === 'ar' ? 'العودة إلى المتجر' : 'Back to Boutique'}
          </Link>
        </div>
      </div>
    </div>
  );
}
