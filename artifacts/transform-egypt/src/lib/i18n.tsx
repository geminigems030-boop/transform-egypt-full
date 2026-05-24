import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ar';

interface I18nContextType {
  lang: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
  // Navigation
  "nav.home": { en: "Home", ar: "الرئيسية" },
  "nav.services": { en: "Services", ar: "الخدمات" },
  "nav.transformations": { en: "Transformations", ar: "ترانسفورميشن" },
  "nav.boutique": { en: "Boutique", ar: "البوتيك" },
  "nav.reviews": { en: "Reviews", ar: "الريفيوهات" },
  "nav.about": { en: "About", ar: "من إحنا" },
  "nav.blog": { en: "Blog", ar: "المدونة" },
  "nav.book": { en: "Book Appointment", ar: "احجزي معاد" },
  "nav.locations": { en: "Locations", ar: "الفروع" },
  "nav.team": { en: "Team", ar: "الفريق" },
  "nav.giftCards": { en: "Gift Cards", ar: "جيفت كارد" },
  "nav.tryOn": { en: "AI Try-On", ar: "جربي AI" },

  // FAQ
  "faq.title": { en: "Everything you want to know.", ar: "كل اللي حابة تعرفيه." },
  "faq.eyebrow": { en: "Common Questions", ar: "أسئلة بنسمعها كتير" },
  "faq.cta": { en: "Book a Free Consultation", ar: "احجزي كونسلتيشن مجانية" },

  // Press
  "press.eyebrow": { en: "As Featured In", ar: "ظهرنا في" },
  "press.title": { en: "Trusted by celebrities and the editors who cover them.", ar: "ثقة النجمات وكبرى المنابر الإعلامية." },

  // Team
  "team.eyebrow": { en: "Our Team", ar: "فريقنا" },
  "team.title": { en: "Artists who really know you.", ar: "آرتيستات بيعرفوكي صح." },

  // Gift Cards
  "gift.eyebrow": { en: "Gift Cards", ar: "جيفت كارد" },
  "gift.title": { en: "A gift she'll remember.", ar: "هدية مش هتنساها." },
  "gift.requestWA": { en: "Request on WhatsApp", ar: "اطلبيها على الواتساب" },

  // Hero
  "hero.title": { en: "The #1 Hair Extensions Center in Egypt & The Middle East", ar: "المركز الأول للاكستنشن في مصر والشرق الأوسط" },
  "hero.subtitle": { en: "Luxury hair transformations. Celebrity-level beauty services.", ar: "ترانسفورميشن شعر لاكشري. تجربة بيوتي بمستوى النجمات." },
  "hero.bookAppt": { en: "Book Appointment", ar: "احجزي معاد" },
  "hero.viewTrans": { en: "View Transformations", ar: "شوفي الترانسفورميشن" },
  "hero.shopExtensions": { en: "Shop Hair Extensions", ar: "تسوقي اكستنشن الشعر" },

  // Social Proof
  "stats.reviews": { en: "Google Reviews", ar: "ريفيوهات جوجل" },
  "stats.years": { en: "Years of Excellence", ar: "سنة من التميّز" },
  "stats.clients": { en: "Happy Clients", ar: "عميلة سعيدة" },
  "stats.celebs": { en: "Trusted by Celebrities", ar: "ثقة النجمات" },

  // Services
  "services.title": { en: "Signature Services", ar: "سيجنتشر سيرفس" },
  "services.subtitle": { en: "Celebrity-level beauty, tailored for you", ar: "بيوتي بمستوى النجمات، مفصّل ليكي" },
  "services.book": { en: "Book Now", ar: "احجزي دلوقتي" },
  "services.from": { en: "From", ar: "تبدأ من" },

  // Boutique
  "boutique.title": { en: "Luxury Boutique", ar: "البوتيك الفاخر" },
  "boutique.subtitle": { en: "Shop Premium Hair Extensions & Beauty Products", ar: "تسوقي اكستنشن بريميوم ومنتجات بيوتي" },
  "boutique.addCart": { en: "Add to Cart", ar: "أضيفي للسلة" },

