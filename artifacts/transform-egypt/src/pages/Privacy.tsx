import React, { useEffect } from 'react';
import { Layout } from "@/components/Layout";

export default function Privacy() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="font-serif text-4xl text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm mb-10">Last updated: May 2025</p>

          <div className="prose prose-invert prose-gold max-w-none space-y-8 text-gray-300 leading-relaxed">

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">1. Who We Are</h2>
              <p>TransforM Egypt ("we", "us", "our") operates the luxury beauty salon platform at <a href="https://transform-egypt.com" className="text-gold hover:underline">transform-egypt.com</a>. Our registered contact email is <a href="mailto:customersupport@transform-egypt.com" className="text-gold hover:underline">customersupport@transform-egypt.com</a>.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">2. Information We Collect</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Contact information</strong> — name, phone number, and email when you book an appointment or submit a form.</li>
                <li><strong className="text-white">Instagram / Facebook messages</strong> — when you message our business account, we receive and store that conversation to follow up with you.</li>
                <li><strong className="text-white">Usage data</strong> — pages visited, time on site, and general location (country/city) via Google Analytics.</li>
                <li><strong className="text-white">Lucky Spin entries</strong> — phone number and spin result when you participate in a promotion.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>To confirm and manage your appointments.</li>
                <li>To follow up on enquiries sent via social media or the website.</li>
                <li>To send promotional messages you have opted into (WhatsApp / email campaigns).</li>
                <li>To improve our website and services using anonymised analytics.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">4. Data Sharing</h2>
              <p>We do not sell your personal data. We share information only with:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong className="text-white">Meta Platforms (Facebook / Instagram)</strong> — for message delivery and advertising.</li>
                <li><strong className="text-white">Google</strong> — for analytics (Google Analytics 4) and advertising (Google Ads).</li>
                <li><strong className="text-white">ManyChat</strong> — for automated messaging flows.</li>
                <li><strong className="text-white">Resend</strong> — for transactional email delivery.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">5. Data Retention</h2>
              <p>We retain contact and booking information for up to 3 years to maintain client history. You may request deletion at any time by contacting us.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">6. Your Rights</h2>
              <p>You have the right to access, correct, or delete your personal data. To exercise any of these rights, contact us at <a href="mailto:customersupport@transform-egypt.com" className="text-gold hover:underline">customersupport@transform-egypt.com</a>.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">7. Cookies</h2>
              <p>We use cookies for analytics (Google Analytics) and advertising (Meta Pixel). You can disable cookies in your browser settings at any time.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">8. Contact</h2>
              <p>For privacy-related questions, email us at <a href="mailto:customersupport@transform-egypt.com" className="text-gold hover:underline">customersupport@transform-egypt.com</a> or call <a href="tel:+201009780008" className="text-gold hover:underline">+20 100 978 0008</a>.</p>
            </section>

          </div>
        </div>
      </div>
    </Layout>
  );
}
