"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Monitoring System
// ============================================================
const LOG_PREFIX = "[NexaSpark]";

const logger = {
  info: (scope: string, msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} ℹ️  [${scope}]%c ${msg}`, "color:#60a5fa;font-weight:bold;", "color:inherit;", data ?? ""),

  success: (scope: string, msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} ✅ [${scope}]%c ${msg}`, "color:#34d399;font-weight:bold;", "color:inherit;", data ?? ""),

  warn: (scope: string, msg: string, data?: any) =>
    console.warn(`%c${LOG_PREFIX} ⚠️  [${scope}]%c ${msg}`, "color:#fbbf24;font-weight:bold;", "color:inherit;", data ?? ""),

  error: (scope: string, msg: string, data?: any) =>
    console.error(`%c${LOG_PREFIX} ❌ [${scope}]%c ${msg}`, "color:#f87171;font-weight:bold;", "color:inherit;", data ?? ""),

  perf: (scope: string, label: string, ms: number) =>
    console.log(`%c${LOG_PREFIX} ⏱️  [${scope}]%c ${label} — ${ms.toFixed(2)}ms`, "color:#a78bfa;font-weight:bold;", "color:inherit;"),

  event: (scope: string, action: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🎯 [${scope}]%c ACTION → ${action}`, "color:#f472b6;font-weight:bold;", "color:inherit;", data ?? ""),

  mount: (component: string) =>
    console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${component}> renderizado`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),

  unmount: (component: string) =>
    console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${component}> destruído`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),

  section: (name: string) =>
    console.log(`%c${LOG_PREFIX} 👁️  [VIEWPORT]%c Seção visível → ${name}`, "color:#86efac;font-weight:bold;", "color:inherit;"),

  nav: (dest: string) =>
    console.log(`%c${LOG_PREFIX} 🧭 [NAV]%c Navegando para → ${dest}`, "color:#fb923c;font-weight:bold;", "color:inherit;"),

  interaction: (el: string, detail?: string) =>
    console.log(`%c${LOG_PREFIX} 🖱️  [UX]%c Interação em → ${el}`, "color:#e879f9;font-weight:bold;", "color:inherit;", detail ?? ""),

  asset: (name: string, status: "ok" | "fail", ms?: number) =>
    status === "ok"
      ? console.log(`%c${LOG_PREFIX} 🖼️  [ASSET]%c ${name} carregado${ms ? ` em ${ms.toFixed(0)}ms` : ""}`, "color:#34d399;font-weight:bold;", "color:inherit;")
      : console.error(`%c${LOG_PREFIX} 🖼️  [ASSET]%c ${name} FALHOU — verifique /public/images/`, "color:#f87171;font-weight:bold;", "color:inherit;"),

  group: (label: string, fn: () => void) => {
    console.groupCollapsed(`%c${LOG_PREFIX} 📦 [GROUP] ${label}`, "color:#94a3b8;font-weight:bold;");
    fn();
    console.groupEnd();
  },
};

// ============================================================
// ✨ PARTICLES — Three.js GPU Particles
// ============================================================
function Particles({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const ref = useRef<any>();

  // ✅ positions em useRef — calculado uma única vez, nunca recria
  const positions = useRef(
    (() => {
      const arr = new Float32Array(5000 * 3);
      for (let i = 0; i < 5000; i++) {
        arr[i * 3]     = (Math.random() - 0.5) * 20;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
      }
      return arr;
    })()
  );

  useEffect(() => {
    logger.mount("Particles");
    return () => logger.unmount("Particles");
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.02;
    ref.current.rotation.y += delta * 0.03;
    ref.current.rotation.y += mouse.current.x * 0.05;
    ref.current.rotation.x += mouse.current.y * 0.05;
  });

  return (
    <Points ref={ref} positions={positions.current} stride={3}>
      <PointMaterial transparent color="#00ffcc" size={0.015} depthWrite={false} />
    </Points>
  );
}

// ============================================================
// 🎬 FADE IN — Scroll-triggered animation wrapper
// ✅ useInView(ref, options) — API correta framer-motion v11
// ============================================================
function FadeIn({
  children, delay = 0, className = "", logLabel = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  logLabel?: string;
}) {
  // ✅ ref declarado aqui — obrigatório para useInView e motion.div
  const ref = useRef<HTMLDivElement>(null);

  // ✅ margin aceita string "Xpx Xpx" na framer-motion v11
  // as any intencional — evita conflito de tipagem sem afetar runtime
  const isInView = useInView(ref, { once: true, margin: "-80px 0px" as any });

  useEffect(() => {
    if (isInView && logLabel) logger.section(logLabel);
  }, [isInView, logLabel]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 48 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================================
// 🏠 HOME — Main Page Component
// ============================================================
export default function Home() {
  const router      = useRouter();
  const { scrollY } = useScroll();
  const [loading, setLoading]         = useState(true);
  const [cursorReady, setCursorReady] = useState(false);
  const mouse           = useRef({ x: 0, y: 0 });
  const heroImgLoadTime = useRef(0);

  logger.info("HOME", "Componente inicializando...");

  // ── Parallax transforms ──────────────────────────────────
  const yHero     = useTransform(scrollY, [0, 800], [0, 200]);
  const scaleHero = useTransform(scrollY, [0, 800], [1, 1.12]);
  const blurHero  = useTransform(scrollY, [0, 500], [0, 8]);
  const blurValue = useTransform(blurHero, (b) => `blur(${b}px)`);

  // ── Auth check ───────────────────────────────────────────
  useEffect(() => {
    const t0 = performance.now();
    logger.info("AUTH", "Verificando token de sessão...");

    const token = localStorage.getItem("token");

    if (token) {
      logger.success("AUTH", "Token encontrado — redirecionando para dashboard");
      logger.nav("/dashboard");
      router.replace("/dashboard");
      return;
    }

    logger.warn("AUTH", "Nenhum token encontrado — permanecendo na Home");

    const timer = setTimeout(() => {
      const ms = performance.now() - t0;
      logger.perf("HOME", "Carregamento inicial concluído", ms);
      logger.success("HOME", "Interface pronta para renderização ✨");
      setLoading(false);
      setCursorReady(true);
    }, 800);

    return () => {
      clearTimeout(timer);
      logger.info("AUTH", "useEffect AUTH cleanup executado");
    };
  }, []);

  // ── Scroll monitoring detalhado ──────────────────────────
  useEffect(() => {
    logger.info("SCROLL", "Monitor de seções inicializado");
    let lastSection = "";
    let lastY       = 0;
    let direction   = "down";

    const unsub = scrollY.on("change", (v) => {
      direction = v > lastY ? "down" : "up";
      lastY = v;

      const s =
        v < 100   ? "hero"
        : v < 900  ? "como-funciona"
        : v < 1800 ? "metricas"
        : v < 2800 ? "diferenciais"
        : v < 3600 ? "cta"
        : "footer";

      if (s !== lastSection) {
        logger.event("SCROLL", `Seção ativa: ${s}`, {
          scrollY:   Math.round(v),
          direction,
          timestamp: new Date().toISOString(),
        });
        lastSection = s;
      }
    });

    return () => {
      unsub();
      logger.info("SCROLL", "Monitor de seções removido");
    };
  }, [scrollY]);

  // ── Mouse tracking ───────────────────────────────────────
  useEffect(() => {
    logger.info("MOUSE", "Rastreamento de mouse inicializado");

    const handleMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      logger.info("MOUSE", "Rastreamento removido");
    };
  }, []);

  // ── Cursor glow — aguarda DOM estar pronto ───────────────
  // ✅ CORREÇÃO: [cursorReady] evita warning de elemento não encontrado
  //    pois só executa após setLoading(false) + setCursorReady(true)
  useEffect(() => {
    if (!cursorReady) return;

    const glow = document.getElementById("cursor-glow");
    if (!glow) {
      logger.warn("CURSOR", "Elemento #cursor-glow não encontrado mesmo após DOM ready");
      return;
    }

    logger.success("CURSOR", "Efeito de glow inicializado com rAF ✅");

    let rafId: number;
    const move = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      });
    };

    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(rafId);
      logger.info("CURSOR", "Glow removido e rAF cancelado");
    };
  }, [cursorReady]);

  // ── Resize monitor ───────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      logger.info("VIEWPORT", `Resize detectado → ${window.innerWidth}x${window.innerHeight}`);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Visibilidade da aba ──────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        logger.warn("PAGE", "Usuário saiu da aba — página oculta");
      } else {
        logger.success("PAGE", "Usuário retornou à aba — página visível");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ── Mount/Unmount ────────────────────────────────────────
  useEffect(() => {
    logger.mount("Home");
    logger.group("Ambiente de execução", () => {
      logger.info("ENV", `UserAgent: ${navigator.userAgent}`);
      logger.info("ENV", `Viewport: ${window.innerWidth}x${window.innerHeight}`);
      logger.info("ENV", `DevicePixelRatio: ${window.devicePixelRatio}`);
      logger.info("ENV", `Language: ${navigator.language}`);
    });
    return () => logger.unmount("Home");
  }, []);

  // ── Handlers de navegação ────────────────────────────────
  function goLogin() {
    logger.nav("/login");
    logger.event("NAV", "Usuário clicou → Login");
    router.push("/login");
  }

  function goRegister() {
    logger.nav("/register");
    logger.event("NAV", "Usuário clicou → Register");
    router.push("/register");
  }

  // ── Loading screen ───────────────────────────────────────
  if (loading) {
    logger.info("HOME", "Renderizando tela de loading...");
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="text-sm uppercase tracking-[0.3em] text-gray-600"
        >
          NexaSpark
        </motion.p>
      </div>
    );
  }

  logger.success("HOME", "Renderizando UI principal 🚀");

  // ── Data ─────────────────────────────────────────────────
  const steps = [
    { n: "01", title: "Contratação e acesso ao painel",    desc: "Após a contratação, sua instituição recebe acesso ao painel web exclusivo. Nenhuma configuração técnica necessária para começar a operar." },
    { n: "02", title: "Configuração da identidade",        desc: "Logo, cores e dados da empresa. Seu certificado terá identidade 100% exclusiva — nenhuma outra instituição no mercado terá um layout igual ao seu." },
    { n: "03", title: "Emissão pelo painel",               desc: "Emita individualmente ou em lote. Cada certificado recebe automaticamente hash SHA-256, QR code rastreável e ID único." },
    { n: "04", title: "Validação pública instantânea",     desc: "O aluno compartilha o link ou QR code. Empresas e recrutadores validam a autenticidade em menos de 2 segundos — sem conta, sem atrito." },
  ];

  const features = [
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, title: "Identidade 100% exclusiva", desc: "Cada empresa recebe um certificado único. Nenhuma outra instituição terá layout, domínio ou identidade visual igual à sua." },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>, title: "Painel web completo", desc: "Emissão individual ou em lote, gestão de alunos, relatórios e auditoria — operado pela sua equipe sem suporte técnico." },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12.5a10 10 0 1 0 10-10"/><path d="M12 8v4l3 3"/></svg>, title: "Validação em menos de 2s", desc: "QR code e link público verificável. Recrutadores confirmam autenticidade instantaneamente, sem nenhum cadastro." },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, title: "99.9% de uptime", desc: "Infraestrutura com redundância global, SLA contratual e monitoramento contínuo. Sua operação nunca para." },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>, title: "Hash SHA-256 imutável", desc: "Cada certificado tem assinatura criptográfica única. Impossível falsificar, adulterar ou duplicar após emissão." },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>, title: "Auditoria completa", desc: "Rastreamento de cada certificado emitido, validado e compartilhado. Relatórios exportáveis para gestão institucional." },
  ];

  const stats = [
    { n: "99.9%",   label: "Uptime garantido"    },
    { n: "<2s",     label: "Tempo de validação"  },
    { n: "SHA-256", label: "Criptografia padrão" },
    { n: "100%",    label: "Identidade exclusiva" },
  ];

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="bg-black text-white overflow-hidden relative">

      {/* ── CURSOR GLOW ── */}
      <div
        id="cursor-glow"
        className="fixed w-48 h-48 rounded-full pointer-events-none z-50 -translate-x-1/2 -translate-y-1/2"
        style={{ background: "radial-gradient(circle, rgba(29,158,117,0.10) 0%, transparent 70%)" }}
      />

      {/* ── PARTICLES 3D ─────────────────────────────────────
          ✅ CORREÇÃO: pointer-events-none no Canvas interno
             para que os cliques nos elementos HTML sobrepostos
             funcionem normalmente nas seções abaixo do hero.
      ────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 5] }}
          style={{ pointerEvents: "none" }}
        >
          <Particles mouse={mouse} />
        </Canvas>
      </div>

      {/* ══════════════════════════════════════════════
          NAV FLUTUANTE — canto superior direito
      ══════════════════════════════════════════════ */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="fixed top-5 right-6 z-[60] flex items-center gap-3"
      >
        <button
          onClick={() => { logger.interaction("nav-entrar"); goLogin(); }}
          className="text-xs text-gray-300 hover:text-white px-4 py-2 rounded-lg border border-white/10 hover:border-white/25 bg-black/40 backdrop-blur-md transition-all duration-200"
        >
          Entrar
        </button>
        <button
          onClick={() => { logger.interaction("nav-cadastrar"); goRegister(); }}
          className="text-xs text-black font-semibold px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 transition-all duration-200 hover:scale-105"
        >
          Cadastrar
        </button>
      </motion.nav>

      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section className="relative h-screen flex items-center justify-center text-center overflow-hidden">

        {/* Overlay — escurece para legibilidade do H1
            Gradiente multicamada garante contraste sobre
            qualquer tonalidade da imagem hero.
        */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: [
              "linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.45) 65%, rgba(0,0,0,1) 100%)",
            ].join(", "),
          }}
        />

        {/* Hero image — parallax + blur no scroll */}
        <motion.div
          style={{ y: yHero, scale: scaleHero, filter: blurValue }}
          className="absolute inset-0 z-0 w-full h-full"
        >
          <picture>
            <source media="(max-width: 768px)" srcSet="/images/hero-mobile.png" />
            <img
              src="/images/hero-desktop.png"
              alt="NexaSpark — Certificados Digitais com Validação Real"
              className="w-full h-full object-cover"
              onLoad={() => {
                const ms = performance.now() - heroImgLoadTime.current;
                logger.asset("hero-desktop.png", "ok", ms);
              }}
              onError={() => logger.asset("hero-desktop.png", "fail")}
              ref={(el) => { if (el) heroImgLoadTime.current = performance.now(); }}
            />
          </picture>
        </motion.div>

        {/* ── BADGE superior esquerdo — status live ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 1.0 }}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-black/50 backdrop-blur-md"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-medium">Sistema operacional</span>
        </motion.div>

        {/* ── BADGE inferior esquerdo — validação real-time ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 1.2 }}
          className="absolute bottom-24 left-6 z-20 hidden md:flex flex-col gap-1 px-4 py-3 rounded-xl border border-white/[0.08] bg-black/60 backdrop-blur-md max-w-[200px]"
        >
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Validação</p>
          <p className="text-sm font-semibold text-white">Tempo real</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">Qualquer empresa verifica em &lt;2s pelo QR ou link público</p>
        </motion.div>

        {/* ── BADGE inferior direito — criptografia ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 1.3 }}
          className="absolute bottom-24 right-6 z-20 hidden md:flex flex-col gap-1 px-4 py-3 rounded-xl border border-white/[0.08] bg-black/60 backdrop-blur-md max-w-[200px]"
        >
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Criptografia</p>
          <p className="text-sm font-semibold text-emerald-400">SHA-256</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">Hash imutável gerado automaticamente em cada emissão</p>
        </motion.div>

        {/* ── CONTEÚDO CENTRAL ── */}
        <div className="relative z-20 px-6 flex flex-col items-center">

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-5 font-medium"
          >
            Certificação Digital Enterprise
          </motion.p>

          {/* ✅ CORREÇÃO H1 LEGIBILIDADE:
              text-shadow multicamada cria halo escuro ao redor das letras
              garantindo leitura sobre qualquer cor de fundo da imagem hero.
              Implementado via style inline — Tailwind não suporta multi-layer text-shadow.
          */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl md:text-7xl font-semibold leading-tight mb-6 max-w-4xl"
            style={{
              textShadow: [
                "0 0 40px rgba(0,0,0,0.9)",
                "0 2px 20px rgba(0,0,0,0.95)",
                "0 4px 60px rgba(0,0,0,0.8)",
                "2px 2px 0px rgba(0,0,0,0.6)",
                "-2px -2px 0px rgba(0,0,0,0.6)",
              ].join(", "),
            }}
          >
            Certificados com{" "}
            <span
              className="text-emerald-400"
              style={{
                textShadow: [
                  "0 0 30px rgba(52,211,153,0.4)",
                  "0 0 60px rgba(0,0,0,0.9)",
                  "0 2px 20px rgba(0,0,0,0.95)",
                ].join(", "),
              }}
            >
              validação real
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="text-gray-200 text-lg max-w-xl mb-10 leading-relaxed"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.8)" }}
          >
            Plataforma exclusiva para escolas e plataformas EAD que exigem
            credibilidade, identidade própria e rastreabilidade total.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="flex gap-4 flex-wrap justify-center"
          >
            <a
              href="https://wa.me/5519982714815?text=Olá,%20gostaria%20de%20saber%20mais%20sobre%20a%20NexaSpark"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { logger.event("CTA", "Hero → Saiba mais WhatsApp"); logger.interaction("hero-cta-saiba-mais"); }}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8 py-3.5 rounded-lg transition-all duration-200 hover:scale-105 text-sm tracking-wide"
            >
              Saiba mais
            </a>
            <button
              onClick={() => { logger.interaction("hero-cta-acessar"); goLogin(); }}
              className="border border-white/30 hover:border-white/50 text-white px-8 py-3.5 rounded-lg transition-all duration-200 hover:bg-white/10 text-sm tracking-wide backdrop-blur-sm"
            >
              Acessar plataforma
            </button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="absolute bottom-10 z-20 flex flex-col items-center gap-2"
        >
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-emerald-500/50" />
          <p className="text-[10px] uppercase tracking-widest text-gray-600">Scroll</p>
        </motion.div>
      </section>

      <div className="w-full h-px bg-white/[0.06]" />

      {/* ══════════════════════════════════════════════
          COMO FUNCIONA
      ══════════════════════════════════════════════ */}
      <section className="relative py-28 px-6 md:px-16 max-w-6xl mx-auto">
        <FadeIn logLabel="como-funciona-header">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-medium mb-4">Processo</p>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4 leading-tight">Como funciona</h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-lg">
            Da contratação à validação pública — processo direto, resultado profissional.
          </p>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-0 border border-white/[0.06] rounded-2xl overflow-hidden">
          {steps.map((step, i) => (
            <FadeIn key={i} delay={i * 0.1} logLabel={`step-${step.n}`}>
              <div
                className="flex gap-6 p-8 border-b border-white/[0.06] md:odd:border-r group hover:bg-white/[0.02] transition-colors duration-300 h-full cursor-default"
                onMouseEnter={() => logger.interaction(`step-hover-${step.n}`, step.title)}
              >
                <div className="shrink-0">
                  <span className="text-5xl font-semibold text-white/[0.06] group-hover:text-emerald-500/25 transition-colors duration-500 leading-none select-none">
                    {step.n}
                  </span>
                </div>
                <div className="pt-1">
                  <h3 className="text-base font-semibold mb-3 text-white">{step.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div className="w-full h-px bg-white/[0.06]" />

      {/* ══════════════════════════════════════════════
          MÉTRICAS
      ══════════════════════════════════════════════ */}
      <section className="py-20 px-6 md:px-16 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
          {stats.map((stat, i) => (
            <FadeIn key={i} delay={i * 0.08} logLabel={`stat-${stat.label}`}>
              <div className="bg-black px-8 py-10 text-center hover:bg-white/[0.02] transition-colors duration-300">
                <p className="text-3xl font-semibold text-emerald-400 mb-2">{stat.n}</p>
                <p className="text-xs text-gray-600 uppercase tracking-widest">{stat.label}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div className="w-full h-px bg-white/[0.06]" />

      {/* ══════════════════════════════════════════════
          DIFERENCIAIS
      ══════════════════════════════════════════════ */}
      <section className="py-28 px-6 md:px-16 max-w-6xl mx-auto">
        <FadeIn logLabel="diferenciais-header">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-medium mb-4">Diferenciais</p>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4 leading-tight">
            Cada empresa.{" "}
            <span className="text-gray-500 font-normal">Um certificado único e exclusivo.</span>
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-lg">
            Construída para instituições que levam a sério a credibilidade dos seus alunos no mercado.
          </p>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
          {features.map((f, i) => (
            <FadeIn key={i} delay={i * 0.07} logLabel={`feature-${f.title}`}>
              <div
                className="bg-black p-8 hover:bg-white/[0.02] transition-colors duration-300 group h-full"
                onMouseEnter={() => logger.interaction(`feature-hover`, f.title)}
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-950/50 border border-emerald-900/30 flex items-center justify-center mb-5 group-hover:border-emerald-700/50 transition-colors duration-300">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold mb-3 text-white">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div className="w-full h-px bg-white/[0.06]" />

      {/* ══════════════════════════════════════════════
          CTA FINAL
          z-10 garante que o botão está acima do Canvas
          e recebe os eventos de click corretamente.
      ══════════════════════════════════════════════ */}
      <section className="relative py-28 px-6 text-center z-10">
        <FadeIn logLabel="cta-final">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-medium mb-6">Acesso restrito</p>
          <h2 className="text-3xl md:text-5xl font-semibold mb-6 leading-tight max-w-2xl mx-auto">
            Plataforma exclusiva para instituições de ensino
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-md mx-auto mb-10">
            A NexaSpark opera com um número selecionado de parceiros para garantir
            qualidade, suporte dedicado e exclusividade de identidade.
          </p>
          <a
            href="https://wa.me/5519982714815?text=Olá,%20gostaria%20de%20saber%20mais%20sobre%20a%20NexaSpark"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { logger.event("CTA", "Seção CTA → Saiba mais WhatsApp"); logger.interaction("cta-final-saiba-mais"); }}
            className="inline-flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-10 py-4 rounded-lg transition-all duration-200 hover:scale-105 text-sm tracking-wide"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.558 4.121 1.532 5.852L.057 23.58a.75.75 0 0 0 .916.919l5.808-1.494A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.513-5.168-1.405l-.361-.214-3.747.963.992-3.654-.235-.374A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            Saiba mais
          </a>
        </FadeIn>
      </section>

      <div className="w-full h-px bg-white/[0.06]" />

      {/* ══════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════ */}
      <footer className="relative z-10 py-16 px-6 md:px-16 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
          <div className="flex flex-col gap-3">
            <p className="text-white font-semibold text-lg tracking-tight">NexaSpark</p>
            <p className="text-gray-600 text-xs leading-relaxed max-w-xs">
              Plataforma de certificação digital com validação criptográfica
              para instituições de ensino e plataformas EAD.
            </p>
          </div>
          <div className="flex gap-12">
            <div className="flex flex-col gap-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">Plataforma</p>
              <button onClick={() => { logger.interaction("footer-acessar"); goLogin(); }}    className="text-gray-400 hover:text-white text-sm transition-colors text-left">Acessar</button>
              <button onClick={() => { logger.interaction("footer-cadastrar"); goRegister(); }} className="text-gray-400 hover:text-white text-sm transition-colors text-left">Cadastrar</button>
              <a
                href="https://wa.me/5519982714815"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { logger.event("NAV", "Footer → Contato WhatsApp"); logger.interaction("footer-contato"); }}
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Contato
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">Legal</p>
              <a href="/privacy" onClick={() => { logger.interaction("footer-privacidade"); logger.nav("/privacy"); }} className="text-gray-400 hover:text-white text-sm transition-colors">Privacidade</a>
              <a href="/terms"   onClick={() => { logger.interaction("footer-termos");       logger.nav("/terms");   }} className="text-gray-400 hover:text-white text-sm transition-colors">Termos de uso</a>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-700 text-xs">© {new Date().getFullYear()} NexaSpark. Todos os direitos reservados.</p>
          <p className="text-gray-700 text-xs">Certificação digital com integridade criptográfica</p>
        </div>
      </footer>

    </div>
  );
}