import Link from "next/link";

export default function Siralama() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-3xl items-start px-4 pt-10 pb-28 text-slate-100 sm:px-6 sm:pt-16">
      <section className="w-full rounded-3xl border border-white/10 bg-slate-900/75 p-7 shadow-2xl shadow-black/20 sm:p-10">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" /></svg>
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Katkıların görünür olsun</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Topluluk sıralaması</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Katkı puanları ve haftalık sıralama hazırlanıyor. Faydalı anlatımlar paylaşmaya devam et.</p>
        <Link href="/sorular" className="mt-6 inline-flex rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">Sorulara dön</Link>
      </section>
    </main>
  );
}