  // Booking
  "book.title": { en: "Book Your VIP Experience", ar: "احجزي تجربتك الـ VIP" },
  "book.subtitle": { en: "Reserve your spot at Cairo's #1 luxury beauty destination", ar: "احجزي مكانك في وجهة الـ Beauty الأولى في القاهرة" },
  "book.name": { en: "Full Name", ar: "الاسم بالكامل" },
  "book.phone": { en: "Phone Number", ar: "رقم الموبايل" },
  "book.email": { en: "Email Address", ar: "الإيميل" },
  "book.service": { en: "Service of Interest", ar: "الخدمة اللي تهمّك" },
  "book.date": { en: "Preferred Date", ar: "التاريخ اللي يناسبك" },
  "book.notes": { en: "Additional Notes (Optional)", ar: "ملاحظات إضافية (اختياري)" },
  "book.submit": { en: "Request Appointment", ar: "أرسلي طلب الحجز" },

  // Campaigns
  "campaigns.title": { en: "Campaigns", ar: "حملات التواصل" },
  "campaigns.newCampaign": { en: "New Campaign", ar: "حملة جديدة" },
  "campaigns.segment": { en: "Lead Segment", ar: "شريحة العملاء" },
  "campaigns.channel": { en: "Channel", ar: "القناة" },
  "campaigns.email": { en: "Email", ar: "إيميل" },
  "campaigns.dm": { en: "DM", ar: "رسائل مباشرة" },
  "campaigns.status": { en: "Status", ar: "الحالة" },
  "campaigns.draft": { en: "Draft", ar: "مسودة" },
  "campaigns.scheduled": { en: "Scheduled", ar: "مجدول" },
  "campaigns.running": { en: "Running", ar: "قيد التشغيل" },
  "campaigns.completed": { en: "Completed", ar: "مكتمل" },
  "campaigns.sent": { en: "Sent", ar: "تم الإرسال" },
  "campaigns.pending": { en: "Pending", ar: "معلق" },
  "campaigns.failed": { en: "Failed", ar: "فشل" },
  "campaigns.generateCopy": { en: "AI Generate Copy", ar: "توليد نص AI" },
  "campaigns.send": { en: "Send", ar: "إرسال" },
  "campaigns.leads": { en: "Leads", ar: "العملاء المحتملين" },
  "campaigns.totalLeads": { en: "Total Leads", ar: "إجمالي العملاء" },
  "campaigns.noBooking": { en: "No Booking (Form submits)", ar: "بدون حجز (نماذج التواصل)" },
  "campaigns.luckySpin": { en: "Lucky Spin Winners", ar: "فائزات اللاكي سبين" },
  "campaigns.warmDm": { en: "Warm DMs (no booking)", ar: "رسائل دافئة (بدون حجز)" },
  "campaigns.postBooking": { en: "Post-Booking Re-engage", ar: "إعادة التواصل بعد الحجز" },
  "campaigns.newsletter": { en: "Newsletter Opt-ins", ar: "المشتركات في النشرة" },
  "campaigns.abandonedCart": { en: "Abandoned Carts", ar: "سلات مهجورة" },
  "campaigns.noCampaigns": { en: "No campaigns yet. Create your first re-engagement campaign.", ar: "لا توجد حملات بعد. أنشئي أول حملة تواصل." },

  // Transformations
  "trans.title": { en: "Real Transformations, Real Results", ar: "ترانسفورميشن حقيقي، نتايج حقيقية" },
  "trans.subtitle": { en: "See the TransforM difference", ar: "شوفي الفرق مع ترانسفورم" },
  "trans.viewAll": { en: "View All Transformations", ar: "كل الترانسفورميشن" },

  // Reviews
  "reviews.title": { en: "What Our Clients Say", ar: "كلام عميلاتنا" },
  "reviews.subtitle": { en: "Real reviews from real transformations", ar: "ريفيوهات حقيقية من ترانسفورميشن حقيقي" },
  "reviews.readMore": { en: "Read More Reviews", ar: "اقرأي ريفيوهات أكتر" },

