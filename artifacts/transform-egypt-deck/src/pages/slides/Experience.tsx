import interior from '@assets/CTA_luxury_salon_interior__1774666489143.jpg';

export default function Experience() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body">
      <img
        src={interior}
        crossOrigin="anonymous"
        alt="TransforM private suite interior"
        className="absolute inset-0 w-full h-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-bg via-bg/70 to-bg/30" />

      <div className="relative h-full w-full px-[10vw] py-[12vh] flex flex-col justify-center">
        <p className="text-[1vw] tracking-[0.4em] text-primary uppercase mb-[4vh]">
          The Experience
        </p>

        <p className="font-display text-[5vw] text-ivory font-light italic leading-[1.1] mb-[5vh] max-w-[70vw]" style={{ textWrap: 'balance' as const }}>
          &ldquo;Every chair is private. Every hour is yours. Every transformation is signed by hand.&rdquo;
        </p>

        <div className="flex items-center gap-[1.5vw]">
          <span className="block w-[5vw] h-[1px] bg-primary" />
          <span className="text-[1.1vw] tracking-[0.3em] text-primary uppercase">
            The TransforM standard
          </span>
        </div>
      </div>
    </div>
  );
}
