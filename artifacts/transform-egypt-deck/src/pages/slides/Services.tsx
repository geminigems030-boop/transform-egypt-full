import hairExt from '@assets/Hair_extensions_Display__1774666730978.PNG';
import hairTreat from '@assets/_Exclusively_Available_Hair_Treatments__1774666730978.PNG';
import clients from '@assets/Clients_Checking_Various_Hair_Extensions_options__1774666730978.jpg';

export default function Services() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body px-[6vw] py-[8vh] flex flex-col">
      <div className="flex items-end justify-between mb-[6vh]">
        <div>
          <p className="text-[1vw] tracking-[0.4em] text-primary uppercase mb-[2vh]">
            The Menu
          </p>
          <h2 className="font-display text-[4.5vw] leading-[1] text-ivory font-bold">
            Signature <span className="italic text-primary">services</span>.
          </h2>
        </div>
        <p className="text-[1.2vw] text-ivory/60 font-light max-w-[22vw] text-right">
          Twenty-plus treatments across hair, lashes, brows and skin.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-[2vw] flex-1">
        <div className="flex flex-col">
          <div className="h-[40vh] overflow-hidden mb-[2.5vh] relative">
            <img src={hairExt} crossOrigin="anonymous" alt="Hair extensions" className="w-full h-full object-cover" />
          </div>
          <p className="text-[0.9vw] tracking-[0.3em] text-primary uppercase mb-[1vh]">01 — Hair</p>
          <h3 className="font-display text-[2.2vw] text-ivory mb-[1.5vh] leading-tight">Hair Extensions</h3>
          <p className="text-[1.2vw] text-ivory/65 font-light leading-relaxed">
            Russian, Indian, Brazilian, Turkish and tape-in extensions. Color-matched and custom-fitted.
          </p>
        </div>

        <div className="flex flex-col">
          <div className="h-[40vh] overflow-hidden mb-[2.5vh] relative">
            <img src={clients} crossOrigin="anonymous" alt="Lash and brow services" className="w-full h-full object-cover" />
          </div>
          <p className="text-[0.9vw] tracking-[0.3em] text-primary uppercase mb-[1vh]">02 — Beauty</p>
          <h3 className="font-display text-[2.2vw] text-ivory mb-[1.5vh] leading-tight">Lashes & Brows</h3>
          <p className="text-[1.2vw] text-ivory/65 font-light leading-relaxed">
            Classic, volume and mega-volume lashes. Microblading, lip blushing and brow extensions.
          </p>
        </div>

        <div className="flex flex-col">
          <div className="h-[40vh] overflow-hidden mb-[2.5vh] relative">
            <img src={hairTreat} crossOrigin="anonymous" alt="Skin and hair treatments" className="w-full h-full object-cover" />
          </div>
          <p className="text-[0.9vw] tracking-[0.3em] text-primary uppercase mb-[1vh]">03 — Skin</p>
          <h3 className="font-display text-[2.2vw] text-ivory mb-[1.5vh] leading-tight">Skin & Treatments</h3>
          <p className="text-[1.2vw] text-ivory/65 font-light leading-relaxed">
            Facials, dermapen, exclusive hair treatments and bridal packages curated for every occasion.
          </p>
        </div>
      </div>
    </div>
  );
}
