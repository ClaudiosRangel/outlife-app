import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { fetchAppContent } from "@/lib/api";
import logo from "@/assets/logo-outvitar.png";

interface Props {
  /** Nome completo do usuário (usa só o primeiro nome). */
  fullName?: string | null;
  onDone: () => void;
}

const DURACAO_MS = 4200;

/**
 * Boas-vindas exibidas a cada login/abertura do app: logomarca com anéis
 * pulsando, montanhas subindo, partículas flutuando e a frase
 * "Aqui registraremos seus melhores momentos!" revelada palavra por palavra.
 * Toque em qualquer lugar para pular. Respeita "reduzir movimento".
 */
export function WelcomeSplash({ fullName, onDone }: Props) {
  const { t } = useTranslation();
  const [saindo, setSaindo] = useState(false);

  const primeiroNome = (fullName ?? "").trim().split(/\s+/)[0] || "";
  // Frase segue o slogan editado em Administração → Textos da Home (mesmo
  // texto do cartão da Home). Sem conteúdo cadastrado, usa o padrão.
  const { data: appContent } = useQuery({ queryKey: ["app-content"], queryFn: fetchAppContent });
  const sloganAdmin = (appContent?.["home.slogan"] ?? "")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const frase =
    sloganAdmin ||
    t("welcome.tagline", {
      defaultValue: "Aqui registraremos seus melhores momentos!",
    });
  const palavras = frase.split(" ");

  // Partículas determinísticas (sem Math.random no render).
  const particulas = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: (i * 53) % 100,
        size: 4 + ((i * 7) % 7),
        delay: (i % 9) * 0.35,
        dur: 3.2 + ((i * 3) % 5) * 0.6,
      })),
    [],
  );

  const encerrar = () => {
    setSaindo(true);
    window.setTimeout(onDone, 450);
  };

  useEffect(() => {
    const id = window.setTimeout(encerrar, DURACAO_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-label={t("welcome.aria", { defaultValue: "Boas-vindas" })}
      onClick={encerrar}
      className={`welcome-splash fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden px-8 text-center text-white ${
        saindo ? "welcome-out" : ""
      }`}
      style={{ background: "linear-gradient(180deg, #1F3D2B 0%, #2f5a40 55%, #4b7a5a 100%)" }}
    >
      <style>{`
        @keyframes ws-pop { 0% { transform: scale(.2) rotate(-12deg); opacity: 0 } 60% { transform: scale(1.12) rotate(3deg); opacity: 1 } 100% { transform: scale(1) rotate(0); opacity: 1 } }
        @keyframes ws-ring { 0% { transform: scale(.6); opacity: .55 } 100% { transform: scale(2.4); opacity: 0 } }
        @keyframes ws-rise { from { transform: translateY(40%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes ws-word { from { transform: translateY(14px); opacity: 0; filter: blur(4px) } to { transform: translateY(0); opacity: 1; filter: blur(0) } }
        @keyframes ws-float { 0% { transform: translateY(0) scale(.6); opacity: 0 } 15% { opacity: .9 } 100% { transform: translateY(-85vh) scale(1.1); opacity: 0 } }
        @keyframes ws-out { to { opacity: 0; transform: scale(1.04) } }
        .welcome-splash { animation: ws-fade .35s ease-out both }
        @keyframes ws-fade { from { opacity: 0 } to { opacity: 1 } }
        .welcome-out { animation: ws-out .45s ease-in forwards }
        .ws-logo { animation: ws-pop .9s cubic-bezier(.2,1.2,.3,1) .1s both }
        .ws-ring { animation: ws-ring 2.2s ease-out infinite }
        .ws-mount { animation: ws-rise 1.1s cubic-bezier(.2,.8,.2,1) .2s both }
        .ws-hello { animation: ws-word .7s ease-out .9s both }
        .ws-word { display: inline-block; animation: ws-word .6s ease-out both }
        .ws-dot { position: absolute; bottom: -20px; border-radius: 9999px; background: rgba(255,255,255,.75); animation: ws-float linear infinite }
        @media (prefers-reduced-motion: reduce) {
          .ws-logo, .ws-ring, .ws-mount, .ws-hello, .ws-word, .ws-dot { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important }
          .ws-ring, .ws-dot { display: none }
        }
      `}</style>

      {/* Partículas */}
      {particulas.map((p, i) => (
        <span
          key={i}
          className="ws-dot"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}

      {/* Montanhas */}
      <svg
        className="ws-mount pointer-events-none absolute inset-x-0 bottom-0 w-full"
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ height: "34vh" }}
      >
        <path d="M0 160 L0 95 L70 40 L120 85 L185 20 L260 95 L320 55 L400 105 L400 160 Z" fill="rgba(255,255,255,.10)" />
        <path d="M0 160 L0 120 L60 80 L130 125 L210 60 L290 125 L350 90 L400 125 L400 160 Z" fill="rgba(0,0,0,.18)" />
      </svg>

      {/* Logo com anéis */}
      <div className="relative mb-8 grid h-28 w-28 place-items-center">
        <span className="ws-ring absolute inset-0 rounded-full border-2 border-white/60" />
        <span className="ws-ring absolute inset-0 rounded-full border-2 border-white/40" style={{ animationDelay: "0.9s" }} />
        <div className="ws-logo grid h-28 w-28 place-items-center rounded-full bg-white p-3 shadow-2xl ring-4 ring-white/30">
          <img src={logo} alt="OutVitar" className="h-full w-full object-contain" />
        </div>
      </div>

      <p className="ws-hello text-sm font-medium uppercase tracking-[0.25em] text-white/75">
        {primeiroNome
          ? t("welcome.hello", { name: primeiroNome, defaultValue: "Bem-vindo, {{name}}" })
          : t("welcome.helloNoName", { defaultValue: "Bem-vindo" })}
      </p>

      <h1 className="relative mt-3 max-w-xs font-display text-3xl font-semibold leading-tight">
        {palavras.map((w, i) => (
          <span key={i} className="ws-word" style={{ animationDelay: `${1.25 + i * 0.22}s`, marginRight: "0.28em" }}>
            {w}
          </span>
        ))}
      </h1>

      <p className="absolute bottom-8 text-[11px] uppercase tracking-widest text-white/50">
        {t("welcome.skip", { defaultValue: "Toque para continuar" })}
      </p>
    </div>
  );
}
