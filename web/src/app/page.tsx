"use client";

// ============================================================
// 🏢 NexaSpark — /page.tsx v2.0 CINEMATIC ENTERPRISE
//
// UPGRADE v2 — De landing page para EXPERIÊNCIA VISUAL:
//
//   HERO CINEMATOGRÁFICO
//   ✅ Headline massiva com split-text stagger reveal
//   ✅ Cursor magnético reagindo ao mouse em tempo real
//   ✅ Partículas GPU com react-three-fiber
//   ✅ Parallax multicamada (foreground/mid/background)
//   ✅ Glow ambiental verde respirando
//   ✅ Video/image overlay cinematográfico
//   ✅ Badges flutuantes animados
//   ✅ Scroll indicator com linha pulsante
//
//   MOTION STORYTELLING
//   ✅ 8 seções conectadas com continuidade visual
//   ✅ Seções com bleed visual — glow atravessa containers
//   ✅ Stagger reveal em cada elemento ao entrar na viewport
//   ✅ Contadores animados ao aparecer (countUp)
//   ✅ Hash SHA-256 sendo gerado em tempo real (wow moment)
//   ✅ QR validando ao scroll (wow moment)
//   ✅ Terminal motion — logs criptográficos ao vivo
//   ✅ Glassmorphism ultra refinado nos cards
//   ✅ Hover magnético nos CTAs
//   ✅ Mouse spotlight nos cards de features
//
//   TIPOGRAFIA PREMIUM
//   ✅ Syne (display) + JetBrains Mono (tech)
//   ✅ Headlines em escala cinematográfica (6xl → 8xl)
//   ✅ Contraste editorial forte — peso 700/400/300
//   ✅ Letter-spacing para respiro premium
//
//   VISUAL ENTERPRISE
//   ✅ Background com noise premium + gradients atmosféricos
//   ✅ Grid tecnológico animado no fundo
//   ✅ Linhas de conexão SVG animadas
//   ✅ Grain overlay para profundidade
//   ✅ Glow que ultrapassa seções criando continuidade
//   ✅ Cards com ambient reflection no hover
//
//   CONSOLE ENTERPRISE
//   ✅ Todos os logs da v1 preservados + novos
//   ✅ logger.cinema() — novo scope para animações
//   ✅ logger.wow() — novo scope para wow moments
//   ✅ Performance tracking em todos os useEffects
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter }                                 from "next/navigation";
import { motion, useScroll, useTransform, useInView, useSpring, useMotionValue, animate } from "framer-motion";
import { Canvas, useFrame }                          from "@react-three/fiber";
import { Points, PointMaterial }                     from "@react-three/drei";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Home v2.0
// ============================================================
const LOG_PREFIX = "[NexaSpark:Home:v2]";

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
  mount: (c: string) =>
    console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}> renderizado`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) =>
    console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}> destruído`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
  section: (name: string) =>
    console.log(`%c${LOG_PREFIX} 👁️  [VIEWPORT]%c Seção → ${name}`, "color:#86efac;font-weight:bold;", "color:inherit;"),
  nav: (dest: string) =>
    console.log(`%c${LOG_PREFIX} 🧭 [NAV]%c → ${dest}`, "color:#fb923c;font-weight:bold;", "color:inherit;"),
  interaction: (el: string, detail?: string) =>
    console.log(`%c${LOG_PREFIX} 🖱️  [UX]%c Interação → ${el}`, "color:#e879f9;font-weight:bold;", "color:inherit;", detail ?? ""),
  asset: (name: string, status: "ok" | "fail", ms?: number) =>
    status === "ok"
      ? console.log(`%c${LOG_PREFIX} 🖼️  [ASSET]%c ${name} OK${ms ? ` ${ms.toFixed(0)}ms` : ""}`, "color:#34d399;font-weight:bold;", "color:inherit;")
      : console.error(`%c${LOG_PREFIX} 🖼️  [ASSET]%c ${name} FALHOU`, "color:#f87171;font-weight:bold;", "color:inherit;"),
  // ✅ v2.0: novos escopos para experiência cinematográfica
  cinema: (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🎬 [CINEMA]%c ${msg}`, "color:#c084fc;font-weight:bold;", "color:inherit;", data ?? ""),
  wow: (moment: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} ✨ [WOW]%c ${moment} ativado!`, "color:#fde68a;font-weight:bold;", "color:inherit;", data ?? ""),
  group: (label: string, fn: () => void) => {
    console.groupCollapsed(`%c${LOG_PREFIX} 📦 [GROUP] ${label}`, "color:#94a3b8;font-weight:bold;");
    fn();
    console.groupEnd();
  },
};

// ============================================================
// 🎨 DESIGN TOKENS — Sistema de cores e espaçamento
// ============================================================
const TOKENS = {
  green:       "#10b981",
  greenBright: "#34d399",
  greenDim:    "rgba(16,185,129,0.15)",
  greenGlow:   "rgba(16,185,129,0.08)",
  bg:          "#030508",
  bgMid:       "#060a0f",
  border:      "rgba(255,255,255,0.06)",
  borderGreen: "rgba(16,185,129,0.2)",
  text:        "rgba(255,255,255,0.85)",
  textMuted:   "rgba(255,255,255,0.3)",
  textDim:     "rgba(255,255,255,0.12)",
} as const;