  // Founder
  "founder.meetOur": { en: "Meet Our Founder", ar: "تعرّفي على مؤسستنا" },
  "founder.title": { en: "Founder & CEO · Beauty Expert & Image Consultant", ar: "المؤسِّسة والـ CEO · خبيرة جمال ومستشارة إطلالة" },
  "founder.freeConsult": { en: "Book VIP Private Consultation", ar: "احجزي استشارة VIP خاصة" },

  // Locations
  "locations.title": { en: "Our Prestigious Locations", ar: "فروعنا في أرقى الأماكن" },
  "locations.subtitle": { en: "Six Addresses · One Standard of Excellence", ar: "6 فروع · ستاندرد واحد من التميّز" },
  "locations.bookNearest": { en: "Book at Your Nearest Branch", ar: "احجزي في أقرب فرع ليكي" },

  // Instagram
  "instagram.title": { en: "Follow Our Transformations", ar: "تابعي الترانسفورميشن بتاعتنا" },
  "instagram.follow": { en: "Follow on Instagram", ar: "تابعي على إنستجرام" },

  // Quiz
  "quiz.title": { en: "Find Your Perfect Hair Extensions", ar: "لاقي الاكستنشن المثالي ليكي" },
  "quiz.subtitle": { en: "Take our 60-second quiz for personalized recommendations", ar: "اختبار سريع في 60 ثانية للترشيحات الخاصة بيكي" },
  "quiz.step": { en: "Step", ar: "خطوة" },
  "quiz.of": { en: "of", ar: "من" },
  "quiz.recommendation": { en: "Our Recommendation For You", ar: "ترشيحنا ليكي" },
  "quiz.freeConsult": { en: "Book FREE Consultation", ar: "احجزي كونسلتيشن مجانية" },
  "quiz.startOver": { en: "Start Over", ar: "ابدأي من جديد" },

  // CTA
  "cta.ready": { en: "Ready for Your Transformation?", ar: "جاهزة للترانسفورميشن بتاعك؟" },
  "cta.freeConsult": { en: "First-time clients receive a FREE consultation", ar: "أول زيارة كونسلتيشن مجانية بالكامل" },
  "cta.bookOnline": { en: "Book Online", ar: "احجزي أونلاين" },
  "cta.whatsapp": { en: "WhatsApp Booking", ar: "احجزي على الواتساب" },
  "cta.openHours": { en: "Open 7 days a week, 10 AM – 10 PM", ar: "مفتوحين 7 أيام في الأسبوع، من 10 ص لـ 10 م" },

  // Experience
  "exp.title": { en: "The TransforM Experience", ar: "تجربة ترانسفورم" },
  "exp.heading": { en: "The Art of Metamorphosis — Where Every Detail Counts", ar: "فن الترانسفورميشن — كل تفصيلة بتفرق" },
  "exp.begin": { en: "Begin Your Experience", ar: "ابدأي تجربتك" },

  // Why
  "why.title": { en: "Why Choose TransforM?", ar: "ليه ترانسفورم؟" },

  // Footer
  "footer.services": { en: "Services", ar: "الخدمات" },
  "footer.branches": { en: "Branches", ar: "الفروع" },
  "footer.contact": { en: "Contact", ar: "كلّمينا" },
  "footer.newsletter": { en: "Newsletter", ar: "النشرة" },
  "footer.emailPlaceholder": { en: "Your Email", ar: "إيميلك" },
  "footer.tagline": { en: "A new you, Today!", ar: "أنتِ جديدة، اليوم!" },
  "footer.description": { en: "Where beauty meets precision. Egypt's largest and most premium beauty center.", ar: "حيث الـ Beauty يقابل الدقة. أكبر وأفخم سنتر اكستنشن وبيوتي في مصر." },
  "footer.whatsapp": { en: "WhatsApp", ar: "واتساب" },
  "footer.openHours": { en: "Open 7 Days: 10 AM – 10 PM", ar: "مفتوحين 7 أيام: 10 ص – 10 م" },
  "footer.hairExt": { en: "Hair Extensions", ar: "اكستنشن الشعر" },
  "footer.lashExt": { en: "Lash Extensions", ar: "اكستنشن رموش (هايبرد)" },
  "footer.microblading": { en: "Microblading", ar: "مايكروبليدنج" },
  "footer.skincare": { en: "Skin Care & Facials", ar: "سكين كير وفيشيال" },
  "footer.nails": { en: "Nails & Beauty", ar: "نيلز وبيوتي" },
  "footer.promotions": { en: "Promotions", ar: "العروض" },
  "footer.lucky": { en: "Daily Giveaway · Only 5 spots today", ar: "العرض اليومي · 5 فائزات بس النهاردة" },
  "footer.privacy": { en: "Privacy Policy", ar: "سياسة الخصوصية" },
  "footer.terms": { en: "Terms of Service", ar: "الشروط والأحكام" },
  "footer.rights": { en: "All rights reserved.", ar: "كل الحقوق محفوظة." },

