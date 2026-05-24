import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ShoppingCart, Zap, Heart, Search, Filter } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useListProducts } from '@workspace/api-client-react';
import { useCart } from '@/lib/cart';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { trackViewContent } from '@/lib/analytics';
import prodTonesTapeins from '@assets/PRODUCT_images_Toned_And_Highlighted_Tape_ins_Hair_Extensions__1774666730979.JPG';
import prodBlondeXBrown from '@assets/PRODUCT_images_Blonde_X_Brown_Hair_Extensions__1774666730979.JPG';
import prodDirtyBlonde from '@assets/PRODUCT_images_Dirty_Blonde_Hair_Extensions__1774666730978.JPG';
import prodBlackWavy from '@assets/PRODUCT_images_Black_Wavy_Hair_extensions__1774666730978.PNG';
import prodGoldConditioner from '@assets/PRODUCT_images_24_Carat_Gold_Hair_Conditioner__1774666730979.PNG';
import prodExclusiveTreatments from '@assets/_Exclusively_Available_Hair_Treatments__1774666730978.PNG';
import prodTHSBrushOnHair from '@assets/IMG_9722_1777886511537.webp';
import prodTHSBrushDetail from '@assets/IMG_9721_1777886511537.webp';

const localProductImages: string[] = [
  prodTonesTapeins,
  prodBlondeXBrown,
  prodDirtyBlonde,
  prodBlackWavy,
  prodGoldConditioner,
  prodExclusiveTreatments,
  prodTHSBrushOnHair,
];

const HERO_IMAGES = [
  { src: '/hero-founder.png', position: 'object-center' },
  { src: '/hero-founder-brush.jpeg', position: 'object-center' },
];

function BoutiqueHero({ lang }: { lang: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Preload both images
    HERO_IMAGES.forEach(({ src }) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setActiveIdx(prev => (prev + 1) % HERO_IMAGES.length);
    }, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeIdx]);

  return (
    <div className="relative h-[92vh] min-h-[560px] w-full overflow-hidden flex items-center">
      {/* Stacked images — AnimatePresence crossfades between them */}
      <AnimatePresence initial={false}>
        {HERO_IMAGES.map((img, idx) =>
          idx === activeIdx ? (
            <motion.div
              key={img.src}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, scale: 1.03 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: 'easeInOut' }}
              style={{ scale: 1 }}
            >
              <motion.img
                src={img.src}
                alt="TransforM Boutique"
                className={`w-full h-full object-cover ${img.position}`}
                initial={{ scale: 1.0 }}
                animate={{ scale: 1.04 }}
                transition={{ duration: 5.5, ease: 'easeInOut' }}
              />
            </motion.div>
          ) : null
        )}
      </AnimatePresence>

      {/* Consistent overlay — left gradient so text is readable, face stays bright */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/18 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />

      {/* Text — static, always on top */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, delay: 0.5, ease: 'easeOut' }}
        className="relative z-10 px-8 sm:px-14 lg:px-20 max-w-xl"
      >
        <p className="text-[#C9A96E] text-xs uppercase tracking-[0.35em] font-light mb-4">
          {lang === 'ar' ? 'بوتيك ترانسفورم' : 'TransforM Boutique'}
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#F5F2EC] leading-tight mb-4 whitespace-pre-line">
          {lang === 'ar' ? 'اكستنشن الشعر الفاخر والباروكات' : 'Luxury Hair\nExtensions & Wigs'}
        </h1>
        <p className="text-[#E8E2D9]/80 font-light text-sm sm:text-base mb-8 leading-relaxed">
          {lang === 'ar'
            ? 'اكتشفي مجموعتنا الحصرية من منتجات الشعر الفاخرة'
            : 'Discover our exclusive collection of premium hair products'}
        </p>
        <motion.button
          whileHover={{ scale: 1.04, boxShadow: '0 0 28px rgba(201,169,110,0.45)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => window.scrollTo({ top: window.innerHeight * 0.92, behavior: 'smooth' })}
          className="inline-flex items-center gap-2 bg-[#C9A96E] text-black font-semibold text-sm uppercase tracking-[0.2em] px-8 py-3.5 rounded-full transition-all duration-300"
        >
          {lang === 'ar' ? 'تسوقي الآن' : 'Shop Now'}
        </motion.button>
      </motion.div>
    </div>
  );
}