// ============================================================
// ✨ PARTICLES 3D — GPU Particles com react-three-fiber
// ============================================================
function Particles({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const ref = useRef<any>(null);

  const positions = useRef(
    (() => {
      const arr = new Float32Array(6000 * 3);
      for (let i = 0; i < 6000; i++) {
        arr[i * 3]     = (Math.random() - 0.5) * 25;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 25;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 25;
      }
      return arr;
    })()
  );

  useEffect(() => {
    logger.mount("Particles3D");
    logger.cinema("6000 partículas GPU inicializadas", { count: 6000 });
    return () => logger.unmount("Particles3D");
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.015;
    ref.current.rotation.y += delta * 0.02;
    // Reage suavemente ao mouse
    ref.current.rotation.y += mouse.current.x * 0.03 * delta;
    ref.current.rotation.x += mouse.current.y * 0.03 * delta;
  });

  return (
    <Points ref={ref} positions={positions.current} stride={3}>
      <PointMaterial transparent color="#10b981" size={0.012} depthWrite={false} opacity={0.6} />
    </Points>
  );
}

// ============================================================
// 🎬 FADE IN — Scroll-triggered com stagger
// ============================================================
function FadeIn({
  children, delay = 0, className = "", logLabel = "", direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  logLabel?: string;
  direction?: "up" | "left" | "right" | "scale";
}) {
  const ref      = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px 0px" as any });

  const initial = {
    up:    { opacity: 0, y: 56 },
    left:  { opacity: 0, x: -40 },
    right: { opacity: 0, x: 40 },
    scale: { opacity: 0, scale: 0.92 },
  }[direction];

  const target = {
    up:    { opacity: 1, y: 0 },
    left:  { opacity: 1, x: 0 },
    right: { opacity: 1, x: 0 },
    scale: { opacity: 1, scale: 1 },
  }[direction];

  useEffect(() => {
    if (isInView && logLabel) {
      logger.section(logLabel);
      logger.cinema(`FadeIn ativado: ${logLabel}`, { delay, direction });
    }
  }, [isInView, logLabel]);

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={isInView ? target : {}}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================================
// 📊 COUNT UP — Contador animado ao aparecer na viewport
// ============================================================
function CountUp({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const ref      = useRef<HTMLSpanElement>(null);
  const nodeRef  = useRef<HTMLDivElement>(null);
  const isInView = useInView(nodeRef, { once: true, margin: "-40px 0px" as any });
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (isInView && !started) {
      setStarted(true);
      logger.wow("CountUp iniciado", { to, suffix, prefix });
      const controls = animate(0, to, {
        duration: 2,
        ease: [0.22, 1, 0.36, 1],
        onUpdate(v) {
          if (ref.current) ref.current.textContent = prefix + Math.floor(v).toLocaleString("pt-BR") + suffix;
        },
      });
      return () => controls.stop();
    }
  }, [isInView, started, to, suffix, prefix]);

  return (
    <div ref={nodeRef}>
      <span ref={ref}>{prefix}0{suffix}</span>
    </div>
  );
}

// ============================================================
// 🖥️  TERMINAL — Hash criptográfico sendo gerado ao vivo
//
// ✅ CORREÇÃO React 18 Strict Mode:
//   - TERMINAL_LINES fora do componente → nunca recriado
//   - timeoutRef guarda o id do setTimeout recursivo
//   - cleanup cancela AMBOS (timeout + interval) de forma segura
//   - started ref garante que o loop só inicia uma vez,
//     mesmo com double-invoke do Strict Mode em desenvolvimento
// ============================================================

// ✅ FORA do componente — array estático, nunca recriado entre renders
// ✅ Tipo string[] explícito — compatível com useState<string[]> e .startsWith()
// ✅ SEM "as const" — evitava incompatibilidade de tipos com state mutável
const TERMINAL_LINES: string[] = [
  "$ nexaspark emit --cert 'João Silva'",
  "> Gerando identificador único...",
  "> ID: NS-2026-0x4F3A9C",
  "> Calculando SHA-256...",
  "> HASH: 3A9F2C8D1B4E6A0F...",
  "> Assinando com chave privada RSA-4096",
  "> QR Code gerado: qr.nexaspark.com/v/3A9F",
  "> PDF criado: certificado_joao_silva.pdf",
  "✓ Certificado emitido em 1.243s",
  "✓ Imutável. Verificável. Impossível de falsificar.",
];
// Tamanho fixo — usado no JSX em vez de TERMINAL_LINES.length dentro do render
const TERMINAL_TOTAL = TERMINAL_LINES.length;

function LiveTerminal() {
  const ref      = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px 0px" as any });

  const [lines, setLines]   = useState<string[]>([]);
  const [cursor, setCursor] = useState(true);

  // ✅ Refs para cleanup seguro — nunca ficam stale
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef  = useRef(false); // impede double-invoke do Strict Mode

  useEffect(() => {
    // Só roda quando entrar na viewport — e apenas uma vez
    if (!isInView || startedRef.current) return;
    startedRef.current = true;

    logger.wow("LiveTerminal iniciado", { lines: TERMINAL_LINES.length });

    let index = 0;

    const scheduleNext = () => {
      // ✅ Guarda o id no ref para cancelar no cleanup
      timeoutRef.current = setTimeout(() => {
        if (index >= TERMINAL_LINES.length) return;

        const line = TERMINAL_LINES[index];
        index++;

        setLines(prev => [...prev, line]);

        // Agenda próxima linha se houver mais
        if (index < TERMINAL_LINES.length) {
          scheduleNext();
        } else {
          logger.wow("LiveTerminal: todas as linhas exibidas ✅");
        }
      }, index === 0 ? 400 : 160 + Math.random() * 140);
    };

    scheduleNext();

    // Cursor piscando
    intervalRef.current = setInterval(() => setCursor(c => !c), 530);

    return () => {
      // ✅ Cancela tudo no cleanup — seguro para Strict Mode
      if (timeoutRef.current)  clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      logger.info("TERMINAL", "LiveTerminal cleanup executado");
    };
  }, [isInView]);

  return (
    <div
      ref={ref}
      style={{
        background:     "rgba(4,8,14,0.95)",
        border:         "1px solid rgba(16,185,129,0.15)",
        borderRadius:   16,
        padding:        "24px 28px",
        fontFamily:     "'JetBrains Mono', monospace",
        fontSize:       13,
        lineHeight:     1.9,
        minHeight:      260,
        position:       "relative",
        overflow:       "hidden",
        boxShadow:      "0 0 60px rgba(16,185,129,0.06), inset 0 1px 0 rgba(16,185,129,0.1)",
      }}
    >
      {/* scanline effect */}
      <div style={{
        position:   "absolute", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
        zIndex:     1,
      }} />

      {/* terminal header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, position: "relative", zIndex: 2 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.2)", fontSize: 11 }}>nexaspark — emit — bash</span>
      </div>

      {/* lines */}
      <div style={{ position: "relative", zIndex: 2 }}>
        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              color: line.startsWith("✓")   ? "#34d399"
                   : line.startsWith(">")   ? "rgba(255,255,255,0.5)"
                   : line.startsWith("$")   ? "#60a5fa"
                   :                          "rgba(255,255,255,0.7)",
            }}
          >
            {line}
          </motion.div>
        ))}
        {/* ✅ TERMINAL_TOTAL — constante externa, nunca undefined */}
        {lines.length < TERMINAL_TOTAL && (
          <span style={{ color: "#10b981", opacity: cursor ? 1 : 0, transition: "opacity 0.1s" }}>▋</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 🪄 MOUSE SPOTLIGHT CARD — Card que reage ao mouse
// ============================================================
function SpotlightCard({
  children, className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => { setHovered(true); logger.interaction("SpotlightCard", "hover"); }}
      onMouseLeave={() => setHovered(false)}
      className={className}
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* spotlight */}
      <div
        style={{
          position:   "absolute",
          width:      300,
          height:     300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
          left:       pos.x - 150,
          top:        pos.y - 150,
          opacity:    hovered ? 1 : 0,
          transition: "opacity 0.3s",
          pointerEvents: "none",
          zIndex:     1,
        }}
      />
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}

// ============================================================
// 🧲 MAGNETIC BUTTON — Botão com efeito magnético
// ============================================================
function MagneticButton({
  children, onClick, style = {}, className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  const btnRef  = useRef<HTMLButtonElement>(null);
  const x       = useMotionValue(0);
  const y       = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  const handleMove = (e: React.MouseEvent) => {
    if (!btnRef.current) return;
    const rect   = btnRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width  / 2;
    const centerY = rect.top  + rect.height / 2;
    x.set((e.clientX - centerX) * 0.35);
    y.set((e.clientY - centerY) * 0.35);
  };

  const handleLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.button
      ref={btnRef}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ x: springX, y: springY, ...style }}
      className={className}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
    >
      {children}
    </motion.button>
  );
}