  // Lucky / Spin & Quiz
  "lucky.eyebrow": { en: "Daily Beauty Giveaway · Only 5 winners today", ar: "جيف-أواي بيوتي يومي · 5 فائزات بس النهاردة" },
  "lucky.title": { en: "Your perfect look — revealed in 30 seconds.", ar: "إطلالتك المثالية — بنكشفها في 30 ثانية." },
  "lucky.subtitle": { en: "Spin. Unlock. Transform.", ar: "لفّي. افتحي. اتغيري." },
  "lucky.startCta": { en: "Start Your Experience", ar: "ابدأي تجربتك" },
  "lucky.urgency": { en: "Only 5 winners today — and the wheel never loses.", ar: "5 فائزات بس النهاردة — والعجلة عمرها ما بتخسر." },
  "lucky.followCta": { en: "Follow @transformegypt for daily bonus chances", ar: "تابعينا @transformegypt لفرص يومية إضافية" },
  "lucky.followShort": { en: "Follow on Instagram", ar: "تابعينا على إنستجرام" },
  "newsletter.success": { en: "You're subscribed — welcome to the list!", ar: "تم الاشتراك — أهلاً بيكي!" },
  "newsletter.error": { en: "Could not subscribe. Please try again.", ar: "حصل خطأ. حاولي تاني." },
  "newsletter.invalid": { en: "Please enter a valid email.", ar: "ادخلي بريد إلكتروني صحيح." },
  "lucky.spotsLeft": { en: "Grand prizes left today", ar: "جوايز كبرى متبقية اليوم" },
  "lucky.totalToday": { en: "Spins today", ar: "سبينات اليوم" },
  "lucky.endsAt": { en: "Resets at midnight", ar: "بيتجدد منتصف الليل" },
  "lucky.stickyCta": { en: "Spin the Wheel", ar: "لفّي العجلة" },
  "lucky.howItWorks": { en: "How it works", ar: "إزاي بتشتغل" },
  "lucky.step1": { en: "Take the personalized beauty quiz", ar: "خدي اختبار البيوتي الشخصي" },
  "lucky.step2": { en: "Get your custom service recommendation", ar: "هتاخدي ترشيح سيرفس مخصوص ليكي" },
  "lucky.step3": { en: "Spin the wheel — every spin wins", ar: "لفّي العجلة — كل لفّة بتكسبي" },
  "lucky.step4": { en: "Redeem instantly via WhatsApp", ar: "استبدلي الجايزة فورًا على الواتساب" },

  "quizP.q1.title": { en: "What's your beauty goal today?", ar: "إيه هدفك بالظبط النهاردة؟" },
  "quizP.q2.title": { en: "Tell me about your hair", ar: "قولّي على شعرك" },
  "quizP.q3.title": { en: "When's your big moment?", ar: "إمتى المناسبة الكبيرة بتاعتك؟" },
  "quizP.q4.title": { en: "What's your beauty vibe?", ar: "إيه الـ vibe اللي يعبّر عنك؟" },
  "quizP.q5.title": { en: "Which branch is closest to you?", ar: "أنهي فرع أقرب ليكي؟" },

