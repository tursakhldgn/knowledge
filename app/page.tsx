import Link from "next/link";

const subjects = [
  { name: "Matematik", detail: "Fonksiyonlar, geometri, problemler", mark: "∑", tone: "from-cyan-400/20 to-sky-500/5" },
  { name: "Fen Bilimleri", detail: "Fizik, kimya, biyoloji", mark: "⚛", tone: "from-violet-400/20 to-indigo-500/5" },
  { name: "Türkçe", detail: "Dil bilgisi, paragraf, edebiyat", mark: "Aa", tone: "from-amber-300/20 to-orange-500/5" },
  { name: "Sosyal Bilgiler", detail: "Tarih, coğrafya, vatandaşlık", mark: "◉", tone: "from-emerald-300/20 to-teal-500/5" },
];

const steps = [
  { number: "01", title: "Sorunu paylaş", detail: "Dersini ve konunu seç, takıldığın noktayı anlat." },
  { number: "02", title: "Birlikte öğren", detail: "Topluluktan gelen farklı açıklamaları keşfet." },
  { number: "03", title: "Katkı sun", detail: "Bildiğini paylaş, faydalı anlatımları öne çıkar." },
];

export default function Home() {
  return (
    <main data-app-theme="light" className="min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_50%_0%,_rgba(8,145,178,0.14),_transparent_42%),#070b14] px-4 pb-28 pt-8 text-slate-100 sm:px-6 sm:pt-12">
      <div className="mx-auto w-full max-w-7xl">
        <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-[#0b1424] to-cyan-950/60 shadow-2xl shadow-black/30">
          <div className="pointer-events-none absolute -right-24 -top-32 -z-10 h-96 w-96 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="grid items-center gap-12 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-16 lg:py-20">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />
                Öğrenmek paylaşınca güzelleşir
              </p>
              <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Anlamadığını sor.<br />
                <span className="bg-gradient-to-r from-cyan-200 to-sky-400 bg-clip-text text-transparent">Bildiğini anlat.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                Derslerde takıldığın yerde yalnız değilsin. Sorunu paylaş, arkadaşlarının anlatımlarından öğren ve bildiklerinle başkalarına yardımcı ol.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/giris" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3.5 font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-200">
                  Topluluğa katıl <span aria-hidden="true">→</span>
                </Link>
                <Link href="#konular" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 font-semibold text-white transition hover:border-white/25 hover:bg-white/10">
                  Konuları keşfet
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-2"><span className="text-cyan-300">✓</span> Ücretsiz katılım</span>
                <span className="inline-flex items-center gap-2"><span className="text-cyan-300">✓</span> Takma adınla kullan</span>
                <span className="inline-flex items-center gap-2"><span className="text-cyan-300">✓</span> Birlikte öğren</span>
              </div>
            </div>

            <div className="mx-auto w-full max-w-md lg:ml-auto">
              <div className="mb-3 flex items-center justify-between px-1 text-xs font-medium text-slate-400">
                <span>Knowledge akışından</span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-emerald-200">Örnek soru</span>
              </div>
              <article className="rounded-2xl border border-white/10 bg-slate-950/75 p-5 shadow-xl shadow-black/20 backdrop-blur sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 text-sm font-bold text-slate-950">K</div>
                    <div>
                      <p className="text-sm font-semibold">merakli_ogrenci</p>
                      <p className="mt-0.5 text-xs text-slate-500">Matematik · Fonksiyonlar</p>
                    </div>
                  </div>
                  <span className="rounded-lg border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200">Soru</span>
                </div>
                <h2 className="mt-5 text-lg font-semibold leading-7">Bileşke fonksiyonun mantığını örnekle anlatabilir misiniz?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Formülü ezberliyorum ama hangi sırayla uyguladığımı karıştırıyorum.</p>
                <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-300">Birlikte açıklayalım</p>
                    <span className="text-xs text-slate-500">Topluluk yanıtı</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Önce içteki fonksiyon çalışır; çıkan sonucu dıştaki fonksiyona verirsin. İç içe iki adım gibi düşünebilirsin.</p>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-2"><span className="text-amber-300">★</span> Faydalı anlatım</span>
                  <span>Bilgi paylaş, birlikte ilerle</span>
                </div>
              </article>
              <p className="mt-3 text-center text-[11px] text-slate-500">Bu kart, toplulukta neler bulabileceğine dair örnektir.</p>
            </div>
          </div>
        </section>

        <section id="konular" className="scroll-mt-24 pt-16 sm:pt-20">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Merak ettiğin yerden başla</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Birlikte çalışılan konular</h2>
            </div>
            <Link href="/giris" className="text-sm font-semibold text-cyan-200 transition hover:text-cyan-100">Tüm akışa göz at <span aria-hidden="true">→</span></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {subjects.map((subject) => (
              <Link key={subject.name} href="/giris" className="group rounded-2xl border border-white/10 bg-slate-900/65 p-5 transition hover:-translate-y-1 hover:border-cyan-200/25 hover:bg-slate-900">
                <span className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${subject.tone} text-lg font-bold text-cyan-100 ring-1 ring-white/10`}>{subject.mark}</span>
                <h3 className="mt-4 font-semibold">{subject.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{subject.detail}</p>
                <span className="mt-4 inline-block text-xs font-semibold text-cyan-200 opacity-80 transition group-hover:translate-x-1 group-hover:opacity-100">Keşfet →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-white/10 bg-slate-900/45 p-6 sm:mt-20 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Knowledge nasıl işler?</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Öğrenmek, paylaşınca kalıcı olur.</h2>
          </div>
          <div className="mt-7 grid gap-6 sm:grid-cols-3 sm:gap-4">
            {steps.map((step) => (
              <article key={step.number} className="border-t border-white/10 pt-5 sm:border-t-0 sm:pt-0">
                <span className="text-xs font-bold tracking-[0.16em] text-cyan-300">{step.number}</span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center">
          <p>Knowledge — merak edenler için bir topluluk.</p>
          <Link href="/giris" className="font-medium text-cyan-200 transition hover:text-cyan-100">Topluluğa katıl →</Link>
        </footer>
      </div>
    </main>
  );
}
