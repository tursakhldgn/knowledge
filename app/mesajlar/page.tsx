import Link from "next/link";

export default function Mesajlar() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-3xl items-start px-4 pt-10 pb-28 text-slate-100 sm:px-6 sm:pt-16">
      <section className="w-full rounded-3xl border border-white/10 bg-slate-900/75 p-7 shadow-2xl shadow-black/20 sm:p-10">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /></svg>
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Özel sohbetler</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Mesajların</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Direkt mesajlaşma özelliği hazırlanıyor. Şimdilik soruların altında yanıtlaşarak toplulukla iletişim kurabilirsin.</p>
        <Link href="/sorular" className="mt-6 inline-flex rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">Sorulara dön</Link>
      </section>
    </main>
  );
}