// ============================================================
// 📟 QR LIVE VALIDATOR — WOW MOMENT: QR validando ao vivo
//
// ✅ CORREÇÃO React 18 Strict Mode:
//   - startedRef impede double-invoke
//   - timeouts guardados em refs para cleanup seguro
// ============================================================
function QrLiveValidator() {
  const ref      = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px 0px" as any });

  const [phase, setPhase] = useState<"idle" | "scanning" | "verified">("idle");
  const [hash, setHash]   = useState("...");

  const startedRef = useRef(false);
  const t1Ref      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2Ref      = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isInView || startedRef.current) return;
    startedRef.current = true;

    logger.wow("QrLiveValidator iniciado");

    t1Ref.current = setTimeout(() => setPhase("scanning"), 600);

    t2Ref.current = setTimeout(() => {
      setHash("3A9F2C8D1B4E6A0F927C3E5B");
      setPhase("verified");
      logger.wow("QrLiveValidator: certificado verificado ✅");
    }, 2400);

    return () => {
      if (t1Ref.current) clearTimeout(t1Ref.current);
      if (t2Ref.current) clearTimeout(t2Ref.current);
      logger.info("QR", "QrLiveValidator cleanup executado");
    };
  }, [isInView]);

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      {/* QR Mock */}
      <div style={{
        width:        180,
        height:       180,
        borderRadius: 16,
        border:       `2px solid ${phase === "verified" ? "#10b981" : "rgba(255,255,255,0.1)"}`,
        background:   "rgba(4,8,14,0.9)",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        position:     "relative",
        overflow:     "hidden",
        transition:   "border-color 0.5s",
        boxShadow:    phase === "verified" ? "0 0 40px rgba(16,185,129,0.3)" : "none",
      }}>
        {/* QR pattern simplificado */}
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ opacity: 0.6 }}>
          <rect x="10" y="10" width="35" height="35" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="4"/>
          <rect x="17" y="17" width="21" height="21" fill="rgba(255,255,255,0.3)"/>
          <rect x="75" y="10" width="35" height="35" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="4"/>
          <rect x="82" y="17" width="21" height="21" fill="rgba(255,255,255,0.3)"/>
          <rect x="10" y="75" width="35" height="35" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="4"/>
          <rect x="17" y="82" width="21" height="21" fill="rgba(255,255,255,0.3)"/>
          {[...Array(20)].map((_, i) => (
            <rect key={i} x={50 + (i % 4) * 10} y={50 + Math.floor(i / 4) * 10} width="7" height="7" fill="rgba(255,255,255,0.2)" />
          ))}
        </svg>

        {/* scan line */}
        {phase === "scanning" && (
          <motion.div
            initial={{ top: 0 }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
            style={{
              position:   "absolute",
              left:       0,
              right:      0,
              height:     2,
              background: "linear-gradient(90deg, transparent, #10b981, transparent)",
              boxShadow:  "0 0 12px #10b981",
            }}
          />
        )}

        {/* verified check */}
        {phase === "verified" && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            style={{
              position:       "absolute",
              inset:          0,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              background:     "rgba(16,185,129,0.1)",
            }}
          >
            <div style={{
              width:          56,
              height:         56,
              borderRadius:   "50%",
              background:     "rgba(16,185,129,0.2)",
              border:         "2px solid #10b981",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontSize:       24,
            }}>✓</div>
          </motion.div>
        )}
      </div>

      {/* status text */}
      <div style={{ textAlign: "center" }}>
        <motion.p
          key={phase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize:     12,
            fontFamily:   "'JetBrains Mono', monospace",
            color:        phase === "verified" ? "#34d399" : "rgba(255,255,255,0.4)",
            letterSpacing: "0.05em",
            marginBottom: 6,
          }}
        >
          {phase === "idle"     && "Aguardando..."}
          {phase === "scanning" && "🔍 Verificando autenticidade..."}
          {phase === "verified" && "✓ CERTIFICADO AUTÊNTICO"}
        </motion.p>
        {phase === "verified" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              fontSize:   10,
              fontFamily: "'JetBrains Mono', monospace",
              color:      "rgba(16,185,129,0.5)",
            }}
          >
            SHA-256: {hash}...
          </motion.p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 🌐 INFRASTRUCTURE SECTION — nexa-global-infrastructure.jpg
// Seção parallax com imagem + stats de infraestrutura global
// Posicionada entre "O Problema" e "A Solução"
// ============================================================
function InfrastructureSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y     = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.12, 1.04, 1.12]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.3]);

  const infraStats = [
    { value: "38",       label: "Regiões de borda" },
    { value: "< 2s",     label: "Tempo de validação" },
    { value: "99.99%",   label: "Disponibilidade" },
    { value: "ISO 27001",label: "Certificação" },
  ];

  useEffect(() => {
    logger.cinema("InfrastructureSection montada");
  }, []);

  return (
    <section
      ref={ref}
      style={{ position: "relative", height: "90vh", minHeight: 600, overflow: "hidden", zIndex: 5 }}
    >
      {/* Imagem com parallax */}
      <motion.div style={{ y, scale, position: "absolute", inset: 0, willChange: "transform" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/nexa-global-infrastructure.jpg"
          alt="NexaSpark Global Infrastructure"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onLoad={() => logger.asset("nexa-global-infrastructure.jpg", "ok")}
          onError={() => logger.asset("nexa-global-infrastructure.jpg", "fail")}
        />
      </motion.div>

      {/* Gradientes cinematográficos */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to bottom, #030508 0%, transparent 18%, transparent 65%, #030508 100%)",
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to right, rgba(3,5,8,0.85) 0%, rgba(3,5,8,0.2) 50%, rgba(3,5,8,0.85) 100%)",
      }} />
      {/* Tint verde sutil */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 30% 60%, rgba(16,185,129,0.08) 0%, transparent 60%)",
      }} />

      {/* Conteúdo */}
      <motion.div
        style={{
          opacity,
          position: "relative", zIndex: 10,
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 40px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div style={{ maxWidth: 520 }}>
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" as any }}
            transition={{ duration: 0.7 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 14px", borderRadius: 40,
              border: "1px solid rgba(16,185,129,0.2)",
              background: "rgba(3,5,8,0.6)",
              backdropFilter: "blur(12px)",
              marginBottom: 24,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", animation: "blink 2s ease infinite" }} />
            <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(16,185,129,0.8)", fontFamily: "monospace" }}>
              INFRAESTRUTURA GLOBAL
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-80px" as any }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            style={{
              fontSize: "clamp(28px, 4vw, 52px)",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              marginBottom: 20,
              textShadow: "0 4px 40px rgba(0,0,0,0.9)",
            }}
          >
            Cada certificado verificável{" "}
            <span style={{ color: TOKENS.greenBright }}>em qualquer lugar do planeta.</span>
          </motion.h2>

          {/* Body */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" as any }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{
              fontSize: 15, color: "rgba(255,255,255,0.45)",
              lineHeight: 1.75, marginBottom: 36,
              textShadow: "0 2px 20px rgba(0,0,0,0.8)",
            }}
          >
            Nossa infraestrutura distribui cada verificação na borda da rede — 
            a milissegundos do recrutador, do parceiro, do regulador. 
            Sem intermediários. Sem pontos únicos de falha.
          </motion.p>

          {/* Stats grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" as any }}
            transition={{ duration: 0.8, delay: 0.3 }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}
          >
            {infraStats.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: "18px 20px",
                  background: "rgba(3,5,8,0.65)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: i === 0 ? "12px 0 0 0" : i === 1 ? "0 12px 0 0" : i === 2 ? "0 0 0 12px" : "0 0 12px 0",
                }}
              >
                <div style={{ fontSize: "clamp(18px, 2.5vw, 26px)", fontWeight: 800, color: TOKENS.greenBright, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Corner brackets — detalhe premium */}
      {["top-6 left-6 border-t border-l", "top-6 right-6 border-t border-r",
        "bottom-6 left-6 border-b border-l", "bottom-6 right-6 border-b border-r"].map((cls, i) => (
        <div key={i} className={`absolute ${cls} hidden md:block`}
          style={{ width: 24, height: 24, borderColor: "rgba(16,185,129,0.25)", pointerEvents: "none" }} />
      ))}
    </section>
  );
}

