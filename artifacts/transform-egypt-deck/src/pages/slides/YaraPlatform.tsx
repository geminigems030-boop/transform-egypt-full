export default function YaraPlatform() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-body px-[8vw] py-[9vh] flex flex-col justify-between">
      {/* Ambient glow */}
      <div className="absolute top-[15vh] right-[8vw] w-[28vw] h-[28vw] bg-primary/6 blur-[7vw] rounded-full pointer-events-none" />
      <div className="absolute bottom-[10vh] left-[30vw] w-[18vw] h-[18vw] bg-primary/4 blur-[6vw] rounded-full pointer-events-none" />

      {/* Heading */}
      <div>
        <p className="text-[1vw] tracking-[0.4em] text-primary uppercase mb-[2vh]">
          Technology
        </p>
        <h2 className="font-display text-[4.5vw] leading-[1] text-ivory font-bold">
          Powered by <span className="italic text-primary">Yara AI</span>.
        </h2>
        <p className="mt-[1.5vh] text-[1.4vw] text-ivory/55 font-light max-w-[48vw]">
          A full AI platform built into every touchpoint — voice, chat, WhatsApp, and CRM — running 24 / 7 so the team never misses a client.
        </p>
      </div>

      {/* Feature grid — 2 × 2 */}
      <div className="grid grid-cols-2 gap-[2vw] relative z-10 flex-1 mt-[4vh] mb-[3vh]">

        {/* Voice Call */}
        <div className="border border-primary/20 bg-primary/4 px-[2.5vw] py-[2.8vh] flex flex-col justify-between" style={{ backdropFilter: 'blur(8px)' }}>
          <div>
            <p className="text-[2.8vw] font-display font-bold text-primary leading-none mb-[1.5vh]">01</p>
            <p className="text-[1.5vw] text-ivory font-semibold tracking-wide mb-[1vh]">Yara Voice Call</p>
            <p className="text-[1.1vw] text-ivory/55 font-light leading-relaxed">
              Clients call Yara directly from the website — live AI voice conversation, no phone number required. Books appointments, answers questions, speaks Arabic and English.
            </p>
          </div>
          <div className="mt-[2vh] flex items-center gap-[1vw]">
            <span className="block w-[2vw] h-[1px] bg-primary/50" />
            <span className="text-[0.9vw] tracking-[0.25em] text-primary/70 uppercase">ElevenLabs · WebRTC</span>
          </div>
        </div>

        {/* Chat Widget */}
        <div className="border border-white/10 bg-white/3 px-[2.5vw] py-[2.8vh] flex flex-col justify-between">
          <div>
            <p className="text-[2.8vw] font-display font-bold text-primary leading-none mb-[1.5vh]">02</p>
            <p className="text-[1.5vw] text-ivory font-semibold tracking-wide mb-[1vh]">Yara Chat Widget</p>
            <p className="text-[1.1vw] text-ivory/55 font-light leading-relaxed">
              AI text chat on every page, bilingual EN / AR. Captures phone numbers, detects escalations, notifies the team instantly, and hands off to WhatsApp seamlessly.
            </p>
          </div>
          <div className="mt-[2vh] flex items-center gap-[1vw]">
            <span className="block w-[2vw] h-[1px] bg-primary/50" />
            <span className="text-[0.9vw] tracking-[0.25em] text-primary/70 uppercase">Claude · Anthropic</span>
          </div>
        </div>

        {/* WhatsApp Automation */}
        <div className="border border-white/10 bg-white/3 px-[2.5vw] py-[2.8vh] flex flex-col justify-between">
          <div>
            <p className="text-[2.8vw] font-display font-bold text-primary leading-none mb-[1.5vh]">03</p>
            <p className="text-[1.5vw] text-ivory font-semibold tracking-wide mb-[1vh]">WhatsApp Automation</p>
            <p className="text-[1.1vw] text-ivory/55 font-light leading-relaxed">
              Appointment reminders, escalation alerts, new-lead pings — all sent automatically via Meta's free Cloud API. Team members choose exactly which events reach their phone.
            </p>
          </div>
          <div className="mt-[2vh] flex items-center gap-[1vw]">
            <span className="block w-[2vw] h-[1px] bg-primary/50" />
            <span className="text-[0.9vw] tracking-[0.25em] text-primary/70 uppercase">Meta Cloud API · Free</span>
          </div>
        </div>

        {/* CRM */}
        <div className="border border-white/10 bg-white/3 px-[2.5vw] py-[2.8vh] flex flex-col justify-between">
          <div>
            <p className="text-[2.8vw] font-display font-bold text-primary leading-none mb-[1.5vh]">04</p>
            <p className="text-[1.5vw] text-ivory font-semibold tracking-wide mb-[1vh]">Client CRM</p>
            <p className="text-[1.1vw] text-ivory/55 font-light leading-relaxed">
              Full client database with appointment history, CSV import, and status tracking. Every booking, call, and chat tied back to the client record automatically.
            </p>
          </div>
          <div className="mt-[2vh] flex items-center gap-[1vw]">
            <span className="block w-[2vw] h-[1px] bg-primary/50" />
            <span className="text-[0.9vw] tracking-[0.25em] text-primary/70 uppercase">PostgreSQL · Admin Panel</span>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="flex items-center gap-[1.5vw]">
        <span className="block w-[6vw] h-[1px] bg-primary" />
        <span className="text-[0.9vw] tracking-[0.4em] text-ivory/50 uppercase">
          All systems live at transform-egypt.com
        </span>
      </div>
    </div>
  );
}