export default function Boutique() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const { lang } = useTranslation();

  const { data: productsData, isLoading } = useListProducts();
  
  const { addItem } = useCart();
  const [, setLocation] = useLocation();

  useEffect(() => {
    trackViewContent({ contentName: 'Boutique', contentCategory: 'shop' });
  }, []);

  // Fallback products if API is empty/missing
  const products = productsData?.products || [
    { id: 101, name: "Premium Tape-In Extensions 20\"", nameAr: "اكستنشن تيب إن بريميوم 20 بوصة", price: 4500, category: "Tape-In", rating: 5, reviewCount: 124, images: ["service-hair.png"], inStock: true, badge: "BESTSELLER" },
    { id: 102, name: "Luxury Keratin Bonds 24\"", nameAr: "اكستنشن كيراتين بوند لاكشري 24 بوصة", price: 6500, category: "Keratin", rating: 4.8, reviewCount: 89, images: ["service-hair.png"], inStock: true },
    { id: 103, name: "Clip-In Volumizer Set", nameAr: "سيت اكستنشن كلبس إن", price: 3200, category: "Clip-In", rating: 4.9, reviewCount: 210, images: ["service-hair.png"], inStock: true, originalPrice: 3800 },
    { id: 104, name: "Professional Extension Brush", nameAr: "فرشاة شعر احترافية", price: 450, category: "Accessories", rating: 4.7, reviewCount: 45, images: ["service-hair.png"], inStock: true },
    { id: 105, name: "Sulfate-Free Shampoo", nameAr: "شامبو خالي من السلفات", price: 600, category: "Care", rating: 5, reviewCount: 312, images: ["service-facials.png"], inStock: true },
    { id: 106, name: "Hydrating Hair Mask", nameAr: "ماسك مرطب للشعر", price: 850, category: "Care", rating: 4.9, reviewCount: 178, images: ["service-facials.png"], inStock: false },
    { id: 107, name: "THS Magic Brush — Loop Bristles", nameAr: "فرشاة THS ماجيك — لووب بريسلز", price: 1500, originalPrice: 3000, category: "Accessories", rating: 5, reviewCount: 64, images: [prodTHSBrushOnHair, prodTHSBrushDetail], inStock: true, badge: "OFFER 50%" },
  ];

  const categories = ['All', 'Tape-In', 'Keratin', 'Clip-In', 'Haircare', 'Treatments', 'Accessories', 'Bundles'];

  const filteredProducts = products.filter(p => {
    const matchCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleAddToCart = (product: any, idx: number) => {
    const apiImg = product.images?.[0];
    const isRealApiImg = typeof apiImg === 'string' && (apiImg.startsWith('/') || apiImg.startsWith('http'));
    const image = isRealApiImg ? apiImg : localProductImages[idx % localProductImages.length];
    addItem({
      productId: product.id,
      name: product.name,
      nameAr: product.nameAr,
      price: product.price,
      quantity: 1,
      image,
    });
    toast({
      title: lang === 'ar' ? 'تمت الإضافة إلى السلة' : 'Added to Cart',
      description: lang === 'ar' ? (product.nameAr || product.name) : product.name,
      className: "bg-black text-gold border-gold",
    });
  };

  const handleBuyNow = (product: any, idx: number) => {
    const apiImg = product.images?.[0];
    const isRealApiImg = typeof apiImg === 'string' && (apiImg.startsWith('/') || apiImg.startsWith('http'));
    const image = isRealApiImg ? apiImg : localProductImages[idx % localProductImages.length];
    addItem({
      productId: product.id,
      name: product.name,
      nameAr: product.nameAr,
      price: product.price,
      quantity: 1,
      image,
    });
    setLocation('/checkout');
  };

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Hero Banner — cinematic crossfade */}
      <BoutiqueHero lang={lang} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar / Filters */}
          <div className="w-full lg:w-1/4 space-y-8">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input 
                  placeholder="Search products..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-gray-300 focus-visible:ring-gold"
                />
              </div>
            </div>

            <div>
              <h3 className="font-serif text-xl mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5 text-gold" /> Categories
              </h3>
              <ul className="space-y-2">
                {categories.map(cat => (
                  <li key={cat}>
                    <button 
                      onClick={() => setActiveCategory(cat)}
                      className={`text-sm w-full text-left py-2 px-3 rounded transition-colors ${activeCategory === cat ? 'bg-black text-gold font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      {cat}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Product Grid */}
          <div className="w-full lg:w-3/4">
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-500 text-sm">Showing {filteredProducts.length} results</p>
              <select className="border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gold">
                <option>Sort by: Featured</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Newest Arrivals</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map((product, idx) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={product.id}
                  className="group bg-white border border-gray-100 overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <Link href={`/boutique/${product.id}`} className="block relative aspect-square overflow-hidden bg-gray-50">
                    {product.badge && (
                      <div className="absolute top-3 left-3 z-10 bg-gold text-black text-[10px] font-bold px-2 py-1">
                        {product.badge}
                      </div>
                    )}
                    {!(product as any).inStock && (
                      <div className="absolute top-3 right-3 z-10 bg-black/80 text-white text-[10px] font-bold px-2 py-1">
                        {lang === 'ar' ? 'نفذ' : 'SOLD OUT'}
                      </div>
                    )}
                    
                    {(() => {
                      const apiImg = (product as any).images?.[0];
                      const isRealApiImg = typeof apiImg === 'string' && (apiImg.startsWith('/') || apiImg.startsWith('http'));
                      const imgSrc = isRealApiImg ? apiImg : localProductImages[idx % localProductImages.length];
                      return imgSrc;
                    })() ? (
                      <img
                        src={(() => {
                          const apiImg = (product as any).images?.[0];
                          const isRealApiImg = typeof apiImg === 'string' && (apiImg.startsWith('/') || apiImg.startsWith('http'));
                          return isRealApiImg ? apiImg : localProductImages[idx % localProductImages.length];
                        })()}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-100">
                        <p className="text-gray-400 text-xs text-center px-4">{product.name}</p>
                      </div>
                    )}

                    {/* Quick Add / Buy Now Button Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex flex-col gap-2">
                      <Button
                        variant="shop"
                        size="sm"
                        className="w-full shadow-lg"
                        disabled={!(product as any).inStock}
                        onClick={(e) => { e.preventDefault(); handleBuyNow(product, idx); }}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        {(product as any).inStock ? (lang === 'ar' ? 'اشتري الآن' : 'Buy Now') : (lang === 'ar' ? 'نفذ المخزون' : 'Out of Stock')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full shadow-lg bg-white/95 hover:bg-white"
                        disabled={!(product as any).inStock}
                        onClick={(e) => { e.preventDefault(); handleAddToCart(product, idx); }}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {lang === 'ar' ? 'أضف للسلة' : 'Add to Cart'}
                      </Button>
                    </div>
                  </Link>

                  <div className="p-5 flex flex-col flex-grow text-neutral-900">
                    <div className="flex items-center gap-1 text-gold mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'fill-current' : 'fill-transparent'}`} />
                      ))}
                      <span className="text-xs text-gray-500 ml-1">({product.reviewCount})</span>
                    </div>
                    
                    <Link href={`/boutique/${product.id}`}>
                      <h3 className="font-serif text-lg leading-tight mb-2 text-neutral-900 group-hover:text-gold transition-colors cursor-pointer">
                        {lang === 'ar' ? ((product as any).nameAr || product.name) : product.name}
                      </h3>
                    </Link>
                    
                    <div className="mt-auto pt-4 flex items-center gap-3">
                      <span className="font-semibold text-lg text-neutral-900">EGP {product.price.toLocaleString()}</span>
                      {(product as any).originalPrice && (
                        <span className="text-gray-400 line-through text-sm">EGP {(product as any).originalPrice.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {filteredProducts.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
                <Button variant="secondary" className="mt-4" onClick={() => { setActiveCategory('All'); setSearchQuery(''); }}>
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