// ============================================================
// 🎥 ATMOSPHERE SECTION — nexa-atmosphere.mp4
// Seção fullscreen com vídeo parallax + texto sobreposto
//
// ✅ React 18 Strict Mode safe:
//   - videoLoggedRef impede log duplo no double-invoke
//   - useInView com once: true para animação única
// ============================================================
function AtmosphereSection() {
  const ref      = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoLoggedRef = useRef(false);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale   = useTransform(scrollYProgress, [0, 1],          [1.08, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0.2, 1, 1, 0.3]);

  const isInView = useInView(ref, { once: true, margin: "-100px 0px" as any });

  useEffect(() => {
    if (isInView && !videoLoggedRef.current) {
      videoLoggedRef.current = true;
      logger.cinema("AtmosphereSection visível — nexa-atmosphere.mp4 ativo");
    }
  }, [isInView]);

  return (
    <section
      ref={ref}
      style={{ position: "relative", height: "100vh", minHeight: 620, overflow: "hidden", zIndex: 5 }}
    >
      {/* Vídeo com scale parallax */}
      <motion.div style={{ scale, position: "absolute", inset: 0 }}>
        <video
          ref={videoRef}
          src="/videos/nexa-hero.mp4"
          autoPlay
          muted
          loop
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onLoadedData={() => {
            if (!videoLoggedRef.current) logger.asset("nexa-hero.mp4", "ok");
          }}
          onError={() => logger.asset("nexa-hero.mp4", "fail")}
        />
      </motion.div>

      {/* Gradientes sobre o vídeo */}
      <div style={{
        position:   "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to bottom, #030508 0%, transparent 20%, transparent 70%, #030508 100%)",
      }} />
      <div style={{
        position:   "absolute", inset: 0, pointerEvents: "none",
        background: "rgba(3,5,8,0.35)",
      }} />

      {/* Texto sobreposto com fade parallax */}
      <motion.div
        style={{
          opacity,
          position:       "relative", zIndex: 10,
          height:         "100%",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "flex-end",
          paddingBottom:  96,
          textAlign:      "center",
          paddingLeft:    24,
          paddingRight:   24,
        }}
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" as any }}
          transition={{ duration: 0.8 }}
          style={{
            display:        "inline-flex",
            alignItems:     "center",
            gap:            8,
            padding:        "6px 16px",
            borderRadius:   40,
            border:         "1px solid rgba(16,185,129,0.25)",
            background:     "rgba(3,5,8,0.6)",
            backdropFilter: "blur(16px)",
            marginBottom:   24,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "blink 2s ease infinite" }} />
          <span style={{ fontSize: 9, letterSpacing: "0.25em", color: "rgba(16,185,129,0.8)", fontFamily: "monospace" }}>
            INFRAESTRUTURA ATIVA — TEMPO REAL
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" as any }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          style={{
            fontSize:      "clamp(28px, 4.5vw, 58px)",
            fontWeight:    800,
            lineHeight:    1.06,
            letterSpacing: "-0.025em",
            maxWidth:      720,
            marginBottom:  16,
          }}
        >
          Quem recebe um certificado NexaSpark{" "}
          <span style={{ color: TOKENS.greenBright }}>carrega uma prova que dura para sempre.</span>
        </motion.h2>

        {/* Caption */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" as any }}
          transition={{ duration: 0.9, delay: 0.25 }}
          style={{
            fontSize:   16,
            color:      "rgba(255,255,255,0.4)",
            maxWidth:   460,
            lineHeight: 1.7,
          }}
        >
          Cada hash SHA-256 é permanente, público e verificável — sem prazo de validade, sem intermediários.
        </motion.p>
      </motion.div>
    </section>
  );
}

// ============================================================
// 🏆 CERTIFICATE PREVIEW — Imagem do produto real
// Substitui o terminal técnico por algo que o cliente entende:
// o certificado premium que sua instituição vai emitir.
//
// ✅ Efeitos:
//   - Glow verde respirando atrás do certificado
//   - Scan line animada sobre a imagem (autenticação visual)
//   - Badge "verificado" aparecendo com spring
//   - Floating labels com métricas (SHA-256, 2s, etc)
//   - Parallax sutil no hover
// ============================================================
function CertificatePreview() {
  const ref      = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px 0px" as any });

  useEffect(() => {
    if (isInView) logger.cinema("CertificatePreview visível — marca d'água ativa");
  }, [isInView]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: "relative", width: "100%" }}
    >
      {/* Glow verde difuso atrás — muito suave */}
      <div style={{
        position:      "absolute",
        inset:         0,
        background:    "radial-gradient(ellipse at center, rgba(16,185,129,0.07) 0%, transparent 70%)",
        filter:        "blur(32px)",
        pointerEvents: "none",
        zIndex:        0,
      }} />

      {/* Imagem — opacidade de marca d'água, sem borda forte */}
      {/* ⚠️  Arquivo: web/public/images/certificado.png */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/certificado.png"
        alt="Exemplo de certificado NexaSpark"
        style={{
          position:   "relative",
          zIndex:     1,
          width:      "100%",
          display:    "block",
          borderRadius: 16,
          opacity:    0.55,        // marca d'água — vê, mas não grita
          filter:     "saturate(0.7) brightness(0.85)",
          mixBlendMode: "luminosity" as any,
        }}
        onLoad={() => logger.asset("certificado.png", "ok")}
        onError={() => logger.asset("certificado.png", "fail")}
      />

      {/* Overlay gradiente — funde com o fundo escuro nas bordas */}
      <div style={{
        position:      "absolute",
        inset:         0,
        zIndex:        2,
        borderRadius:  16,
        background:    "linear-gradient(to bottom, rgba(3,5,8,0.15) 0%, rgba(3,5,8,0.0) 40%, rgba(3,5,8,0.5) 100%)",
        pointerEvents: "none",
      }} />
    </motion.div>
  );
}

