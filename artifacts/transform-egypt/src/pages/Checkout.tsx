import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ChevronLeft, Check, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/cart";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

type FormState = {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
};

const initialForm: FormState = {
  customerName: "",
  email: "",
  phone: "",
  address: "",
  city: "Cairo",
  notes: "",
};

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { lang } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  const isAr = lang === "ar";
  const shipping = subtotal >= 1000 ? 0 : 80;
  const total = subtotal + shipping;

  // If cart is empty (and we're not on the success screen), bounce to boutique.
  useEffect(() => {
    if (items.length === 0 && orderId === null) {
      // small delay so the toast on the boutique page doesn't race
      const t = setTimeout(() => setLocation("/boutique"), 100);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [items.length, orderId, setLocation]);

  const t = (en: string, ar: string) => (isAr ? ar : en);

  const update = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (form.customerName.trim().length < 2) e.customerName = t("Please enter your full name", "من فضلك اكتبي اسمك بالكامل");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = t("Please enter a valid email", "بريد إلكتروني غير صالح");
    const phoneClean = form.phone.replace(/\s+/g, "");
    if (phoneClean.length < 8) e.phone = t("Please enter a valid phone number", "رقم تليفون غير صالح");
    if (form.address.trim().length < 5) e.address = t("Please enter your delivery address", "من فضلك اكتبي عنوان التوصيل");
    if (form.city.trim().length < 2) e.city = t("Please enter your city", "من فضلك اكتبي المدينة");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate() || items.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          email: form.email.trim(),
          phone: form.phone.replace(/\s+/g, ""),
          address: form.address.trim(),
          city: form.city.trim(),
          notes: form.notes.trim() || undefined,
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            nameAr: i.nameAr,
            price: i.price,
            quantity: i.quantity,
            image: i.image,
          })),
          shipping,
          language: lang,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOrderId(data.id);
      clear();
    } catch (err) {
      console.error("[checkout] submit failed", err);
      toast({
        title: t("Could not place order", "تعذّر إتمام الطلب"),
        description: t(
          "Please try again or contact us on WhatsApp 01009780008.",
          "حاولي مرة أخرى أو تواصلي معنا واتساب 01009780008.",
        ),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success view ─────────────────────────────────────────────────────────
  if (orderId !== null) {
    return (
      <div className="bg-ivory min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-10 sm:p-14 rounded-xl shadow-sm border border-taupe text-center"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gold/15 flex items-center justify-center">
              <Check className="w-8 h-8 text-gold" />
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl text-black mb-3">
              {t("Order Confirmed", "تم تأكيد الطلب")}
            </h1>
            <p className="text-warm-grey mb-2">
              {t("Order Number", "رقم الطلب")}{" "}
              <span className="font-serif text-gold text-xl">#{orderId}</span>
            </p>
            <p className="text-gray-600 mt-4 leading-relaxed">
              {t(
                "We've sent a confirmation to your email. Our team will contact you shortly to confirm delivery details.",
                "أرسلنا تأكيد الطلب على بريدك الإلكتروني. هيتواصل معاكي فريقنا قريباً لتأكيد تفاصيل التوصيل.",
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Link href="/boutique" className="flex-1 sm:flex-initial">
                <Button variant="shop" className="w-full">
                  {t("Continue Shopping", "متابعة التسوق")}
                </Button>
              </Link>
              <Link href="/" className="flex-1 sm:flex-initial">
                <Button variant="secondary" className="w-full">
                  {t("Back to Home", "العودة للرئيسية")}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── Empty fallback (brief flash before redirect) ─────────────────────────
  if (items.length === 0) {
    return (
      <div className="bg-ivory min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-md text-center">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{t("Your cart is empty.", "السلة فاضية.")}</p>
        </div>
      </div>
    );
  }

  // ─── Form view ────────────────────────────────────────────────────────────
  return (
    <div className="bg-ivory min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1 text-sm text-warm-grey hover:text-gold transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          {t("Back to Cart", "الرجوع للسلة")}
        </Link>

        <h1 className="font-serif text-4xl mb-8 text-black">{t("Checkout", "إتمام الشراء")}</h1>

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-10">
          {/* Form fields */}
          <div className="w-full lg:w-2/3 space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-taupe">
              <h2 className="font-serif text-2xl mb-6 text-black">
                {t("Delivery Information", "بيانات التوصيل")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field
                  label={t("Full Name", "الاسم بالكامل")}
                  name="customerName"
                  value={form.customerName}
                  onChange={(v) => update("customerName", v)}
                  error={errors.customerName}
                  required
                  autoComplete="name"
                  className="sm:col-span-2"
                />
                <Field
                  label={t("Email", "البريد الإلكتروني")}
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(v) => update("email", v)}
                  error={errors.email}
                  required
                  autoComplete="email"
                />
                <Field
                  label={t("Phone (WhatsApp preferred)", "تليفون (واتساب مفضل)")}
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(v) => update("phone", v)}
                  error={errors.phone}
                  required
                  autoComplete="tel"
                  placeholder="01XXXXXXXXX"
                />
                <Field
                  label={t("Delivery Address", "عنوان التوصيل")}
                  name="address"
                  value={form.address}
                  onChange={(v) => update("address", v)}
                  error={errors.address}
                  required
                  autoComplete="street-address"
                  placeholder={t("Street, building, apartment", "الشارع، العمارة، الشقة")}
                  className="sm:col-span-2"
                />
                <Field
                  label={t("City", "المدينة")}
                  name="city"
                  value={form.city}
                  onChange={(v) => update("city", v)}
                  error={errors.city}
                  required
                  autoComplete="address-level2"
                />
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-black mb-2">
                    {t("Order Notes (optional)", "ملاحظات (اختياري)")}
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder={t(
                      "Special instructions, gift wrap, etc.",
                      "تعليمات خاصة، تغليف هدية، إلخ.",
                    )}
                    className="w-full border border-taupe rounded-sm px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-taupe">
              <h2 className="font-serif text-2xl mb-3 text-black">
                {t("Payment", "الدفع")}
              </h2>
              <div className="bg-ivory border border-gold/30 rounded p-4 text-sm text-gray-700 leading-relaxed">
                <strong className="text-black">{t("Cash on Delivery", "الدفع عند الاستلام")}</strong>
                <p className="mt-1 text-gray-600">
                  {t(
                    "Pay in cash or card when your order arrives. Our team will contact you to confirm.",
                    "ادفعي كاش أو بالكارت عند استلام الطلب. هيتواصل معاكي فريقنا للتأكيد.",
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Order summary */}
          <div className="w-full lg:w-1/3">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-taupe lg:sticky lg:top-32">
              <h3 className="font-serif text-2xl mb-6 text-black">
                {t("Order Summary", "ملخص الطلب")}
              </h3>

              <ul className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-1">
                {items.map((it) => (
                  <li key={it.productId} className="flex gap-3 text-sm">
                    <div className="flex-1">
                      <div className="text-black font-medium leading-tight">
                        {isAr && it.nameAr ? it.nameAr : it.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">× {it.quantity}</div>
                    </div>
                    <div className="text-black font-medium whitespace-nowrap">
                      EGP {(it.price * it.quantity).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="space-y-3 mb-6 text-sm border-t border-taupe pt-4">
                <div className="flex justify-between text-gray-600">
                  <span>{t("Subtotal", "المجموع الفرعي")}</span>
                  <span>EGP {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{t("Shipping", "الشحن")}</span>
                  <span>{shipping === 0 ? t("Free", "مجاني") : `EGP ${shipping}`}</span>
                </div>
                {shipping > 0 && (
                  <p className="text-xs text-gold">
                    {t(
                      `Add EGP ${(1000 - subtotal).toLocaleString()} more for free shipping`,
                      `أضيفي ${(1000 - subtotal).toLocaleString()} جنيه أكثر للشحن المجاني`,
                    )}
                  </p>
                )}
                <div className="border-t border-gray-100 pt-3 flex justify-between font-semibold text-lg">
                  <span className="text-black">{t("Total", "الإجمالي")}</span>
                  <span className="text-gold">EGP {total.toLocaleString()}</span>
                </div>
              </div>

              <Button
                type="submit"
                variant="shop"
                className="w-full py-4 text-base"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {t("Placing Order...", "جارٍ تأكيد الطلب...")}
                  </>
                ) : (
                  t(`Place Order — EGP ${total.toLocaleString()}`, `تأكيد الطلب — ${total.toLocaleString()} جنيه`)
                )}
              </Button>

              <p className="text-xs text-center text-gray-500 mt-4 leading-relaxed">
                {t(
                  "By placing your order you agree to be contacted by our team to confirm delivery.",
                  "بتأكيدك للطلب، أنتِ موافقة على تواصل فريقنا معاكي لتأكيد التوصيل.",
                )}
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Field component ────────────────────────────────────────────────────────

function Field({
  label,
  name,
  value,
  onChange,
  error,
  required,
  type = "text",
  autoComplete,
  placeholder,
  className,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-black mb-2">
        {label} {required && <span className="text-gold">*</span>}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`border-taupe focus-visible:ring-gold ${error ? "border-red-400" : ""}`}
      />
      {error && (
        <p id={`${name}-error`} className="text-xs text-red-500 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
