"use client";

// ============================================================
// 🏢 NexaSpark — web/src/app/not-found.tsx
// Página 404 global — Next.js App Router
//
// Ativada automaticamente pelo Next.js quando:
//   - Rota não existe
//   - notFound() é chamado em qualquer Server Component
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

export default function NotFound() {
  const router  = useRouter();
  const clock   = useClock();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const fadeIn = (delay = 0): React.CSSProperties => ({
    opacity:    mounted ? 1 : 0,
    transform:  mounted ? "translateY(0)" : "translateY(16px)",
    transition: `opacity .5s ease ${delay}ms, transform .5s ease ${delay}ms`,
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes float   { 0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)} }
        @keyframes blink   { 0%,100%{opacity:1}50%{opacity:.2} }
        @keyframes glitch1 { 0%,100%{clip-path:inset(0 0 90% 0)}20%{clip-path:inset(33% 0 33% 0)}40%{clip-path:inset(66% 0 10% 0)}60%{clip-path:inset(10% 0 66% 0)}80%{clip-path:inset(90% 0 0 0)} }
        @keyframes scan    { 0%{transform:translateY(-100%)}100%{transform:translateY(100vh)} }
        *{box-sizing:border-box;margin:0;padding:0}
      `}</style>

      <div style={{ minHeight: "100vh", background: "#050810", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',system-ui,sans-serif", position: "relative", overflow: "hidden", padding: "24px" }}>

        {/* Grid */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,.014) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.014) 1px,transparent 1px)", backgroundSize: "48px 48px" }}/>

        {/* Glow vermelho — 404 tem tom de erro */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 55% 45% at 50% 50%,rgba(239,68,68,.06) 0%,transparent 65%)" }}/>

        {/* Scanline sutil */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(16,185,129,.3),transparent)", animation: "scan 4s linear infinite", pointerEvents: "none" }}/>

        {/* Header bar */}
        <div style={{ ...fadeIn(0), position: "fixed", top: 0, left: 0, right: 0, padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.04)", background: "rgba(5,8,16,.8)", backdropFilter: "blur(12px)", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: "rgba(16,185,129,.14)", border: "1px solid rgba(16,185,129,.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, animation: "float 3s ease-in-out infinite" }}>⚡</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.8)", letterSpacing: "-0.02em" }}>NexaSpark</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(16,185,129,.05)", border: "1px solid rgba(16,185,129,.12)" }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#10b981", animation: "blink 1.2s ease infinite" }}/>
            <span style={{ fontSize: 9, color: "rgba(16,185,129,.7)", fontFamily: "monospace", letterSpacing: "0.05em" }}>{clock}</span>
          </div>
        </div>

        {/* Conteúdo central */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 480, zIndex: 1 }}>

          {/* 404 glitch */}
          <div style={{ ...fadeIn(80), position: "relative", marginBottom: 24 }}>
            <div style={{ fontSize: "clamp(96px,18vw,140px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.05em", color: "rgba(239,68,68,.12)", userSelect: "none", position: "absolute", top: 0, left: 0, right: 0, animation: "glitch1 3s steps(1) infinite" }}>404</div>
            <div style={{ fontSize: "clamp(96px,18vw,140px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.05em", color: "rgba(255,255,255,.06)" }}>404</div>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "clamp(96px,18vw,140px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.05em", background: "linear-gradient(135deg,rgba(239,68,68,.7),rgba(239,68,68,.3))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>404</span>
            </div>
          </div>

          {/* Terminal box */}
          <div style={{ ...fadeIn(160), width: "100%", borderRadius: 12, border: "1px solid rgba(239,68,68,.15)", background: "rgba(4,7,14,.95)", backdropFilter: "blur(16px)", overflow: "hidden", marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 13px", borderBottom: "1px solid rgba(239,68,68,.08)", background: "rgba(239,68,68,.04)" }}>
              {["#f87171","#fbbf24","#34d399"].map((c,i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: c, opacity: 0.75 }}/>)}
              <span style={{ fontSize: 9, color: "rgba(255,255,255,.18)", marginLeft: 6, fontFamily: "monospace" }}>nexaspark — erro</span>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { prefix: "$", text: "nexaspark status --route current", color: "rgba(255,255,255,.4)" },
                { prefix: "!", text: "ERRO: Página não encontrada", color: "rgba(239,68,68,.8)" },
                { prefix: "→", text: "HTTP 404 — recurso inexistente", color: "rgba(251,191,36,.6)" },
                { prefix: "✓", text: "Sistema operacional — apenas esta rota falhou", color: "rgba(52,211,153,.7)" },
              ].map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: line.color, flexShrink: 0, marginTop: 1 }}>{line.prefix}</span>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: line.color, lineHeight: 1.6 }}>{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          <h1 style={{ ...fadeIn(220), fontSize: "clamp(18px,3vw,24px)", fontWeight: 700, color: "rgba(255,255,255,.85)", letterSpacing: "-0.025em", margin: "0 0 10px" }}>
            Página não encontrada
          </h1>
          <p style={{ ...fadeIn(260), fontSize: 13, color: "rgba(255,255,255,.3)", lineHeight: 1.7, margin: "0 0 28px" }}>
            A rota que você acessou não existe ou foi removida.<br/>Verifique o endereço ou volte ao início.
          </p>

          {/* Botões */}
          <div style={{ ...fadeIn(300), display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => router.back()}
              style={{ padding: "11px 22px", borderRadius: 10, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Syne',system-ui,sans-serif", transition: "all .2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,.2)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.9)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,.1)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.6)"; }}
            >
              ← Voltar
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

          <p style={{ ...fadeIn(380), marginTop: 32, fontSize: 10, color: "rgba(255,255,255,.1)", fontFamily: "monospace" }}>
            © {new Date().getFullYear()} NexaSpark · Certificação Digital
          </p>
        </div>
      </div>
    </>
  );
}