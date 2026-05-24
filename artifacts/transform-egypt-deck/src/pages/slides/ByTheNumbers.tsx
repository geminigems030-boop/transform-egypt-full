export default function ByTheNumbers() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body px-[8vw] py-[10vh] flex flex-col justify-between">
      <div className="absolute top-[10vh] left-[40vw] w-[20vw] h-[20vw] bg-primary/5 blur-[6vw] rounded-full pointer-events-none" />

      <div>
        <p className="text-[1vw] tracking-[0.4em] text-primary uppercase mb-[2vh]">
          The Scale
        </p>
        <h2 className="font-display text-[4.5vw] leading-[1] text-ivory font-bold">
          By the <span className="italic text-primary">numbers</span>.
        </h2>
      </div>

      <div className="grid grid-cols-4 gap-[2vw] relative z-10">
        <div>
          <p className="font-display text-[8vw] text-primary font-bold leading-none mb-[2vh]">20+</p>
          <p className="text-[1.1vw] tracking-[0.2em] text-ivory uppercase mb-[0.8vh]">Years</p>
          <p className="text-[1.1vw] text-ivory/55 font-light">Of beauty mastery in Egypt</p>
        </div>

        <div>
          <p className="font-display text-[8vw] text-primary font-bold leading-none mb-[2vh]">6</p>
          <p className="text-[1.1vw] tracking-[0.2em] text-ivory uppercase mb-[0.8vh]">Locations</p>
          <p className="text-[1.1vw] text-ivory/55 font-light">Across Cairo and the coast</p>
        </div>

        <div>
          <p className="font-display text-[8vw] text-primary font-bold leading-none mb-[2vh]">20+</p>
          <p className="text-[1.1vw] tracking-[0.2em] text-ivory uppercase mb-[0.8vh]">Treatments</p>
          <p className="text-[1.1vw] text-ivory/55 font-light">From extensions to skincare</p>
        </div>

        <div>
          <p className="font-display text-[8vw] text-primary font-bold leading-none mb-[2vh]">10K</p>
          <p className="text-[1.1vw] tracking-[0.2em] text-ivory uppercase mb-[0.8vh]">Clients</p>
          <p className="text-[1.1vw] text-ivory/55 font-light">Including regional celebrities</p>
        </div>
      </div>

      <div className="flex items-center gap-[1.5vw]">
        <span className="block w-[6vw] h-[1px] bg-primary" />
        <span className="text-[0.9vw] tracking-[0.4em] text-ivory/50 uppercase">
          Figures reflect TransforM Egypt across all branches
        </span>
      </div>
    </div>
  );
}
