import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Sorunu paylaş",
    detail: "Takıldığın dersi ve konuyu seç, sorunu topluluğa aç.",
  },
  {
    number: "02",
    title: "Birlikte açıkla",
    detail: "Farklı anlatımları gör, kendi bildiklerini de ekle.",
  },
  {
    number: "03",
    title: "Faydalıyı öne çıkar",
    detail: "İşe yarayan yanıtlara oy ver, daha çok kişiye ulaşsın.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_50%_0%,_rgba(8,145,178,0.17),_transparent_45%),#070b14] px-4 pt-10 pb-28 text-slate-100 sm:px-6 sm:pt-16">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/70 px-6 py-12 shadow-2xl shadow-black/30 sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-cyan-300" /> Öğrenmek paylaşınca güzelleşir
            </p>
            <h1 className="mt-7 text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
              Anlamadığını sor.<br className="hidden sm:block" /> Bildiğini anlat.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Derslerde takıldığın yerde yalnız değilsin. Sorunu paylaş, farklı anlatımları keşfet ve öğrendiklerini başkalarına aktar.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/giris" className="rounded-xl bg-cyan-300 px-6 py-3.5 font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-200">
                Hemen katıl <span aria-hidden="true">→</span>
              </Link>
              <Link href="#nasil-calisir" className="rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 font-semibold text-white transition hover:bg-white/10">
                Nasıl çalışır?
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">Ücretsiz katıl · Takma adınla kullan · Birlikte öğren</p>
          </div>
        </section>

        <section id="nasil-calisir" className="mt-6 grid scroll-mt-24 gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.number} className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 transition hover:-translate-y-1 hover:border-cyan-300/25">
              <span className="text-sm font-bold tracking-widest text-cyan-300">{feature.number}</span>
              <h2 className="mt-4 text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{feature.detail}</p>
            </article>
          ))}
        </section>

        <footer className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center">
          <p>Knowledge — merak edenler için bir topluluk.</p>
          <Link href="/giris" className="font-medium text-cyan-200 hover:text-cyan-100">Topluluğa göz at →</Link>
        </footer>
      </div>
    </main>
  );
}