  "quizP.goal.hair": { en: "Hair volume & length", ar: "كثافة وطول الشعر" },
  "quizP.goal.lash": { en: "Lash glam", ar: "لاش جلام" },
  "quizP.goal.skin": { en: "Glowing skin", ar: "بشرة جلوينج" },
  "quizP.goal.brows": { en: "Perfect brows", ar: "حواجب برفكت" },
  "quizP.goal.bridal": { en: "Bridal glow", ar: "جلو العروسة" },
  "quizP.goal.makeover": { en: "Total makeover", ar: "ترانسفورميشن كامل" },

  "quizP.hair.fine": { en: "Fine & soft", ar: "ناعم ورفيع" },
  "quizP.hair.medium": { en: "Medium", ar: "متوسط" },
  "quizP.hair.thick": { en: "Thick & dense", ar: "كثيف وقوي" },
  "quizP.hair.curly": { en: "Curly / coily", ar: "كيرلي" },
  "quizP.hair.damaged": { en: "Damaged / over-processed", ar: "تالف / متعالج كتير" },

  "quizP.time.thisweek": { en: "This week", ar: "الأسبوع ده" },
  "quizP.time.thismonth": { en: "This month", ar: "الشهر ده" },
  "quizP.time.fewmonths": { en: "In 2–3 months", ar: "في خلال شهرين أو 3" },
  "quizP.time.exploring": { en: "Just exploring", ar: "بستكشف بس" },

  "quizP.vibe.subtle": { en: "Subtle natural", ar: "ناتشورال هادي" },
  "quizP.vibe.editorial": { en: "Editorial bold", ar: "إديتوريال جريء" },
  "quizP.vibe.celebrity": { en: "Celebrity glam", ar: "جلام النجمات" },
  "quizP.vibe.bridal": { en: "Bridal goddess", ar: "عروسة فاخرة" },

  "quizP.next": { en: "Next", ar: "التالي" },
  "quizP.back": { en: "Back", ar: "رجوع" },
  "quizP.recoTitle": { en: "Your personalized plan", ar: "الخطة المخصوصة ليكي" },
  "quizP.spinNext": { en: "Now spin the wheel", ar: "دلوقتي لفّي العجلة" },

  "spin.unlockTitle": { en: "Unlock your exclusive offer 🎁", ar: "افتحي عرضك الحصري 🎁" },
  "spin.oneStepAway": { en: "You're one step away…", ar: "خطوة واحدة بس وانتي هناك…" },
  "spin.formTitle": { en: "Your details to spin", ar: "بياناتك علشان تلفّي" },
  "spin.formSubtitle": { en: "Used only to redeem your prize on WhatsApp", ar: "بنستخدمها بس علشان تستبدلي جايزتك على الواتساب" },
  "spin.email": { en: "Email (optional)", ar: "إيميل (اختياري)" },
  "spin.emailPlaceholder": { en: "yourname@email.com", ar: "yourname@email.com" },
  "spin.invalidEmail": { en: "Please enter a valid email or leave it blank.", ar: "اكتبي إيميل صحيح أو سيبيه فاضي." },
  "spin.spinNow": { en: "SPIN NOW", ar: "لفّي دلوقتي" },
  "spin.spinning": { en: "Spinning…", ar: "بتلف…" },
  "spin.alreadyPlayed": { en: "You already spun today — here's your prize:", ar: "لفيتي النهاردة بالفعل — دي جايزتك:" },
  "spin.youWon": { en: "You won!", ar: "كسبتي!" },
  "spin.grand": { en: "GRAND PRIZE WINNER!", ar: "جايزة كبرى!" },
  "spin.madeForYou": { en: "This was made for you ✨", ar: "ده اتعمل عشانك ✨" },
  "spin.basedOnAnswers": { en: "Based on your answers, our experts recommend:", ar: "بناءً على إجاباتك، خبيراتنا بيرشحوا:" },
  "spin.code": { en: "Your code", ar: "الكود بتاعك" },
  "spin.redeemWA": { en: "Redeem on WhatsApp", ar: "استبدلي على الواتساب" },
  "spin.bookOnWA": { en: "Book on WhatsApp", ar: "احجزي على الواتساب" },
  "spin.tryAgain": { en: "Try again tomorrow", ar: "جرّبي تاني بكرة" },
  "spin.bookNow": { en: "Book Appointment", ar: "احجزي معاد" },
  "spin.invalidPhone": { en: "Please enter a valid Egyptian mobile (11 digits, starts with 010/011/012/015)", ar: "ادخلي رقم موبايل مصري صحيح (11 رقم، يبدأ بـ 010 / 011 / 012 / 015)" },
  "spin.errorGeneric": { en: "Something went wrong. Please try again.", ar: "حصل خطأ بسيط. جرّبي تاني." },

