import founder from '@assets/Founder_Mervat_Atalla__1774666489143.PNG';

export default function Founder() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body flex">
      <div className="w-[45vw] h-full relative">
        <img
          src={founder}
          crossOrigin="anonymous"
          alt="Mervat Atalla, founder of TransforM Egypt"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-bg/40" />
      </div>

      <div className="flex-1 h-full px-[6vw] py-[10vh] flex flex-col justify-center">
        <p className="text-[1vw] tracking-[0.4em] text-primary uppercase mb-[3vh]">
          The Founder
        </p>
        <h2 className="font-display text-[5vw] leading-[1] text-ivory font-bold mb-[2vh]" style={{ textWrap: 'balance' as const }}>
          Mervat <span className="italic text-primary">Atalla</span>
        </h2>
        <span className="block w-[6vw] h-[2px] bg-primary mb-[4vh]" />

        <p className="text-[1.6vw] text-ivory/85 font-light leading-relaxed mb-[3vh] max-w-[40vw]" style={{ textWrap: 'pretty' as const }}>
          A pioneer of luxury beauty in Egypt for over two decades, Mervat built TransforM from a single chair into the country&rsquo;s most trusted destination for hair extensions and beauty artistry.
        </p>
        <p className="text-[1.4vw] text-ivory/65 font-light leading-relaxed max-w-[38vw]" style={{ textWrap: 'pretty' as const }}>
          Her standard is simple: every client leaves looking — and feeling — entirely new.
        </p>
      </div>
    </div>
  );
}
