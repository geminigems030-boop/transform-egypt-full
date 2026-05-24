import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lenis from "lenis";

import { Layout } from "@/components/Layout";
import { I18nProvider } from "@/lib/i18n";
import { CartProvider } from "@/lib/cart";
import { ChatProvider } from "@/lib/chatContext";
import CustomCursor from "@/components/CustomCursor";
import { pageMeta } from "@/lib/pageMeta";
import { trackPageView } from "@/lib/analytics";

import Home from "@/pages/Home";
const Boutique = lazy(() => import("@/pages/Boutique"));
const Cart = lazy(() => import("@/pages/Cart"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const Book = lazy(() => import("@/pages/Book"));
const Transformations = lazy(() => import("@/pages/Transformations"));
const Reviews = lazy(() => import("@/pages/Reviews"));
const Services = lazy(() => import("@/pages/Services"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const Locations = lazy(() => import("@/pages/Locations"));
const Team = lazy(() => import("@/pages/Team"));
const GiftCards = lazy(() => import("@/pages/GiftCards"));
const Lucky = lazy(() => import("@/pages/Lucky"));
const TryOn = lazy(() => import("@/pages/TryOn"));
const Admin = lazy(() => import("@/pages/Admin"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const BookConfirmed = lazy(() => import("@/pages/BookConfirmed"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function PageTitle() {
  const [location] = useLocation();
  // Guard against double-firing PageView on initial load: index.html's inline
  // Pixel script already fires PageView for the entry URL, so the very first
  // render of this effect must NOT call trackPageView. Subsequent SPA route
  // changes (wouter navigations) do need it because the inline script only
  // runs on hard reload.
  const didInitialPageView = useRef(false);
  useEffect(() => {
    const base = location.split("?")[0];
    const isProductDetail = base.startsWith("/boutique/");
    const meta = isProductDetail
      ? { title: "Product Details | TransforM Egypt Luxury Boutique", description: "Premium hair extensions and beauty products from TransforM Egypt's luxury boutique." }
      : (pageMeta[base] ?? pageMeta["/"]);
    document.title = meta.title;

    const setMetaTag = (selector: string, attr: string, value: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };

    setMetaTag('meta[name="description"]', 'content', meta.description);
    setMetaTag('meta[property="og:title"]', 'content', meta.title);
    setMetaTag('meta[property="og:description"]', 'content', meta.description);
    setMetaTag('meta[name="twitter:title"]', 'content', meta.title);
    setMetaTag('meta[name="twitter:description"]', 'content', meta.description);

    const canonicalUrl = `https://transform-egypt.com${base}`;
    setMetaTag('link[rel="canonical"]', 'href', canonicalUrl);
    setMetaTag('meta[property="og:url"]', 'content', canonicalUrl);

    // SPA route-change tracking — index.html only fires PageView on hard
    // reload, so without this every wouter navigation is invisible to Meta
    // Pixel + GA4 + TikTok. Skip the very first invocation since the inline
    // PageView already covers the entry URL (avoids double-counting).
    if (didInitialPageView.current) {
      trackPageView(base);
    } else {
      didInitialPageView.current = true;
    }
  }, [location]);
  return null;
}

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25 } },
};

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-black">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      <span className="text-gold/60 text-xs uppercase tracking-[0.3em]">Loading</span>
    </div>
  </div>
);

function AnimatedRoutes() {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location} {...pageTransition}>
        <Suspense fallback={<PageLoader />}>
          <Switch location={location}>
            <Route path="/" component={Home} />
            <Route path="/boutique" component={Boutique} />
            <Route path="/boutique/:id" component={ProductDetail} />
            <Route path="/cart" component={Cart} />
            <Route path="/checkout" component={Checkout} />
            <Route path="/book" component={Book} />
            <Route path="/transformations" component={Transformations} />
            <Route path="/reviews" component={Reviews} />
            <Route path="/services" component={Services} />
            <Route path="/locations" component={Locations} />
            <Route path="/team" component={Team} />
            <Route path="/gift-cards" component={GiftCards} />
            <Route path="/lucky" component={Lucky} />
            <Route path="/try-on" component={TryOn} />
            <Route path="/admin" component={Admin} />
            <Route path="/blog" component={Blog} />
            <Route path="/blog/:slug" component={BlogPost} />
            <Route path="/book/confirmed" component={BookConfirmed} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function Router() {
  return (
    <>
      <PageTitle />
      <AnimatedRoutes />
    </>
  );
}

function App() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
    const id = requestAnimationFrame(raf);
    return () => { lenis.destroy(); cancelAnimationFrame(id); };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <CartProvider>
          <ChatProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <CustomCursor />
                <Layout>
                  <Router />
                </Layout>
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </ChatProvider>
        </CartProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