// ============================================================
// 🏠 HOME — Main Page Component v2.0 CINEMATIC
// ============================================================
export default function Home() {
  const router      = useRouter();
  const { scrollY } = useScroll();

  const [loading,      setLoading]      = useState(true);
  const [cursorReady,  setCursorReady]  = useState(false);

  const mouse           = useRef({ x: 0, y: 0 });
  // heroImgLoadTime removido — hero agora usa vídeo

  // ── Parallax layers — múltiplas velocidades ──────────────
  const yHero      = useTransform(scrollY, [0, 900], [0, 220]);
  const scaleHero  = useTransform(scrollY, [0, 900], [1, 1.15]);
  const blurHero   = useTransform(scrollY, [0, 600], [0, 10]);
  const blurValue  = useTransform(blurHero, (b) => `blur(${b}px)`);
  const yGlow      = useTransform(scrollY, [0, 600], [0, -60]);   // glow sobe mais rápido
  const opacityHero = useTransform(scrollY, [0, 500], [1, 0]);   // hero desaparece

  // ── Magnetic cursor ───────────────────────────────────────
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const springCX = useSpring(cursorX, { stiffness: 80, damping: 15 });
  const springCY = useSpring(cursorY, { stiffness: 80, damping: 15 });

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

    logger.warn("AUTH", "Nenhum token — permanecendo na Home");

    const timer = setTimeout(() => {
      const ms = performance.now() - t0;
      logger.perf("HOME", "Loading concluído", ms);
      logger.success("HOME", "Interface pronta ✨");
      setLoading(false);
      setCursorReady(true);
    }, 700);

    return () => {
      clearTimeout(timer);
      logger.info("AUTH", "useEffect AUTH cleanup");
    };
  }, []);

  // ── Magnetic cursor tracking ─────────────────────────────
  useEffect(() => {
    if (!cursorReady) return;
    logger.cinema("Magnetic cursor ativado");

    const move = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      mouse.current.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("mousemove", move);
      logger.info("CURSOR", "Magnetic cursor removido");
    };
  }, [cursorReady]);

  // ── Scroll monitoring ────────────────────────────────────
  useEffect(() => {
    let lastSection = "";
    let lastY = 0;

    const unsub = scrollY.on("change", (v) => {
      const dir = v > lastY ? "↓" : "↑";
      lastY = v;

      const s =
        v < 100   ? "hero"
        : v < 900  ? "problema"
        : v < 1800 ? "solucao"
        : v < 2700 ? "terminal"
        : v < 3600 ? "validacao"
        : v < 4400 ? "metricas"
        : v < 5200 ? "features"
        : "cta";

      if (s !== lastSection) {
        logger.event("SCROLL", `${dir} ${s}`, { scrollY: Math.round(v) });
        lastSection = s;
      }
    });

    return () => unsub();
  }, [scrollY]);

  // ── Visibility ───────────────────────────────────────────
  useEffect(() => {
    const handle = () => {
      if (document.hidden) logger.warn("PAGE", "Aba oculta");
      else logger.success("PAGE", "Aba visível");
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  // ── Mount ────────────────────────────────────────────────
  useEffect(() => {
    logger.mount("Home v2.0 Cinematic Enterprise");
    logger.group("Ambiente", () => {
      logger.info("ENV", `Viewport: ${window.innerWidth}x${window.innerHeight}`);
      logger.info("ENV", `DPR: ${window.devicePixelRatio}`);
      logger.info("ENV", `Lang: ${navigator.language}`);
    });
    return () => logger.unmount("Home v2.0");
  }, []);

  // ── Nav handlers ─────────────────────────────────────────
  const goLogin    = useCallback(() => { logger.nav("/login");    logger.event("NAV", "→ Login");    router.push("/login");    }, [router]);
  const goRegister = useCallback(() => { logger.nav("/register"); logger.event("NAV", "→ Register"); router.push("/register"); }, [router]);

  // ── Loading screen ───────────────────────────────────────
  if (loading) {
    logger.info("HOME", "Renderizando loading screen...");
    return (
      <div style={{ height: "100vh", background: "#030508", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}>
        <motion.div
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 40, height: 40, position: "relative" }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "1.5px solid transparent",
              borderTopColor: "#10b981",
            }}
          />
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "1px solid rgba(16,185,129,0.1)",
          }} />
        </motion.div>
        <motion.p
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          style={{ fontSize: 10, letterSpacing: "0.35em", color: "rgba(16,185,129,0.4)", fontFamily: "monospace" }}
        >
          NEXASPARK
        </motion.p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  logger.success("HOME", "Renderizando UI cinematográfica v2.0 🚀");

  // ── Data ─────────────────────────────────────────────────
  // ── COPY — NexaSpark SaaS Enterprise (reescrito v3) ─────
  // Abordagem: problema real → solução técnica → prova → CTA
  // Tom: autoridade técnica + urgência de mercado

  const problems = [
    {
      icon: "🏛️",
      title: "Autoridade que se vê antes de qualquer clique",
      desc: "Um certificado NexaSpark comunica seriedade institucional no primeiro olhar — identidade visual exclusiva, tipografia, domínio e assinatura que nenhuma plataforma genérica oferece.",
    },
    {
      icon: "🔍",
      title: "Rastreamento total do ciclo de vida",
      desc: "Saiba exatamente quem verificou, quando e de onde. Cada interação com o certificado gera um registro auditável — visibilidade completa do impacto da sua credencial no mercado.",
    },
    {
      icon: "⚡",
      title: "Validação em tempo real, sem fricção",
      desc: "Recrutadores, parceiros e reguladores confirmam autenticidade em menos de 2 segundos, sem criar conta, sem instalar nada. A verificação é tão simples quanto abrir um link.",
    },
  ];

  const features = [
    {
      icon: "🔐",
      title: "Assinatura SHA-256 imutável",
      desc: "Cada certificado recebe uma impressão digital criptográfica única. Alterar um único caractere invalida toda a assinatura — matematicamente impossível de falsificar.",
    },
    {
      icon: "⚡",
      title: "Verificação pública em menos de 2s",
      desc: "QR code + link permanente. Qualquer recrutador, órgão regulador ou parceiro confirma autenticidade em tempo real — sem cadastro, sem fricção, sem ligação.",
    },
    {
      icon: "🏛️",
      title: "Identidade institucional exclusiva",
      desc: "Logotipo, paleta, tipografia e domínio da sua instituição. Nenhuma outra organização no mercado terá um certificado visualmente igual ao seu.",
    },
    {
      icon: "📡",
      title: "Rastreamento completo do ciclo de vida",
      desc: "Painel em tempo real com cada emissão, verificação e revogação. Saiba exatamente quem validou, quando e de onde — com exportação para auditoria.",
    },
    {
      icon: "🛡️",
      title: "Conformidade LGPD e ISO 27001",
      desc: "Dados pessoais hasheados, nunca expostos em texto puro. Infraestrutura auditada, criptografia em trânsito e em repouso. Art. 46 garantido contratualmente.",
    },
    {
      icon: "🔗",
      title: "API REST para integração total",
      desc: "Integre emissão e verificação diretamente no seu LMS, ERP ou sistema interno. Webhooks em tempo real, SDK disponível, documentação completa.",
    },
  ];

  const steps = [
    {
      n: "01",
      title: "Onboarding em 48 horas",
      desc: "Contrato assinado, acesso ao painel configurado e identidade visual aplicada em até dois dias úteis. Sua operação entra no ar sem fricção técnica.",
    },
    {
      n: "02",
      title: "Identidade institucional aplicada",
      desc: "Enviamos um questionário de branding. Logo, cores e dados da sua instituição são aplicados nos templates. Seu certificado é único — garantido em contrato.",
    },
    {
      n: "03",
      title: "Emissão individual ou em lote",
      desc: "Painel intuitivo para emissão unitária ou importação CSV em massa. Cada certificado gera automaticamente: hash SHA-256, QR verificável e PDF pronto para envio.",
    },
    {
      n: "04",
      title: "Validação pública instantânea",
      desc: "O destinatário compartilha o link ou QR. Em menos de 2 segundos, qualquer pessoa confirma autenticidade, dados exatos e status — sem criar conta.",
    },
  ];

  const stats = [
    { value: 99,  suffix: ".99%", label: "Uptime garantido em SLA" },
    { value: 2,   suffix: "s",    label: "Validação pública"        },
    { value: 256, suffix: "-bit", label: "Criptografia AES + SHA"   },
    { value: 48,  suffix: "h",    label: "Onboarding completo"      },
  ];

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div style={{
      background:  TOKENS.bg,
      color:       "white",
      overflow:    "hidden",
      position:    "relative",
      fontFamily:  "'Syne', system-ui, sans-serif",
    }}>

      {/* ── CSS GLOBAL ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.25); border-radius: 2px; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes breathe { 0%,100% { opacity:0.4; transform:scale(1); } 50% { opacity:0.8; transform:scale(1.08); } }
        @keyframes float   { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        @keyframes blink   { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
        @keyframes grid-move { from { transform:translateY(0); } to { transform:translateY(60px); } }
        @keyframes pulse-ring { 0% { transform:scale(0.8); opacity:1; } 100% { transform:scale(2.5); opacity:0; } }

        ::selection { background: rgba(16,185,129,0.3); }

        /* ── RESPONSIVIDADE MOBILE ── */
        @media (max-width: 768px) {
          .hero-headline span { font-size: clamp(40px, 12vw, 72px) !important; }
          .hero-subtitle      { font-size: 14px !important; max-width: 90vw !important; }
          .hero-cta-wrap      { flex-direction: column !important; align-items: center !important; }
          .hero-badge-bottom  { display: none !important; }
          .section-grid-2     { grid-template-columns: 1fr !important; gap: 40px !important; }
          .section-grid-3     { grid-template-columns: 1fr !important; }
          .section-grid-4     { grid-template-columns: 1fr 1fr !important; }
          .section-pad        { padding: 80px 20px !important; }
          .nav-logo-label     { display: none !important; }
          .step-number        { font-size: 36px !important; }
          .cta-headline       { font-size: clamp(32px, 10vw, 56px) !important; }
        }

        @media (max-width: 480px) {
          .section-grid-4  { grid-template-columns: 1fr !important; }
          .section-grid-2  { gap: 32px !important; }
        }

        /* Frase de canto — oculta em mobile, visível só em desktop */
        @media (max-width: 900px) {
          .hero-corner-phrase { display: none !important; }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════
          CURSOR MAGNÉTICO — segue o mouse com spring physics
      ══════════════════════════════════════════════════════ */}
      {cursorReady && (
        <>
          {/* inner dot */}
          <motion.div
            style={{
              position: "fixed", top: -4, left: -4, width: 8, height: 8,
              borderRadius: "50%", background: "#10b981",
              pointerEvents: "none", zIndex: 9999,
              x: springCX, y: springCY,
              mixBlendMode: "difference",
            }}
          />
          {/* outer glow */}
          <motion.div
            style={{
              position: "fixed", top: -32, left: -32, width: 64, height: 64,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
              pointerEvents: "none", zIndex: 9998,
              x: springCX, y: springCY,
            }}
          />
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          BACKGROUND ATMOSFÉRICO — camadas permanentes
      ══════════════════════════════════════════════════════ */}

      {/* Grid tecnológico animado */}
      <div style={{
        position:   "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        overflow:   "hidden",
      }}>
        <div style={{
          position:   "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          animation:  "grid-move 8s linear infinite",
        }} />
      </div>

      {/* Grain overlay premium */}
      <div style={{
        position:   "fixed", inset: 0, pointerEvents: "none", zIndex: 1,
        opacity:    0.025,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize:   "200px 200px",
      }} />

      {/* Partículas 3D GPU — sempre visíveis atrás de tudo */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <Canvas camera={{ position: [0, 0, 5] }} style={{ pointerEvents: "none" }}>
          <Particles mouse={mouse} />
        </Canvas>
      </div>

      {/* ══════════════════════════════════════════════════════
          NAV FLUTUANTE
      ══════════════════════════════════════════════════════ */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6 }}
        style={{
          position:       "fixed", top: 20, right: 24, zIndex: 60,
          display:        "flex", alignItems: "center", gap: 10,
        }}
      >
        {/* Logo — canto esquerdo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          style={{
            position:       "fixed", top: 20, left: 24,
            display:        "flex", alignItems: "center", gap: 10,
            zIndex:         60,
          }}
        >
          <div style={{
            width:      32, height: 32, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(16,185,129,0.3), rgba(16,185,129,0.08))",
            border:     "1px solid rgba(16,185,129,0.3)",
            display:    "flex", alignItems: "center", justifyContent: "center",
            fontSize:   15,
            boxShadow:  "0 0 20px rgba(16,185,129,0.15)",
            animation:  "float 4s ease-in-out infinite",
          }}>⚡</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.02em" }}>NexaSpark</span>
        </motion.div>

        <button
          onClick={() => { logger.interaction("nav-entrar"); goLogin(); }}
          style={{
            fontSize:       12, color: "rgba(255,255,255,0.5)",
            padding:        "8px 16px", borderRadius: 8,
            border:         "1px solid rgba(255,255,255,0.08)",
            background:     "rgba(5,8,16,0.7)",
            backdropFilter: "blur(12px)", cursor: "pointer",
            transition:     "all 0.2s",
            fontFamily:     "'Syne', system-ui, sans-serif",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "white"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
        >
          Entrar
        </button>

        <MagneticButton
          onClick={() => { logger.interaction("nav-cadastrar"); goRegister(); }}
          style={{
            fontSize:   12, color: "#000", fontWeight: 700,
            padding:    "8px 18px", borderRadius: 8,
            background: "#10b981", border: "none", cursor: "pointer",
            fontFamily: "'Syne', system-ui, sans-serif",
          }}
        >
          Começar grátis
        </MagneticButton>
      </motion.nav>

      {/* ══════════════════════════════════════════════════════
          SEÇÃO 1 — HERO CINEMATOGRÁFICO
          Fullscreen. Atmosférico. Headline massiva.
      ══════════════════════════════════════════════════════ */}
      <section style={{
        position:   "relative",
        height:     "100vh",
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign:  "center",
        overflow:   "hidden",
        zIndex:     5,
      }}>

        {/* ── HERO VIDEO — nexa-atmosphere.mp4 ── */}
        {/* Pessoa segurando certificado — protagonista visual  */}
        {/* ⚠️  Arquivo: web/public/videos/nexa-atmosphere.mp4  */}
        <motion.div
          style={{ y: yHero, scale: scaleHero, filter: blurValue, position: "absolute", inset: 0 }}
        >
          <video
            src="/videos/nexa-atmosphere.mp4"
            autoPlay
            muted
            loop
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onLoadedData={() => logger.asset("nexa-atmosphere.mp4", "ok")}
            onError={() => logger.asset("nexa-atmosphere.mp4", "fail")}
          />
        </motion.div>

        {/* Overlay cinematográfico multicamada */}
        <div style={{
          position:   "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
          background: `
            linear-gradient(to bottom,
              rgba(3,5,8,0.55)  0%,
              rgba(3,5,8,0.15) 25%,
              rgba(3,5,8,0.25) 65%,
              rgba(3,5,8,0.95) 100%
            ),
            radial-gradient(ellipse at 50% 120%, rgba(16,185,129,0.08) 0%, transparent 60%)
          `,
        }} />

        {/* Glow verde central com parallax */}
        <motion.div style={{ y: yGlow, position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
          <div style={{
            position:   "absolute",
            left:       "50%",
            top:        "60%",
            transform:  "translate(-50%, -50%)",
            width:      600,
            height:     600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 65%)",
            filter:     "blur(40px)",
            animation:  "breathe 5s ease-in-out infinite",
          }} />
        </motion.div>

        {/* Badge status — ao vivo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position:       "absolute", top: 80, left: "50%",
            transform:      "translateX(-50%)",
            zIndex:         20,
            display:        "flex", alignItems: "center", gap: 8,
            padding:        "7px 16px", borderRadius: 40,
            border:         "1px solid rgba(16,185,129,0.25)",
            background:     "rgba(3,5,8,0.55)",
            backdropFilter: "blur(20px)",
            whiteSpace:     "nowrap",
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#10b981",
            animation:  "blink 2s ease infinite",
            flexShrink: 0,
            boxShadow:  "0 0 8px rgba(16,185,129,0.8)",
          }} />
          <span style={{
            fontSize:      10,
            color:         "rgba(16,185,129,0.9)",
            letterSpacing: "0.2em",
            fontFamily:    "monospace",
          }}>
            SISTEMA OPERACIONAL
          </span>
        </motion.div>

        {/* ── FRASE CANTO — Bottom-left, discreta, quem fica lê ── */}
        {/* Oculta no mobile via classe — não compete com os CTAs  */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.2, delay: 1.6, ease: [0.22, 1, 0.36, 1] }}
          className="hero-corner-phrase"
          style={{
            position:      "absolute",
            bottom:        178,
            left:          36,
            zIndex:        20,
            maxWidth:      260,
            pointerEvents: "none",
          }}
        >
          <p style={{
            fontSize:      12,
            fontWeight:    400,
            lineHeight:    1.65,
            color:         "rgba(255,255,255,0.28)",
            letterSpacing: "0.01em",
            textShadow:    "0 2px 20px rgba(0,0,0,0.9)",
          }}>
            A credencial que sua instituição emite hoje{" "}
            <span style={{ color: "rgba(16,185,129,0.55)", fontWeight: 500 }}>
              define a reputação que seus alunos carregam para sempre.
            </span>
          </p>
        </motion.div>

        {/* ── ÁREA BASE — CTAs na zona escura inferior ── */}
        {/* Separados da frase central, colados ao fundo escuro     */}
        {/* Hierarquia: label pequeno → frase → espaço → 2 CTAs     */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position:       "absolute",
            bottom:         0,
            left:           0,
            right:          0,
            zIndex:         20,
            padding:        "48px 40px 52px",
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            gap:            0,
          }}
        >
          {/* Label de contexto — pequeno, discreto */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            style={{
              fontSize:      9,
              letterSpacing: "0.3em",
              color:         "rgba(16,185,129,0.55)",
              fontFamily:    "monospace",
              textTransform: "uppercase",
              marginBottom:  14,
            }}
          >
            Plataforma SaaS para EAD e instituições educacionais
          </motion.p>

          {/* Frase de suporte — leve, não compete com o vídeo */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.8 }}
            style={{
              fontSize:      "clamp(13px, 1.4vw, 16px)",
              color:         "rgba(255,255,255,0.38)",
              fontWeight:    400,
              letterSpacing: "0.005em",
              lineHeight:    1.6,
              maxWidth:      460,
              textAlign:     "center",
              marginBottom:  36,
            }}
          >
            A plataforma definitiva para instituições que levam credibilidade a sério
          </motion.p>

          {/* CTAs — espaçados, clicáveis, com hierarquia visual clara */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.55, duration: 0.8 }}
            className="hero-cta-wrap"
            style={{
              display:        "flex",
              gap:            16,
              justifyContent: "center",
              flexWrap:       "wrap",
            }}
          >
            {/* CTA primário */}
            <MagneticButton
              onClick={() => {
                logger.event("CTA", "Hero → WhatsApp");
                window.open("https://wa.me/5519982714815", "_blank");
              }}
              style={{
                padding:      "13px 30px",
                borderRadius: 10,
                background:   "#10b981",
                color:        "#000",
                fontWeight:   700,
                fontSize:     13,
                cursor:       "pointer",
                border:       "none",
                letterSpacing:"0.03em",
                fontFamily:   "'Space Grotesk', system-ui, sans-serif",
                boxShadow:    "0 0 32px rgba(16,185,129,0.35), 0 0 80px rgba(16,185,129,0.1)",
                whiteSpace:   "nowrap",
              }}
            >
              Solicitar acesso →
            </MagneticButton>

            {/* CTA secundário */}
            <motion.button
              onClick={() => {
                logger.interaction("hero-cta-plataforma");
                goLogin();
              }}
              whileHover={{ borderColor: "rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.9)" }}
              style={{
                padding:        "13px 30px",
                borderRadius:   10,
                border:         "1px solid rgba(255,255,255,0.10)",
                background:     "rgba(255,255,255,0.03)",
                color:          "rgba(255,255,255,0.5)",
                fontSize:       13,
                cursor:         "pointer",
                backdropFilter: "blur(16px)",
                fontFamily:     "'Space Grotesk', system-ui, sans-serif",
                letterSpacing:  "0.02em",
                transition:     "border-color 0.2s, color 0.2s",
                whiteSpace:     "nowrap",
              }}
            >
              Acessar plataforma
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Scroll indicator — acima da área base */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.0 }}
          style={{
            position:      "absolute",
            bottom:        170,
            left:          "50%",
            transform:     "translateX(-50%)",
            zIndex:        15,
            display:       "flex",
            flexDirection: "column",
            alignItems:    "center",
            gap:           6,
            pointerEvents: "none",
          }}
        >
          <div style={{ width: 1, height: 36, background: "linear-gradient(to bottom, transparent, rgba(16,185,129,0.4))" }} />
          <p style={{ fontSize: 8, letterSpacing: "0.3em", color: "rgba(255,255,255,0.15)", fontFamily: "monospace" }}>SCROLL</p>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SEÇÃO 2 — O PROBLEMA
          Narrativa emocional. Por que isso importa.
      ══════════════════════════════════════════════════════ */}
      <section className="section-pad" style={{ position: "relative", padding: "140px 24px", maxWidth: 1100, margin: "0 auto", zIndex: 5 }}>

        {/* Glow de transição — bleed visual da seção anterior */}
        <div style={{
          position:   "absolute",
          top:        -200,
          left:       "50%",
          transform:  "translateX(-50%)",
          width:      800,
          height:     400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div className="section-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div>
            <FadeIn logLabel="problema-header" direction="left">
              <p style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(16,185,129,0.5)", fontFamily: "monospace", marginBottom: 20, textTransform: "uppercase" }}>
                — Por que NexaSpark
              </p>
              <h2 style={{
                fontSize:      "clamp(28px, 4vw, 52px)",
                fontWeight:    800,
                lineHeight:    1.08,
                letterSpacing: "-0.025em",
                marginBottom:  20,
              }}>
                Certificados que transmitem confiança{" "}
                <span style={{ color: TOKENS.greenBright }}>antes mesmo da validação.</span>
              </h2>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.38)", lineHeight: 1.8, maxWidth: 440 }}>
                Proteção criptográfica · Validação pública · Autenticidade institucional em tempo real.
              </p>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.28)", lineHeight: 1.75, maxWidth: 440, marginTop: 14 }}>
                Sua instituição não precisa provar que é séria.
                O certificado faz isso por você — em menos de dois segundos, para qualquer pessoa no mundo.
              </p>
            </FadeIn>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {problems.map((p, i) => (
              <FadeIn key={i} delay={i * 0.12} direction="right" logLabel={`problema-${i}`}>
                <SpotlightCard>
                  <div style={{
                    padding:        "22px 24px",
                    borderRadius:   14,
                    border:         "1px solid rgba(248,113,113,0.1)",
                    background:     "rgba(248,113,113,0.03)",
                    display:        "flex",
                    gap:            16,
                    alignItems:     "flex-start",
                    transition:     "border-color 0.3s",
                  }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: 6 }}>{p.title}</p>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{p.desc}</p>
                    </div>
                  </div>
                </SpotlightCard>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Divisor com glow */}
      <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.15), transparent)" }} />

      {/* ══════════════════════════════════════════════════════
          SEÇÃO 3 — CERTIFICADO + SOLUÇÃO (visual + texto mínimo)
      ══════════════════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "120px 40px", maxWidth: 1200, margin: "0 auto", zIndex: 5 }}>
        <div className="section-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>

          {/* Certificado — marca d'água grande */}
          <FadeIn logLabel="certificado-preview" direction="left">
            <CertificatePreview />
          </FadeIn>

          {/* Texto mínimo — 3 pontos, não 8 */}
          <FadeIn logLabel="solucao-header" direction="right">
            <p style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(16,185,129,0.5)", fontFamily: "monospace", marginBottom: 20, textTransform: "uppercase" }}>
              — O produto
            </p>
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 46px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.025em", marginBottom: 24 }}>
              O certificado que a sua instituição{" "}
              <span style={{ color: TOKENS.greenBright }}>sempre quis emitir.</span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[
                { n: "01", text: "Identidade 100% exclusiva da sua marca" },
                { n: "02", text: "Verificável publicamente em menos de 2 segundos" },
                { n: "03", text: "Impossível de falsificar — garantido pela matemática" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(16,185,129,0.4)", flexShrink: 0, marginTop: 3 }}>{item.n}</span>
                  <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SEÇÃO 4 — IMAGEM INFRAESTRUTURA GLOBAL (fullwidth)
          Imagem fala por si — texto mínimo sobreposto
      ══════════════════════════════════════════════════════ */}
      <InfrastructureSection />

      {/* ══════════════════════════════════════════════════════
          SEÇÃO 5 — MÉTRICAS (4 números — impacto imediato)
      ══════════════════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "80px 40px", zIndex: 5 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="section-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "rgba(255,255,255,0.04)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            {stats.map((stat, i) => (
              <FadeIn key={i} delay={i * 0.1} logLabel={`stat-${stat.label}`}>
                <div
                  style={{ background: TOKENS.bg, padding: "40px 32px", textAlign: "center", transition: "background 0.3s", cursor: "default" }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(16,185,129,0.03)"}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = TOKENS.bg}
                >
                  <div style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 800, color: TOKENS.greenBright, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, marginBottom: 12 }}>
                    <CountUp to={stat.value} suffix={stat.suffix} />
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace" }}>{stat.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.15), transparent)" }} />

      {/* ══════════════════════════════════════════════════════
          SEÇÃO 7.5 — VÍDEO ATMOSFÉRICO
          nexa-atmosphere.mp4 — fullscreen, parallax, texto sobreposto
          ✅ React 18 Strict Mode safe (videoRef para log único)
      ══════════════════════════════════════════════════════ */}
      <AtmosphereSection />

      <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.15), transparent)" }} />

      {/* ══════════════════════════════════════════════════════
          SEÇÃO 8 — CTA FINAL (Impacto emocional máximo)
      ══════════════════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "160px 24px", textAlign: "center", zIndex: 5, overflow: "hidden" }}>

        {/* Glow central massivo */}
        <div style={{
          position:   "absolute",
          left:       "50%", top: "50%",
          transform:  "translate(-50%, -50%)",
          width:      900, height: 500,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(16,185,129,0.1) 0%, transparent 65%)",
          filter:     "blur(80px)",
          pointerEvents: "none",
        }} />

        {/* Rings de glow */}
        {[200, 350, 500].map((size, i) => (
          <div
            key={i}
            style={{
              position:   "absolute",
              left:       "50%", top: "50%",
              transform:  "translate(-50%, -50%)",
              width:      size, height: size,
              borderRadius: "50%",
              border:     "1px solid rgba(16,185,129,0.06)",
              animation:  `pulse-ring ${3 + i * 1.5}s ease-out infinite`,
              animationDelay: `${i * 0.8}s`,
              pointerEvents: "none",
            }}
          />
        ))}

        <FadeIn logLabel="cta-final" direction="scale">
          <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "rgba(16,185,129,0.5)", fontFamily: "monospace", marginBottom: 28, textTransform: "uppercase" }}>
            — Pronto para começar
          </p>

          <h2 className="cta-headline" style={{
            fontSize:      "clamp(30px, 6vw, 72px)",
            fontWeight:    800,
            letterSpacing: "-0.03em",
            lineHeight:    1.02,
            marginBottom:  32,
            maxWidth:      800,
            margin:        "0 auto 28px",
          }}>
            Sua instituição merece certificados
            <br />
            <span style={{ color: TOKENS.greenBright }}>que ninguém consegue falsificar.</span>
          </h2>

          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.35)", maxWidth: 500, margin: "0 auto 52px", lineHeight: 1.75 }}>
            Fale com nosso time. Em 48 horas sua operação entra no ar
            com identidade exclusiva, criptografia SHA-256 e suporte dedicado.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <MagneticButton
              onClick={() => { logger.event("CTA", "Final → WhatsApp"); window.open("https://wa.me/5519982714815", "_blank"); }}
              style={{
                padding:    "16px 40px", borderRadius: 12,
                background: "#10b981", color: "#000",
                fontWeight: 700, fontSize: 15, cursor: "pointer",
                border:     "none", letterSpacing: "0.02em",
                fontFamily: "'Syne', system-ui, sans-serif",
                boxShadow:  "0 0 60px rgba(16,185,129,0.4), 0 0 120px rgba(16,185,129,0.15)",
              }}
            >
              Solicitar acesso exclusivo →
            </MagneticButton>

            <motion.button
              onClick={() => { logger.interaction("cta-plataforma"); goLogin(); }}
              whileHover={{ borderColor: "rgba(255,255,255,0.25)" }}
              style={{
                padding:        "16px 40px", borderRadius: 12,
                border:         "1px solid rgba(255,255,255,0.1)",
                background:     "transparent",
                color:          "rgba(255,255,255,0.5)",
                fontSize:       15, cursor: "pointer",
                backdropFilter: "blur(12px)",
                fontFamily:     "'Syne', system-ui, sans-serif",
              }}
            >
              Já tenho conta
            </motion.button>
          </div>
        </FadeIn>
      </section>

      <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.04)" }} />

      {/* ══════════════════════════════════════════════════════
          FOOTER — Limpo, premium, sem ruído visual
      ══════════════════════════════════════════════════════ */}
      <footer style={{ position: "relative", zIndex: 5, padding: "60px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>

          {/* Brand */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width:      28, height: 28, borderRadius: 8,
                background: "rgba(16,185,129,0.1)",
                border:     "1px solid rgba(16,185,129,0.2)",
                display:    "flex", alignItems: "center", justifyContent: "center",
                fontSize:   13,
              }}>⚡</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>NexaSpark</span>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.7, maxWidth: 260 }}>
              Infraestrutura SaaS para emissão e validação de certificados com criptografia SHA-256. Designed for institutions that take trust seriously.
            </p>
          </div>

          {/* Links */}
          <div style={{ display: "flex", gap: 48 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 4 }}>Plataforma</p>
              {[
                { label: "Acessar",    fn: goLogin    },
                { label: "Cadastrar",  fn: goRegister },
                { label: "Contato",    fn: () => window.open("https://wa.me/5519982714815", "_blank") },
              ].map(link => (
                <button
                  key={link.label}
                  onClick={() => { logger.interaction(`footer-${link.label}`); link.fn(); }}
                  style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Syne', system-ui, sans-serif", transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"}
                >
                  {link.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 4 }}>Legal</p>
              {[
                { label: "Privacidade", href: "/privacy" },
                { label: "Termos de uso", href: "/terms" },
              ].map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => logger.interaction(`footer-${link.label}`)}
                  style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.7)"}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.3)"}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>© {new Date().getFullYear()} NexaSpark. Todos os direitos reservados.</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.1)", fontFamily: "monospace" }}>Infraestrutura digital com integridade criptográfica</p>
        </div>
      </footer>

    </div>
  );
}