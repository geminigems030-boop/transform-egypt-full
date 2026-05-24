export default function Locations() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body px-[8vw] py-[8vh] flex flex-col">
      <div className="flex items-end justify-between mb-[6vh]">
        <div>
          <p className="text-[1vw] tracking-[0.4em] text-primary uppercase mb-[2vh]">
            The Addresses
          </p>
          <h2 className="font-display text-[4.5vw] leading-[1] text-ivory font-bold">
            Six prime <span className="italic text-primary">locations</span>.
          </h2>
        </div>
        <p className="text-[1.2vw] text-ivory/60 font-light max-w-[24vw] text-right">
          Inside Cairo&rsquo;s most prestigious malls and hotels.
        </p>
      </div>

      <div className="grid grid-cols-3 grid-rows-2 gap-x-[3vw] gap-y-[5vh] flex-1 content-center">
        <div className="border-l border-primary/40 pl-[1.5vw]">
          <p className="text-[0.9vw] tracking-[0.3em] text-primary/80 uppercase mb-[1vh]">Heliopolis</p>
          <h3 className="font-display text-[2vw] text-ivory leading-tight mb-[0.8vh]">City Stars Mall</h3>
          <p className="text-[1.1vw] text-ivory/55 font-light">Ground floor, Gate 7</p>
        </div>

        <div className="border-l border-primary/40 pl-[1.5vw]">
          <p className="text-[0.9vw] tracking-[0.3em] text-primary/80 uppercase mb-[1vh]">New Cairo</p>
          <h3 className="font-display text-[2vw] text-ivory leading-tight mb-[0.8vh]">Cairo Festival City</h3>
          <p className="text-[1.1vw] text-ivory/55 font-light">3rd floor</p>
        </div>

        <div className="border-l border-primary/40 pl-[1.5vw]">
          <p className="text-[0.9vw] tracking-[0.3em] text-primary/80 uppercase mb-[1vh]">Downtown</p>
          <h3 className="font-display text-[2vw] text-ivory leading-tight mb-[0.8vh]">Sofitel Downtown</h3>
          <p className="text-[1.1vw] text-ivory/55 font-light">Lower level salon</p>
        </div>

        <div className="border-l border-primary/40 pl-[1.5vw]">
          <p className="text-[0.9vw] tracking-[0.3em] text-primary/80 uppercase mb-[1vh]">Garden City</p>
          <h3 className="font-display text-[2vw] text-ivory leading-tight mb-[0.8vh]">Nile Ritz-Carlton</h3>
          <p className="text-[1.1vw] text-ivory/55 font-light">1st floor</p>
        </div>

        <div className="border-l border-primary/40 pl-[1.5vw]">
          <p className="text-[0.9vw] tracking-[0.3em] text-primary/80 uppercase mb-[1vh]">Sheikh Zayed</p>
          <h3 className="font-display text-[2vw] text-ivory leading-tight mb-[0.8vh]">Walk of Cairo</h3>
          <p className="text-[1.1vw] text-ivory/55 font-light">Ground floor</p>
        </div>

        <div className="border-l border-primary/40 pl-[1.5vw]">
          <p className="text-[0.9vw] tracking-[0.3em] text-primary/80 uppercase mb-[1vh]">North Coast</p>
          <h3 className="font-display text-[2vw] text-ivory leading-tight mb-[0.8vh]">O Mall, New Alamein</h3>
          <p className="text-[1.1vw] text-ivory/55 font-light">Seasonal flagship</p>
        </div>
      </div>
    </div>
  );
}
