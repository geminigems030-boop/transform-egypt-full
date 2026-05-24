import React, { useEffect } from 'react';
import { Layout } from "@/components/Layout";

export default function Terms() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="font-serif text-4xl text-white mb-2">Terms of Service</h1>
          <p className="text-gray-500 text-sm mb-10">Last updated: May 2025</p>

          <div className="prose prose-invert max-w-none space-y-8 text-gray-300 leading-relaxed">

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">1. Acceptance of Terms</h2>
              <p>By accessing <a href="https://transform-egypt.com" className="text-gold hover:underline">transform-egypt.com</a> or booking any service with TransforM Egypt, you agree to these terms. If you do not agree, please do not use our services.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">2. Services</h2>
              <p>TransforM Egypt provides luxury beauty services including hair extensions, lash extensions, microblading, skincare, nails, and bridal packages at our locations in Cairo and New Alamein. Service availability, pricing, and personnel are subject to change without notice.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">3. Appointments & Cancellations</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Appointments must be cancelled or rescheduled at least <strong className="text-white">24 hours</strong> in advance.</li>
                <li>Late cancellations or no-shows may incur a fee equivalent to 25% of the booked service value.</li>
                <li>Bridal and VIP bookings require a non-refundable deposit to secure the date.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">4. Payments</h2>
              <p>We accept cash, Visa, Mastercard, and bank transfer. All prices are in Egyptian Pounds (EGP) and include applicable taxes. Boutique orders are subject to additional shipping and handling fees.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">5. Refunds & Returns</h2>
              <p>Services rendered are non-refundable. For boutique product purchases, unused items in original packaging may be returned within 7 days of receipt. Hair extensions that have been opened, fitted, or chemically treated cannot be returned for hygiene reasons.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">6. Aftercare Responsibility</h2>
              <p>Clients are responsible for following all aftercare instructions provided by their stylist. TransforM Egypt is not liable for damage resulting from improper home care, use of non-approved products, or failure to attend scheduled maintenance appointments.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">7. Promotions & Lucky Spin</h2>
              <p>Promotional prizes and Lucky Spin rewards are non-transferable, have no cash value, and must be redeemed within 30 days of winning unless otherwise stated. TransforM Egypt reserves the right to modify or discontinue any promotion at any time.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">8. Intellectual Property</h2>
              <p>All content on this website — including photographs, videos, branding, and written content — is owned by TransforM Egypt and may not be reproduced without written permission.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">9. Limitation of Liability</h2>
              <p>TransforM Egypt's liability for any claim arising from use of this website or our services shall not exceed the amount paid for the specific service in question.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">10. Governing Law</h2>
              <p>These terms are governed by the laws of the Arab Republic of Egypt. Any disputes shall be subject to the exclusive jurisdiction of Egyptian courts.</p>
            </section>

            <section>
              <h2 className="text-white font-serif text-2xl mb-3">11. Contact</h2>
              <p>Questions about these terms? Email <a href="mailto:customersupport@transform-egypt.com" className="text-gold hover:underline">customersupport@transform-egypt.com</a> or call <a href="tel:+201009780008" className="text-gold hover:underline">+20 100 978 0008</a>.</p>
            </section>

          </div>
        </div>
      </div>
    </Layout>
  );
}
