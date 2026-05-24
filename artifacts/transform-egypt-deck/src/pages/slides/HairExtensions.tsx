import treatments from '@assets/Hair_treatments__1774666730979.JPG';

export default function HairExtensions() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body flex">
      <div className="w-[50vw] h-full px-[6vw] py-[10vh] flex flex-col justify-center">
        <p className="text-[1vw] tracking-[0.4em] text-primary uppercase mb-[3vh]">
          The Specialty
        </p>
        <h2 className="font-display text-[5.5vw] leading-[0.95] text-ivory font-bold mb-[3vh]" style={{ textWrap: 'balance' as const }}>
          The hair <span className="italic text-primary">capital</span> of Cairo.
        </h2>
        <span className="block w-[6vw] h-[2px] bg-primary mb-[4vh]" />

        <div className="grid grid-cols-2 gap-y-[3vh] gap-x-[2vw] max-w-[36vw]">
          <div>
            <p className="font-display text-[2vw] text-primary mb-[0.5vh]">Russian</p>
            <p className="text-[1.1vw] text-ivory/60 font-light">Slavic, single-donor</p>
          </div>
          <div>
            <p className="font-display text-[2vw] text-primary mb-[0.5vh]">Indian</p>
            <p className="text-[1.1vw] text-ivory/60 font-light">Temple-grade Remy</p>
          </div>
          <div>
            <p className="font-display text-[2vw] text-primary mb-[0.5vh]">Brazilian</p>
            <p className="text-[1.1vw] text-ivory/60 font-light">Wave & body texture</p>
          </div>
          <div>
            <p className="font-display text-[2vw] text-primary mb-[0.5vh]">Tape-In</p>
            <p className="text-[1.1vw] text-ivory/60 font-light">Discreet, reusable</p>
          </div>
        </div>
      </div>

      <div className="flex-1 h-full relative">
        <img
          src={treatments}
          crossOrigin="anonymous"
          alt="TransforM hair treatments"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-bg/30" />
      </div>
    </div>
  );
}
