import React from 'react';
import { Link, useLocation } from 'wouter';
import { Trash2, ChevronRight, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart';
import { useTranslation } from '@/lib/i18n';

export default function Cart() {
  const { items, subtotal, removeItem, setQuantity } = useCart();
  const { lang } = useTranslation();
  const [, setLocation] = useLocation();

  const isAr = lang === 'ar';
  const t = (en: string, ar: string) => (isAr ? ar : en);

  return (
    <div className="bg-ivory min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <h1 className="font-serif text-4xl mb-8 text-black">
          {t('Shopping Cart', 'سلة التسوق')}
        </h1>

        {items.length === 0 ? (
          <div className="bg-white p-16 text-center rounded-xl shadow-sm border border-taupe">
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-6" />
            <h2 className="text-2xl font-serif mb-4">
              {t('Your cart is empty', 'سلتك فاضية')}
            </h2>
            <p className="text-gray-500 mb-8">
              {t(
                "Looks like you haven't added anything to your cart yet.",
                'مفيش حاجة في السلة لسه.',
              )}
            </p>
            <Link href="/boutique">
              <Button variant="shop">{t('Continue Shopping', 'متابعة التسوق')}</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Cart Items */}
            <div className="w-full lg:w-2/3 space-y-6">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-taupe items-center"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                        {t('Image', 'صورة')}
                      </div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="font-serif text-base sm:text-lg mb-1 truncate">
                      {isAr && item.nameAr ? item.nameAr : item.name}
                    </h3>
                    <p className="text-gold font-semibold">
                      EGP {item.price.toLocaleString()}
                    </p>

                    <div className="flex items-center gap-3 sm:gap-4 mt-3">
                      <div className="flex items-center border border-gray-200 rounded">
                        <button
                          onClick={() => setQuantity(item.productId, item.quantity - 1)}
                          className="px-3 py-1 hover:bg-gray-50 text-black"
                          aria-label={t('Decrease quantity', 'إنقاص الكمية')}
                        >
                          −
                        </button>
                        <span className="px-3 py-1 text-sm font-medium min-w-[2rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(item.productId, item.quantity + 1)}
                          className="px-3 py-1 hover:bg-gray-50 text-black"
                          aria-label={t('Increase quantity', 'زيادة الكمية')}
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-gray-400 hover:text-red-500 flex items-center gap-1 text-sm transition-colors"
                        aria-label={t('Remove item', 'حذف المنتج')}
                      >
                        <Trash2 className="w-4 h-4" /> {t('Remove', 'حذف')}
                      </button>
                    </div>
                  </div>
                  <div className="text-right font-semibold text-base sm:text-lg hidden sm:block whitespace-nowrap">
                    EGP {(item.price * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="w-full lg:w-1/3">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-taupe lg:sticky lg:top-32">
                <h3 className="font-serif text-2xl mb-6 text-black">
                  {t('Order Summary', 'ملخص الطلب')}
                </h3>

                <div className="space-y-4 mb-6 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>{t('Subtotal', 'المجموع الفرعي')}</span>
                    <span>EGP {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{t('Shipping', 'الشحن')}</span>
                    <span>{t('Calculated at checkout', 'يحسب عند إتمام الشراء')}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-4 flex justify-between font-semibold text-lg">
                    <span className="text-black">{t('Total', 'الإجمالي')}</span>
                    <span className="text-gold">EGP {subtotal.toLocaleString()}</span>
                  </div>
                </div>

                <Button
                  variant="shop"
                  className="w-full py-4 text-base flex justify-between items-center group"
                  onClick={() => setLocation('/checkout')}
                >
                  {t('Proceed to Checkout', 'إتمام الشراء')}
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform rtl:rotate-180" />
                </Button>

                <Link
                  href="/boutique"
                  className="block text-center text-sm text-warm-grey hover:text-gold transition-colors mt-4"
                >
                  {t('← Continue Shopping', '→ متابعة التسوق')}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
