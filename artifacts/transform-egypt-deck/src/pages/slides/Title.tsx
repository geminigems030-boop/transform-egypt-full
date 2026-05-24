import heroInterior from '@assets/CTA_luxury_salon_interior__1774666489143.jpg';

const base = import.meta.env.BASE_URL;

export default function Title() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body">
      <img
        src={heroInterior}
        crossOrigin="anonymous"
        alt="TransforM Egypt luxury salon interior"
        className="absolute inset-0 w-full h-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/40" />

      <div className="relative h-full w-full px-[8vw] py-[8vh] flex flex-col justify-between">
        <div className="flex items-center gap-[1.2vw]">
          <img
            src={`${base}logo-t.png`}
            crossOrigin="anonymous"
            alt="TransforM Logo"
            className="h-[5vh] w-[5vh] object-contain"
          />
          <span className="font-display text-[1.6vw] tracking-[0.3em] text-ivory uppercase">
            TransforM
          </span>
        </div>

        <div className="max-w-[60vw]">
          <p className="font-display italic text-primary text-[1.6vw] tracking-wide mb-[2vh]">
            A new you, Today.
          </p>
          <h1 className="font-display text-[7vw] leading-[0.95] text-ivory font-bold tracking-tight" style={{ textWrap: 'balance' as const }}>
            Egypt&rsquo;s house of <span className="italic text-primary">transformation</span>.
          </h1>
          <p className="mt-[3vh] text-[1.5vw] text-ivory/70 max-w-[40vw] font-light leading-relaxed">
            Premium hair extensions, lashes, microblading and skincare — crafted for the modern Egyptian woman.
          </p>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex items-center gap-[1.5vw]">
            <span className="block w-[6vw] h-[1px] bg-primary" />
            <span className="text-[1vw] tracking-[0.4em] text-ivory/60 uppercase">
              Brand Overview · 2026
            </span>
          </div>
          <span className="text-[1vw] tracking-[0.3em] text-ivory/50 uppercase">
            transform-egypt.com
          </span>
        </div>
      </div>
    </div>
  );
}