  // Try-On
  "tryOn.title": { en: "AI Try-On", ar: "جربي AI" },
  "tryOn.subtitle": { en: "See your transformation before you book", ar: "شوفي شكلك قبل ما تحجزي" },
  "tryOn.upload": { en: "Upload Your Photo", ar: "ارفعي صورتك" },
  "tryOn.dragDrop": { en: "Drag & drop here or click to upload", ar: "اسحبي الصورة هنا أو اضغطي لتحميل" },
  "tryOn.choosePhoto": { en: "Choose Photo", ar: "اختري صورة" },
  "tryOn.maxSize": { en: "PNG, JPG — up to 5MB", ar: "PNG, JPG — حتى 5 ميجا" },
  "tryOn.transformation": { en: "Choose Transformation", ar: "اختري الترانسفورميشن" },
  "tryOn.color": { en: "Choose Color", ar: "اختري اللون" },
  "tryOn.length": { en: "Preferred Length", ar: "الطول المفضل" },
  "tryOn.generate": { en: "Generate Magic", ar: "ولّعي السحر" },
  "tryOn.generating": { en: "AI is crafting your transformation...", ar: "الـ AI شغّال على ترانسفورميشنك..." },
  "tryOn.ready": { en: "Your transformation is ready!", ar: "الترانسفورميشن جاهز!" },
  "tryOn.before": { en: "Before", ar: "قبل" },
  "tryOn.after": { en: "After", ar: "بعد" },
  "tryOn.bookExact": { en: "Book This Exact Look", ar: "احجزي ده بالظبط" },
  "tryOn.tryAnother": { en: "Try Another Photo", ar: "جربي صورة تانية" },
  "tryOn.disclaimer": { en: "Result is illustrative. Your actual transformation depends on your hair type.", ar: "النتيجة توضيحية. الترانسفورميشن الحقيقي يعتمد على نوع شعرك." },
  "tryOn.howItWorks": { en: "How It Works", ar: "إزاي بتشتغل" },
  "tryOn.step1": { en: "Upload a clear front-facing photo", ar: "صورة واضحة من قدام وارفعيها" },
  "tryOn.step2": { en: "Pick treatment, color, and length", ar: "اختاري الترانسفورميشن واللون والطول" },
  "tryOn.step3": { en: "AI generates your preview in seconds", ar: "الـ AI يولّع النتيجة في ثواني" },
  "tryOn.readyReal": { en: "Ready for the real transformation?", ar: "جاهزة للترانسفورميشن الحقيقي؟" },
  "tryOn.consultDesc": { en: "Book a free consultation and our experts will help you choose", ar: "احجزي كونسلتيشن مجانية وخبيراتنا يساعدوكي" },
  "tryOn.error": { en: "Something went wrong", ar: "حصل خطأ" },
  "tryOn.retry": { en: "Go Back & Retry", ar: "رجعي و حاولي تاني" },

  // Common
  "common.loading": { en: "Loading...", ar: "ثانية واحدة..." },
  "common.error": { en: "An error occurred", ar: "حصل خطأ" },
  "common.bookNow": { en: "Book Now", ar: "احجزي دلوقتي" },
  "common.learnMore": { en: "Learn More", ar: "اعرفي أكتر" },
  "common.viewAll": { en: "View All", ar: "شوفي الكل" },
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'ar' : 'en');
  };

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][lang];
    }
    return key;
  };

  return (
    <I18nContext.Provider value={{ lang, toggleLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
