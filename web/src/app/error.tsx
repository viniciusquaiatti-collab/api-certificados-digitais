"use client";

// ============================================================
// 🏢 NexaSpark — web/src/app/error.tsx
// Página de erro global — Next.js App Router
//
// ⚠️  OBRIGATÓRIO ser Client Component ("use client")
//     Next.js exige que error.tsx seja client-side para
//     ter acesso ao error object e ao reset callback.
//
// Ativada quando qualquer Server Component lança exceção.
// O componente recebe:
//   - error: o objeto Error capturado
//   - reset: função para tentar re-renderizar o segmento
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function useClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setT(f());
    const id = setInterval(() => setT(f()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

interface ErrorPageProps {
  error:  Error & { digest?: string };
  reset:  () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const router  = useRouter();
  const clock   = useClock();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    // Loga o erro no console para debug
    console.error("🔴 [NexaSpark:ErrorBoundary]", {
      message: error?.message,
      digest:  error?.digest,
      stack:   error?.stack?.split("\n").slice(0, 4).join("\n"),
      ts:      new Date().toISOString(),
    });
    return () => clearTimeout(t);
  }, [error]);

  const fadeIn = (delay = 0): React.CSSProperties => ({
    opacity:    mounted ? 1 : 0,
    transform:  mounted ? "translateY(0)" : "translateY(16px)",
    transition: `opacity .5s ease ${delay}ms, transform .5s ease ${delay}ms`,
  });

  // Mensagem segura — nunca expõe stack trace ao usuário
  const safeMessage = error?.message?.includes("fetch")
    ? "Erro de comunicação com o servidor."
    : "Ocorreu um erro inesperado.";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes float  { 0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)} }
        @keyframes blink  { 0%,100%{opacity:1}50%{opacity:.2} }
        @keyframes pulse  { 0%,100%{opacity:.6}50%{opacity:1} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        *{box-sizing:border-box;margin:0;padding:0}
      `}</style>

      <div style={{ minHeight: "100vh", background: "#050810", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',system-ui,sans-serif", position: "relative", overflow: "hidden", padding: "24px" }}>

        {/* Grid */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,.014) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.014) 1px,transparent 1px)", backgroundSize: "48px 48px" }}/>

        {/* Glow laranja — erro mas não crítico */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 55% 45% at 50% 50%,rgba(251,146,60,.05) 0%,transparent 65%)" }}/>

        {/* Header bar */}
        <div style={{ ...fadeIn(0), position: "fixed", top: 0, left: 0, right: 0, padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.04)", background: "rgba(5,8,16,.8)", backdropFilter: "blur(12px)", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: "rgba(16,185,129,.14)", border: "1px solid rgba(16,185,129,.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, animation: "float 3s ease-in-out infinite" }}>⚡</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.8)", letterSpacing: "-0.02em" }}>NexaSpark</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(251,146,60,.05)", border: "1px solid rgba(251,146,60,.15)" }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#fb923c", animation: "blink 1s ease infinite" }}/>
            <span style={{ fontSize: 9, color: "rgba(251,146,60,.8)", fontFamily: "monospace", letterSpacing: "0.05em" }}>{clock} — ERRO</span>
          </div>
        </div>

        {/* Conteúdo central */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 500, zIndex: 1 }}>

          {/* Ícone erro */}
          <div style={{ ...fadeIn(60), width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,rgba(251,146,60,.18),rgba(251,146,60,.06))", border: "1px solid rgba(251,146,60,.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "0 0 40px rgba(251,146,60,.12)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(251,146,60,.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>

          {/* Terminal box */}
          <div style={{ ...fadeIn(140), width: "100%", borderRadius: 12, border: "1px solid rgba(251,146,60,.14)", background: "rgba(4,7,14,.95)", backdropFilter: "blur(16px)", overflow: "hidden", marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 13px", borderBottom: "1px solid rgba(251,146,60,.08)", background: "rgba(251,146,60,.04)" }}>
              {["#f87171","#fbbf24","#34d399"].map((c,i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: c, opacity: 0.75 }}/>)}
              <span style={{ fontSize: 9, color: "rgba(255,255,255,.18)", marginLeft: 6, fontFamily: "monospace" }}>nexaspark — erro do sistema</span>
              {error?.digest && (
                <span style={{ marginLeft: "auto", fontSize: 8, color: "rgba(255,255,255,.12)", fontFamily: "monospace" }}>digest: {error.digest}</span>
              )}
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { prefix: "$", text: "nexaspark status --system",      color: "rgba(255,255,255,.4)" },
                { prefix: "!", text: `ERRO: ${safeMessage}`,           color: "rgba(251,146,60,.85)" },
                { prefix: "→", text: "Equipe técnica foi notificada",   color: "rgba(251,191,36,.5)" },
                { prefix: "✓", text: "Seus dados estão seguros",        color: "rgba(52,211,153,.7)" },
              ].map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: line.color, flexShrink: 0, marginTop: 1 }}>{line.prefix}</span>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: line.color, lineHeight: 1.6 }}>{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          <h1 style={{ ...fadeIn(200), fontSize: "clamp(18px,3vw,24px)", fontWeight: 700, color: "rgba(255,255,255,.85)", letterSpacing: "-0.025em", margin: "0 0 10px" }}>
            Algo deu errado
          </h1>
          <p style={{ ...fadeIn(240), fontSize: 13, color: "rgba(255,255,255,.3)", lineHeight: 1.7, margin: "0 0 28px" }}>
            {safeMessage}<br/>
            Tente novamente ou volte ao início.
          </p>

          {/* Botões */}
          <div style={{ ...fadeIn(280), display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => { console.log("🔄 [ErrorPage] Tentando reset..."); reset(); }}
              style={{ padding: "11px 22px", borderRadius: 10, border: "1px solid rgba(251,146,60,.3)", background: "linear-gradient(135deg,rgba(251,146,60,.14),rgba(251,146,60,.06))", color: "rgba(251,146,60,.9)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne',system-ui,sans-serif", transition: "all .2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 28px rgba(251,146,60,.18)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
            >
              ↻ Tentar novamente
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              style={{ padding: "11px 22px", borderRadius: 10, border: "1px solid rgba(16,185,129,.35)", background: "linear-gradient(135deg,rgba(16,185,129,.18),rgba(16,185,129,.08))", color: "#34d399", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne',system-ui,sans-serif", transition: "all .2s", boxShadow: "0 0 24px rgba(16,185,129,.12)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(16,185,129,.22)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 24px rgba(16,185,129,.12)"; }}
            >
              → Ir para o Dashboard
            </button>
          </div>

          <p style={{ ...fadeIn(360), marginTop: 32, fontSize: 10, color: "rgba(255,255,255,.1)", fontFamily: "monospace" }}>
            © {new Date().getFullYear()} NexaSpark · Certificação Digital
          </p>
        </div>
      </div>
    </>
  );
}