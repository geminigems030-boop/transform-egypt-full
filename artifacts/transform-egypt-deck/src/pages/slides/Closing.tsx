const base = import.meta.env.BASE_URL;

export default function Closing() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body px-[8vw] py-[10vh] flex flex-col justify-between">
      <div className="absolute top-[20vh] right-[10vw] w-[25vw] h-[25vw] bg-primary/5 blur-[8vw] rounded-full pointer-events-none" />

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

      <div className="relative z-10 max-w-[70vw]">
        <p className="font-display italic text-primary text-[1.6vw] tracking-wide mb-[3vh]">
          A new you, Today.
        </p>
        <h2 className="font-display text-[7vw] leading-[0.95] text-ivory font-bold tracking-tight" style={{ textWrap: 'balance' as const }}>
          Become the next <span className="italic text-primary">transformation</span>.
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-[3vw] relative z-10 border-t border-primary/30 pt-[4vh]">
        <div>
          <p className="text-[0.9vw] tracking-[0.3em] text-primary uppercase mb-[1vh]">Online</p>
          <p className="text-[1.4vw] text-ivory font-light">transform-egypt.com</p>
          <p className="text-[1.1vw] text-ivory/55 font-light">@transformegypt</p>
        </div>

        <div>
          <p className="text-[0.9vw] tracking-[0.3em] text-primary uppercase mb-[1vh]">Direct</p>
          <p className="text-[1.4vw] text-ivory font-light">01009 780 008</p>
          <p className="text-[1.1vw] text-ivory/55 font-light">01004 545 700</p>
        </div>

        <div>
          <p className="text-[0.9vw] tracking-[0.3em] text-primary uppercase mb-[1vh]">Hours</p>
          <p className="text-[1.4vw] text-ivory font-light">Daily, 10am – 10pm</p>
          <p className="text-[1.1vw] text-ivory/55 font-light">By appointment</p>
        </div>
      </div>
    </div>
  );
}
