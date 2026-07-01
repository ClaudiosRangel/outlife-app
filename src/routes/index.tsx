import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, MapPin, Search, ShieldCheck, Sparkles, ArrowRight, Mountain } from "lucide-react";
import hero from "@/assets/hero-mountain.jpg";
import { StatusBar } from "@/components/StatusBar";
import { Stars } from "@/components/Stars";
import { fetchDestinations, fetchPartners } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Outlife — A vida não é só trilhar" },
      { name: "description", content: "Marketplace outdoor colaborativo: trilhas, guias, pousadas e empresas verificadas via Cadastur." },
      { property: "og:title", content: "Outlife — A vida não é só trilhar" },
      { property: "og:description", content: "Marketplace outdoor colaborativo: trilhas, guias, pousadas e empresas verificadas via Cadastur." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Home() {
  const { t } = useTranslation();
  const { data: destinations = [] } = useQuery({ queryKey: ["destinations"], queryFn: fetchDestinations });
  const { data: partners = [] } = useQuery({ queryKey: ["partners"], queryFn: fetchPartners });
  return (
    <div className="animate-float-up">
      {/* Hero */}
      <section className="relative h-[460px] overflow-hidden">
        <img src={hero} alt="Aventureiro no topo de uma montanha ao amanhecer" className="absolute inset-0 h-full w-full object-cover" width={1024} height={1280} />
        <div className="absolute inset-0 bg-gradient-hero" />
        <StatusBar light />
        <div className="relative z-10 flex items-center justify-between px-5 pt-2">
          <div className="flex items-center gap-2 text-white">
            <Mountain size={22} strokeWidth={2.2} />
            <span className="font-display text-xl font-semibold tracking-tight">Outlife</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/busca" className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md">
              <Search size={18} />
            </Link>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md">
              <Bell size={18} />
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-7 text-white">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium backdrop-blur-md">
            <Sparkles size={12} /> {t("home.greeting")}
          </p>
          <h1 className="font-display text-[34px] leading-[1.05] font-semibold whitespace-pre-line">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-2 max-w-[18rem] text-sm text-white/80">{t("home.heroSubtitle")}</p>

          <Link
            to="/explorar"
            className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-3 pl-4 text-foreground shadow-float"
          >
            <Search size={18} className="text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">{t("home.searchPlaceholder")}</span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ArrowRight size={16} />
            </span>
          </Link>
        </div>
      </section>

      {/* Quick stats */}
      <section className="mx-5 -mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-card p-3 shadow-card relative z-20">
        {[
          { v: "1.2k", l: t("home.stats.destinations") },
          { v: "480+", l: t("home.stats.partners") },
          { v: "98%", l: t("home.stats.verified") },
        ].map((s) => (
          <div key={s.l} className="text-center">
            <div className="font-display text-lg font-semibold text-primary">{s.v}</div>
            <div className="text-[11px] text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </section>


      {/* Categories */}
      <section className="mt-7 px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{t("home.categoriesTitle")}</h2>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
          {["Trilhas", "Cachoeiras", "Montanhas", "Camping", "Caiaque", "Escalada"].map((c, i) => (
            <button
              key={c}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-base ${
                i === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* Destinos populares */}
      <section className="mt-7">
        <div className="flex items-center justify-between px-5">
          <h2 className="font-display text-xl font-semibold">{t("home.popularDestinations")}</h2>
          <Link to="/explorar" className="text-xs font-medium text-primary">{t("common.seeAll")}</Link>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-hide px-5 pb-2">
          {destinations.map((d) => (
            <div key={d.id} className="relative w-[240px] shrink-0 overflow-hidden rounded-2xl shadow-card">
              <img src={d.img} alt={d.name} loading="lazy" className="h-[300px] w-full object-cover" width={800} height={1024} />
              <div className="absolute inset-0 bg-gradient-hero" />
              <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-md">
                <MapPin size={10} /> {d.region}
              </div>
              <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold">
                ★ {d.rating}
              </div>
              <div className="absolute inset-x-3 bottom-3 text-white">
                <div className="font-display text-base font-semibold leading-tight">{d.name}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-white/80">
                  <span>{d.difficulty}</span>·<span>{d.distance}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{d.type}</span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{d.duration}</span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{d.elevation}m</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Parceiros em destaque */}
      <section className="mt-7 px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{t("home.featuredPartners")}</h2>
          <Link to="/marketplace" className="text-xs font-medium text-primary">{t("home.market")}</Link>
        </div>
        <div className="mt-3 space-y-3">
          {partners.slice(0, 2).map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
              <img src={p.img} alt={p.name} loading="lazy" className="h-16 w-16 rounded-xl object-cover" width={800} height={800} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{p.name}</span>
                  {p.verified && (
                    <span title="Verificado Cadastur" className="grid h-4 w-4 place-items-center rounded-full bg-[var(--verified)] text-white">
                      <ShieldCheck size={10} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{p.category}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <Stars value={p.rating} />
                  <span className="text-[11px] text-muted-foreground">{p.rating} · {p.reviews}</span>
                </div>
              </div>
              <Link to="/parceiro/$partnerId" params={{ partnerId: p.id }} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium">Ver</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Slogan */}
      <section className="mt-8 mx-5 mb-6 rounded-3xl bg-gradient-forest p-6 text-white shadow-float">
        <p className="font-display text-xl leading-tight whitespace-pre-line">
          {t("home.slogan")}
        </p>
        <p className="mt-3 text-xs uppercase tracking-widest text-white/70">Outlife · ecossistema</p>
      </section>
    </div>
  );
}
