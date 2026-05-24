export default function Promise() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body px-[8vw] py-[10vh] flex flex-col justify-between">
      <div className="absolute top-0 right-0 w-[30vw] h-[30vw] bg-primary/5 blur-[8vw] rounded-full pointer-events-none" />

      <div>
        <p className="text-[1vw] tracking-[0.4em] text-primary uppercase mb-[3vh]">
          The Promise
        </p>
        <h2 className="font-display text-[5vw] leading-[1] text-ivory font-bold max-w-[60vw]" style={{ textWrap: 'balance' as const }}>
          Beauty without compromise.
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-[3vw] relative z-10">
        <div>
          <p className="font-display text-[5vw] text-primary font-bold leading-none mb-[2vh]">01</p>
          <h3 className="font-display text-[2vw] text-ivory mb-[1.5vh]">Premium materials</h3>
          <p className="text-[1.3vw] text-ivory/65 font-light leading-relaxed">
            Russian, Indian, Brazilian and Turkish hair sourced and inspected at origin.
          </p>
        </div>

        <div>
          <p className="font-display text-[5vw] text-primary font-bold leading-none mb-[2vh]">02</p>
          <h3 className="font-display text-[2vw] text-ivory mb-[1.5vh]">Master artistry</h3>
          <p className="text-[1.3vw] text-ivory/65 font-light leading-relaxed">
            Stylists trained to international standards in extensions, lashes and microblading.
          </p>
        </div>

        <div>
          <p className="font-display text-[5vw] text-primary font-bold leading-none mb-[2vh]">03</p>
          <h3 className="font-display text-[2vw] text-ivory mb-[1.5vh]">Discreet luxury</h3>
          <p className="text-[1.3vw] text-ivory/65 font-light leading-relaxed">
            Private suites inside Egypt&rsquo;s finest hotels and malls. Booked by appointment.
          </p>
        </div>
      </div>
    </div>
  );
}
