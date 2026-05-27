"use client";

// ============================================================
// 🏢 NexaSpark — /verificar/[codigo]/page.tsx v4.0
// LUXURY VERIFICATION CEREMONY
//
// ✅ v3 — mantido intacto:
//   Canvas scanner line, partículas, grid
//   HashDNA SHA-256 visual
//   Contador animado de verificações
//   Relógio em tempo real
//   Selo holográfico com rings pulsantes
//   Copy code com animação de check
//   Share via Web Share API
//   Latência semafórica
//   Logger enterprise completo
//
// ✅ v4.0 — ADIÇÕES (zero remoção):
//   🚫 Estado 410 Gone — certificado revogado
//      Banner vermelho com motivo da revogação
//      Diferente do 404 (não encontrado) — revogado = existiu
//   📄 CTA Download elevado — mais presença, mais confiança
//      Badge "PDF disponível" antes do botão
//      Animação de hover com shimmer
//      Nunca some se pdf_url existe (e sempre existe após emissão)
//   👤 Hero refinado — nome do participante com mais peso visual
//      Linha decorativa lateral verde no nome
//      Curso em destaque na hero, não apenas nos dados
//   🎨 Shimmer no botão de download
//   📱 Responsividade melhorada em mobile
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Verification v4
// ============================================================
const LOG_PREFIX = "[NexaSpark:Verificar:v4]";

const logger = {
  info:    (scope: string, msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} ℹ️  [${scope}]%c ${msg}`, "color:#60a5fa;font-weight:bold;", "color:inherit;", data ?? ""),
  success: (scope: string, msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} ✅ [${scope}]%c ${msg}`, "color:#34d399;font-weight:bold;", "color:inherit;", data ?? ""),
  warn:    (scope: string, msg: string, data?: any) =>
    console.warn(`%c${LOG_PREFIX} ⚠️  [${scope}]%c ${msg}`, "color:#fbbf24;font-weight:bold;", "color:inherit;", data ?? ""),
  error:   (scope: string, msg: string, data?: any) =>
    console.error(`%c${LOG_PREFIX} ❌ [${scope}]%c ${msg}`, "color:#f87171;font-weight:bold;", "color:inherit;", data ?? ""),
  perf:    (scope: string, label: string, ms: number) =>
    console.log(`%c${LOG_PREFIX} ⏱️  [${scope}]%c ${label} — ${ms.toFixed(2)}ms`, "color:#a78bfa;font-weight:bold;", "color:inherit;"),
  event:   (scope: string, action: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🎯 [${scope}]%c ACTION → ${action}`, "color:#f472b6;font-weight:bold;", "color:inherit;", data ?? ""),
  sec:     (msg: string, data?: any) =>
    console.warn(`%c${LOG_PREFIX} 🚨 [SEC]%c ${msg}`, "color:#ef4444;font-weight:bold;", "color:inherit;", data ?? ""),
  mount:   (c: string) =>
    console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}> renderizado`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) =>
    console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}> destruído`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
  canvas:  (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🖼️  [CANVAS]%c ${msg}`, "color:#93c5fd;font-weight:bold;", "color:inherit;", data ?? ""),
  hash:    (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🔐 [HASH]%c ${msg}`, "color:#c084fc;font-weight:bold;", "color:inherit;", data ?? ""),
  anim:    (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🎨 [ANIM]%c ${msg}`, "color:#f9a8d4;font-weight:bold;", "color:inherit;", data ?? ""),
  verify:  (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🛡️  [VERIFY]%c ${msg}`, "color:#6ee7b7;font-weight:bold;", "color:inherit;", data ?? ""),
  revoked: (msg: string, data?: any) =>
    console.warn(`%c${LOG_PREFIX} 🚫 [REVOKED]%c ${msg}`, "color:#f87171;font-weight:bold;", "color:inherit;", data ?? ""),
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================================
// 📋 TIPOS
// ============================================================
interface CertificateData {
  valido:       boolean;
  participante: { nome: string; cpf: string };
  curso: {
    nome:          string;
    carga_horaria: number;
    data_emissao:  string;
    instrutor?:    string;
  };
  verificacao: {
    codigo:             string;
    hash_preview:       string | null;
    total_verificacoes: number;
    verificado_em:      string;
  };
  pdf_url: string | null;
}

// ✅ v4: tipo para certificado revogado (410 Gone)
interface RevokedData {
  valido:             boolean;
  revogado:           boolean;
  revoked_at:         string;
  revoked_reason:     string;
  codigo_verificacao: string;
}

type PageState = "loading" | "scanning" | "valid" | "invalid" | "revoked" | "error";

// ============================================================
// 🔧 HELPERS
// ============================================================
function formatDate(iso: string): string {
  try {
    const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    logger.warn("FORMAT", "Falha ao formatar data", { iso });
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return iso; }
}

function getLatencyColor(ms: number): string {
  if (ms < 500)  return "#34d399";
  if (ms < 1500) return "#fbbf24";
  return "#f87171";
}

// ============================================================
// 🖼️  CANVAS — Scanner de segurança no loading
// ============================================================
function ScannerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    logger.canvas("Scanner canvas iniciado");

    let animId: number;
    let W = 0, H = 0;
    let scanY = 0;
    let scanSpeed = 1.5;
    let frameCount = 0;

    type Particle = { x: number; y: number; vx: number; vy: number; alpha: number; r: number; pulse: number };
    const particles: Particle[] = [];
    const PARTICLE_COUNT = 40;

    function resize() {
      W = canvas!.width  = canvas!.offsetWidth;
      H = canvas!.height = canvas!.offsetHeight;
      scanY = 0;
      logger.canvas("Scanner redimensionado", { W, H });
    }

    function spawnParticle(): Particle {
      return {
        x:     Math.random() * W,
        y:     Math.random() * H,
        vx:    (Math.random() - 0.5) * 0.4,
        vy:    (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.3 + 0.05,
        r:     Math.random() * 1.2 + 0.3,
        pulse: Math.random() * Math.PI * 2,
      };
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(spawnParticle());

    function draw() {
      frameCount++;
      ctx!.clearRect(0, 0, W, H);

      ctx!.strokeStyle = "rgba(16,185,129,0.04)";
      ctx!.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x <= W; x += gridSize) {
        ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, H); ctx!.stroke();
      }
      for (let y = 0; y <= H; y += gridSize) {
        ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(W, y); ctx!.stroke();
      }

      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        p.pulse += 0.02;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

        const a = p.alpha * (0.5 + 0.5 * Math.sin(p.pulse));
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(16,185,129,${a})`;
        ctx!.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y); ctx!.lineTo(q.x, q.y);
            ctx!.strokeStyle = `rgba(16,185,129,${0.08 * (1 - dist / 100)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      });

      scanY += scanSpeed;
      if (scanY > H + 20) { scanY = -20; }

      const grad = ctx!.createLinearGradient(0, scanY - 30, 0, scanY + 30);
      grad.addColorStop(0,   "rgba(16,185,129,0)");
      grad.addColorStop(0.4, "rgba(16,185,129,0.04)");
      grad.addColorStop(0.5, "rgba(16,185,129,0.15)");
      grad.addColorStop(0.6, "rgba(16,185,129,0.04)");
      grad.addColorStop(1,   "rgba(16,185,129,0)");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, scanY - 30, W, 60);

      ctx!.beginPath();
      ctx!.moveTo(0, scanY);
      ctx!.lineTo(W, scanY);
      ctx!.strokeStyle = "rgba(16,185,129,0.6)";
      ctx!.lineWidth = 1;
      ctx!.stroke();

      const gridSize2 = 40;
      for (let x = 0; x <= W; x += gridSize2) {
        ctx!.beginPath();
        ctx!.arc(x, scanY, 2, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(16,185,129,0.6)";
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      logger.canvas("Scanner destruído");
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.8 }}
    />
  );
}

// ============================================================
// 🔐 VISUALIZAÇÃO DO HASH SHA-256 — Barras de DNA
// ============================================================
function HashDNA({ hash }: { hash: string }) {
  const chars = hash.replace(/\./g, "").toUpperCase().split("").slice(0, 32);

  useEffect(() => {
    logger.hash("HashDNA renderizado", { hashLength: hash.length, chars: chars.length });
  }, [hash]);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 28, marginTop: 8 }}>
      {chars.map((char, i) => {
        const val = parseInt(char, 16) || 1;
        const height = 4 + (val / 15) * 20;
        const hue = (val * 22) % 60 + 140;
        return (
          <motion.div
            key={i}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height, opacity: 0.7 }}
            transition={{ duration: 0.3, delay: i * 0.02, ease: "easeOut" }}
            style={{
              width: 4, borderRadius: 2, flexShrink: 0,
              background: `hsl(${hue}, 70%, 55%)`,
            }}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// ⏰ CLOCK em tempo real
// ============================================================
function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ============================================================
// 🔢 CONTADOR ANIMADO
// ============================================================
function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(step);
      else setValue(target);
    };
    requestAnimationFrame(step);
  }, [target]);
  return value;
}

// ============================================================
// 🏅 SELO HOLOGRÁFICO
// ============================================================
function HolographicSeal({ valid, revoked = false }: { valid: boolean; revoked?: boolean }) {
  const color = valid ? "#10b981" : revoked ? "#f59e0b" : "#ef4444";
  const colorAlpha = valid ? "rgba(16,185,129," : revoked ? "rgba(245,158,11," : "rgba(239,68,68,";

  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `1px solid ${colorAlpha}0.3)` }}
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        style={{ position: "absolute", inset: -3, borderRadius: "50%", border: `1px solid ${colorAlpha}0.4)` }}
      />
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: valid
          ? "radial-gradient(circle at 35% 35%, rgba(16,185,129,0.2), rgba(16,185,129,0.06))"
          : revoked
          ? "radial-gradient(circle at 35% 35%, rgba(245,158,11,0.2), rgba(245,158,11,0.06))"
          : "radial-gradient(circle at 35% 35%, rgba(239,68,68,0.2), rgba(239,68,68,0.06))",
        border: `1.5px solid ${colorAlpha}0.35)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 40px ${colorAlpha}0.15), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}>
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {valid ? (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <motion.polyline
                points="9 12 11 14 15 10"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.8, ease: "easeOut" }}
                strokeWidth="2"
              />
            </svg>
          ) : revoked ? (
            // ✅ v4: ícone de escudo barrado para certificado revogado
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="8" y1="8" x2="16" y2="16"/>
            </svg>
          ) : (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================
// 📊 DATA ROW com animação stagger
// ============================================================
function DataRow({
  label, value, mono = false, accent = false, highlight = false, delay = 0,
}: {
  label: string; value: string | React.ReactNode;
  mono?: boolean; accent?: boolean; highlight?: boolean; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 24, padding: "13px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: highlight ? "rgba(16,185,129,0.02)" : "transparent",
        marginLeft: highlight ? -20 : 0,
        paddingLeft: highlight ? 20 : 0,
        borderRadius: highlight ? "4px 0 0 4px" : 0,
      }}
    >
      <span style={{
        fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em",
        color: "rgba(255,255,255,0.25)", fontWeight: 500,
        flexShrink: 0, marginTop: 2, userSelect: "none",
        fontFamily: "monospace",
      }}>
        {label}
      </span>
      <span style={{
        textAlign: "right", lineHeight: 1.5,
        fontSize: mono ? 11 : 13,
        fontFamily: mono ? "monospace" : "'Syne', system-ui, sans-serif",
        color: accent ? "#ffffff" : mono ? "#34d399" : "rgba(255,255,255,0.75)",
        fontWeight: accent ? 700 : mono ? 400 : 500,
        wordBreak: "break-all",
      }}>
        {value}
      </span>
    </motion.div>
  );
}

// ============================================================
// 🏷️  SECTION LABEL
// ============================================================
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 4px" }}>
      <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)", fontWeight: 500, whiteSpace: "nowrap", fontFamily: "monospace" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
    </div>
  );
}

// ============================================================
// 🏠 VERIFICAR PAGE
// ============================================================
export default function VerificarPage() {
  const params  = useParams();
  const router  = useRouter();
  const shouldReduce = useReducedMotion();
  const clock   = useClock();

  const codigo = ((params?.codigo as string) || "").toUpperCase().trim();
  const t0Ref  = useRef(performance.now());

  const [state,   setState]   = useState<PageState>("loading");
  const [cert,    setCert]    = useState<CertificateData | null>(null);
  const [revoked, setRevoked] = useState<RevokedData | null>(null);   // ✅ v4
  const [errMsg,  setErrMsg]  = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const [copied,  setCopied]  = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dlHover, setDlHover] = useState(false); // ✅ v4: hover no botão de download

  const verCount = useCountUp(cert?.verificacao.total_verificacoes ?? 0, 1000);

  useEffect(() => {
    logger.mount("VerificarPage v4");
    logger.info("INIT", "Página de verificação inicializada", {
      codigo, apiUrl: API_URL, timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 80) : "SSR",
      version: "4.0.0",
    });
    return () => {
      logger.unmount("VerificarPage v4");
      logger.perf("PAGE", "Lifecycle total", performance.now() - t0Ref.current);
    };
  }, []);

  // ── VERIFICAÇÃO PRINCIPAL ────────────────────────────────
  useEffect(() => {
    if (!codigo) {
      logger.error("VERIFY", "Código ausente na URL");
      setState("error");
      setErrMsg("Código de verificação não informado na URL.");
      return;
    }

    if (codigo.length < 8 || codigo.length > 64) {
      logger.sec("Código com formato suspeito", { codigo, length: codigo.length });
      setState("invalid");
      return;
    }

    t0Ref.current = performance.now();
    setState("loading");

    logger.verify("Iniciando verificação", { codigo, api: API_URL, timestamp: new Date().toISOString() });

    const minLoadTime = new Promise(resolve => setTimeout(resolve, 1800));

    const fetchCert = fetch(`${API_URL}/api/certificates/verify/${codigo}`, {
      headers: { "Accept": "application/json" },
    }).then(async res => {
      const ms   = performance.now() - t0Ref.current;
      const data = await res.json();

      logger.perf("VERIFY", "API respondeu", ms);
      logger.info("VERIFY", "Payload recebido", {
        status: res.status, ok: res.ok,
        success: data?.success, valido: data?.data?.valido,
        // ✅ v4: loga se é revogado
        revogado: data?.data?.revogado ?? false,
      });

      return { ms, data, ok: res.ok, status: res.status };
    });

    Promise.all([minLoadTime, fetchCert])
      .then(([, { ms, data, ok, status }]) => {
        setLatency(ms);

        // ✅ v4: trata 410 Gone — certificado revogado
        if (status === 410) {
          logger.revoked("Certificado REVOGADO — exibindo estado 410", {
            revoked_at:     data?.data?.revoked_at,
            revoked_reason: data?.data?.revoked_reason,
            codigo,
          });
          setRevoked(data?.data ?? null);
          setState("revoked");
          return;
        }

        if (!ok || !data.success) {
          logger.warn("VERIFY", "Certificado não encontrado", {
            status: ok ? "ok" : "not-ok",
            message: data?.error,
          });
          setState("invalid");
          return;
        }

        setCert(data.data);
        setState("scanning");

        setTimeout(() => {
          setState("valid");
          setMounted(true);
          logger.success("VERIFY", "══ CERTIFICADO VÁLIDO ══", {
            participante: data.data.participante.nome,
            curso:        data.data.curso.nome,
            verificacoes: data.data.verificacao.total_verificacoes,
            latencyMs:    ms.toFixed(2),
            // ✅ v4: loga se pdf_url está presente
            pdfDisponivel: !!data.data.pdf_url,
          });
          logger.anim("Animações de reveal disparadas");
        }, 1200);
      })
      .catch((err: Error) => {
        const ms = performance.now() - t0Ref.current;
        setLatency(ms);
        logger.error("VERIFY", "Erro de rede", { message: err.message, latencyMs: ms.toFixed(2), api: API_URL });
        setState("error");
        setErrMsg("Não foi possível conectar ao servidor. Tente novamente.");
      });
  }, [codigo]);

  // ── COPY CODE ────────────────────────────────────────────
  const handleCopyCode = useCallback(() => {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo).then(() => {
      setCopied(true);
      logger.event("UX", "Código copiado", { codigo });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [codigo]);

  // ── SHARE ────────────────────────────────────────────────
  const handleShare = useCallback(() => {
    const url = `https://nexaspark.com.br/verificar/${codigo}`;
    logger.event("UX", "Share acionado", { url });
    if (typeof navigator.share !== "undefined") {
      navigator.share({ title: "Certificado NexaSpark", text: `Verifique: ${url}`, url });
    } else {
      navigator.clipboard.writeText(url);
      logger.event("UX", "URL copiada (fallback clipboard)", { url });
    }
  }, [codigo]);

  // ============================================================
  // RENDER: LOADING + SCANNING
  // ============================================================
  if (state === "loading" || state === "scanning") {
    const isScanning = state === "scanning";

    return (
      <div style={{
        minHeight: "100vh", background: "#050810",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
        fontFamily: "'Syne', system-ui, sans-serif",
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');`}</style>

        <ScannerCanvas />

        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(16,185,129,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}
        >
          <div style={{ position: "relative", width: 80, height: 80 }}>
            {[1, 2, 3].map(i => (
              <motion.div
                key={i}
                style={{ position: "absolute", inset: -(i * 12), borderRadius: "50%", border: "1px solid rgba(16,185,129,0.15)" }}
                animate={{ scale: [1, 1.05, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
              />
            ))}

            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 80 80">
              <motion.circle cx="40" cy="40" r="36" fill="none" stroke="rgba(16,185,129,0.12)" strokeWidth="1.5" />
              <motion.circle
                cx="40" cy="40" r="36"
                fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"
                strokeDasharray="226"
                animate={{ strokeDashoffset: [226, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              />
            </svg>

            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  {isScanning && (
                    <motion.polyline
                      points="9 12 11 14 15 10"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      strokeWidth="2"
                    />
                  )}
                </svg>
              </motion.div>
            </div>
          </div>

          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            <motion.p
              key={state}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}
            >
              {isScanning ? "Certificado localizado" : "Verificando autenticidade"}
            </motion.p>
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0, fontFamily: "monospace" }}>
              {isScanning ? "Autenticando assinatura digital..." : `${codigo.substring(0, 8)}...`}
            </p>

            <div style={{ width: 200, height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 1, marginTop: 8, overflow: "hidden" }}>
              <motion.div
                style={{ height: "100%", background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: 1 }}
                animate={isScanning
                  ? { width: "100%" }
                  : { width: ["0%", "75%", "60%", "85%"] }
                }
                transition={isScanning
                  ? { duration: 1.2, ease: "easeOut" }
                  : { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  // ✅ v4: RENDER: REVOGADO (410 Gone)
  // ============================================================
  if (state === "revoked" && revoked) {
    return (
      <div style={{
        minHeight: "100vh", background: "#050810",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "24px", position: "relative", overflow: "hidden",
        fontFamily: "'Syne', system-ui, sans-serif",
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');`}</style>

        {/* Glow âmbar — revogado não é erro, é estado intencional */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(245,158,11,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03, backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 420 }}
        >
          {/* Card principal */}
          <div style={{
            borderRadius: 20,
            border: "1px solid rgba(245,158,11,0.12)",
            background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px rgba(0,0,0,0.8), 0 0 80px rgba(245,158,11,0.04)",
            overflow: "hidden",
          }}>
            {/* Faixa superior âmbar */}
            <div style={{ height: 2, background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.6), transparent)" }} />

            <div style={{ padding: "32px 32px 28px" }}>
              {/* Header com selo */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
                <HolographicSeal valid={false} revoked={true} />
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b" }} />
                    <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "#f59e0b", fontWeight: 500, fontFamily: "monospace" }}>
                      Certificado revogado
                    </span>
                  </div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: "0 0 4px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                    Este certificado foi cancelado
                  </h1>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0, fontFamily: "monospace" }}>
                    Código: {revoked.codigo_verificacao}
                  </p>
                </div>
              </div>

              {/* Motivo da revogação */}
              <div style={{
                padding: "14px 16px",
                borderRadius: 10,
                background: "rgba(245,158,11,0.04)",
                border: "1px solid rgba(245,158,11,0.1)",
                marginBottom: 20,
              }}>
                <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(245,158,11,0.5)", fontFamily: "monospace", margin: "0 0 6px" }}>
                  Motivo
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>
                  {revoked.revoked_reason || "Revogado pelo emissor"}
                </p>
              </div>

              {/* Data da revogação */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
                  Revogado em
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
                  {formatDateTime(revoked.revoked_at)}
                </span>
              </div>

              {/* Explicação */}
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.7, margin: "16px 0 0", textAlign: "center" }}>
                Um certificado revogado não é mais válido como comprovante. Entre em contato com o emissor para mais informações.
              </p>
            </div>
          </div>

          {/* Botão voltar */}
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <button
              onClick={() => { logger.event("NAV", "Voltar → home (revogado)"); router.push("/"); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Voltar para NexaSpark
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  // RENDER: INVÁLIDO / ERRO
  // ============================================================
  if (state === "error" || state === "invalid") {
    return (
      <div style={{
        minHeight: "100vh", background: "#050810",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "24px", position: "relative", overflow: "hidden",
        fontFamily: "'Syne', system-ui, sans-serif",
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');`}</style>

        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(239,68,68,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03, backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 380, textAlign: "center" }}
        >
          <HolographicSeal valid={false} />

          <div style={{ marginTop: 24, marginBottom: 16 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 16 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171" }} />
              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "#f87171", fontWeight: 500, fontFamily: "monospace" }}>
                {state === "invalid" ? "Não autenticado" : "Falha na verificação"}
              </span>
            </div>

            <h1 style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
              {state === "invalid" ? "Certificado não encontrado" : "Erro de conexão"}
            </h1>

            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, margin: "0 0 20px", maxWidth: 300, marginLeft: "auto", marginRight: "auto" }}>
              {state === "invalid"
                ? "O código informado não corresponde a nenhum certificado em nossa base de dados. Verifique se digitou corretamente."
                : errMsg}
            </p>
          </div>

          {codigo && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "monospace" }}>Código:</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{codigo}</span>
            </div>
          )}

          {latency && (
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", fontFamily: "monospace", marginBottom: 24 }}>
              latência: {latency.toFixed(0)}ms
            </p>
          )}

          <button
            onClick={() => { logger.event("NAV", "Voltar → home"); router.push("/"); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#34d399", fontSize: 13, fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Voltar para NexaSpark
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  // RENDER: VÁLIDO — A cerimônia principal
  // ============================================================
  const latencyColor = latency ? getLatencyColor(latency) : "#34d399";

  return (
    <div style={{
      minHeight: "100vh", background: "#050810",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "32px 16px 48px", position: "relative", overflow: "hidden",
      fontFamily: "'Syne', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0.3} }
        @keyframes float { 0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)} }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.2); border-radius: 2px; }
      `}</style>

      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.09) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />

      {!shouldReduce && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              style={{
                position: "absolute",
                width: 200 + Math.random() * 200, height: 200 + Math.random() * 200,
                left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                background: "radial-gradient(circle, rgba(16,185,129,0.025) 0%, transparent 70%)",
                filter: "blur(40px)", borderRadius: "50%",
              }}
              animate={{
                x: [0, (Math.random() - 0.5) * 60, 0],
                y: [0, (Math.random() - 0.5) * 60, 0],
              }}
              transition={{ duration: 8 + Math.random() * 6, repeat: Infinity, ease: "easeInOut", delay: i * 1.5 }}
            />
          ))}
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          position: "relative", zIndex: 10,
          width: "100%", maxWidth: 560,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <button
          onClick={() => { logger.event("NAV", "Logo → home"); router.push("/"); }}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, animation: "float 3s ease-in-out infinite" }}>⚡</div>
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>NexaSpark</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.1)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", animation: "blink 1s ease infinite" }} />
            <span style={{ fontSize: 10, color: "rgba(16,185,129,0.7)", fontFamily: "monospace", letterSpacing: "0.05em" }}>{clock}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", animation: "blink 2s ease infinite" }} />
            <span style={{ fontSize: 9, color: "rgba(16,185,129,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "monospace" }}>Sistema ativo</span>
          </div>
        </div>
      </motion.header>

      {/* ── CARD PRINCIPAL ─────────────────────────────────────── */}
      <motion.main
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 560 }}
      >
        <div style={{
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
          background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px rgba(0,0,0,0.8), 0 0 80px rgba(16,185,129,0.05)",
        }}>

          {/* ✅ v4: Faixa superior verde — marca visual de autenticidade */}
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.8), transparent)" }} />

          {/* ── HERO SECTION ─────────────────────────────────── */}
          <div style={{ padding: "32px 32px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
              <HolographicSeal valid={true} />

              <div style={{ flex: 1, paddingTop: 4 }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 12 }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", animation: "blink 2s ease infinite" }} />
                  <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "#34d399", fontWeight: 500, fontFamily: "monospace" }}>Certificado autêntico e verificado</span>
                </motion.div>

                {/* ✅ v4: Nome com mais peso visual — linha lateral decorativa */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 6 }}
                >
                  <div style={{ width: 2, height: "100%", minHeight: 28, background: "linear-gradient(180deg, #10b981, transparent)", borderRadius: 2, flexShrink: 0, marginTop: 3 }} />
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: "white", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                    {cert!.participante.nome}
                  </h1>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", margin: "0 0 6px" }}
                >
                  CPF: {cert!.participante.cpf}
                </motion.p>

                {/* ✅ v4: Nome do curso em destaque já no hero */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  style={{ fontSize: 12, color: "rgba(16,185,129,0.6)", fontWeight: 500, margin: 0, letterSpacing: "0.01em" }}
                >
                  {cert!.curso.nome}
                </motion.p>
              </div>
            </div>

            {/* Latência semafórica */}
            {latency && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", width: "fit-content" }}
              >
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: latencyColor }} />
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                  API respondeu em <span style={{ color: latencyColor }}>{latency.toFixed(0)}ms</span>
                </span>
              </motion.div>
            )}
          </div>

          {/* ── DADOS DO CERTIFICADO ─────────────────────────── */}
          <div style={{ padding: "0 32px" }}>
            <SectionLabel>Dados do certificado</SectionLabel>
            <DataRow label="Curso"           value={cert!.curso.nome}                         accent highlight delay={0.5} />
            <DataRow label="Carga horária"   value={`${cert!.curso.carga_horaria} horas`}    delay={0.55} />
            <DataRow label="Data de emissão" value={formatDate(cert!.curso.data_emissao)}     delay={0.6}  />
            {cert!.curso.instrutor && (
              <DataRow label="Instrutor"     value={cert!.curso.instrutor}                    delay={0.65} />
            )}
          </div>

          {/* ── DADOS DE VERIFICAÇÃO ─────────────────────────── */}
          <div style={{ padding: "0 32px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 4 }}>
            <SectionLabel>Dados de verificação</SectionLabel>

            {/* Código com copy */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.7 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.25)", fontWeight: 500, flexShrink: 0, fontFamily: "monospace" }}>Código</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#34d399", fontFamily: "monospace" }}>{cert!.verificacao.codigo}</span>
                <button
                  onClick={handleCopyCode}
                  style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#34d399" : "rgba(255,255,255,0.25)", transition: "color 0.2s", padding: 2 }}
                  title="Copiar código"
                >
                  <AnimatePresence mode="wait">
                    {copied ? (
                      <motion.svg key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </motion.svg>
                    ) : (
                      <motion.svg key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </motion.div>

            {/* Hash SHA-256 com visualização DNA */}
            {cert!.verificacao.hash_preview && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.75 }}
                style={{ padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.25)", fontWeight: 500, fontFamily: "monospace", flexShrink: 0 }}>SHA-256</span>
                  <span style={{ fontSize: 10, color: "#34d399", fontFamily: "monospace", textAlign: "right", wordBreak: "break-all" }}>{cert!.verificacao.hash_preview}...</span>
                </div>
                <HashDNA hash={cert!.verificacao.hash_preview} />
              </motion.div>
            )}

            {/* Contador de verificações animado */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.8 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.25)", fontWeight: 500, fontFamily: "monospace", flexShrink: 0 }}>Verificações</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 500, fontFamily: "monospace" }}>
                {verCount}ª verificação
              </span>
            </motion.div>

            <DataRow label="Verificado em" value={formatDateTime(cert!.verificacao.verificado_em)} delay={0.85} />
          </div>

          {/* ── ✅ v4: AÇÕES — CTA elevado ───────────────────── */}
          <div style={{ padding: "20px 32px 28px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>

            {/* ✅ v4: Download PDF — CTA principal elevado */}
            {cert!.pdf_url && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                {/* ✅ v4: Badge "PDF disponível" acima do botão — reforça confiança */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(16,185,129,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span style={{ fontSize: 9, color: "rgba(16,185,129,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "monospace" }}>PDF disponível</span>
                  </div>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
                </div>

                {/* ✅ v4: Botão com shimmer no hover */}
                <motion.a
                  href={cert!.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logger.event("UX", "Download PDF clicado", { codigo })}
                  onMouseEnter={() => setDlHover(true)}
                  onMouseLeave={() => setDlHover(false)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    background: dlHover
                      ? "linear-gradient(135deg, #0d9f6e, #059669, #0d9f6e)"
                      : "linear-gradient(135deg, #10b981, #059669)",
                    backgroundSize: dlHover ? "200% auto" : "100% auto",
                    animation: dlHover ? "shimmer 1.5s linear infinite" : "none",
                    color: "white", fontWeight: 700, padding: "15px 0",
                    borderRadius: 12, fontSize: 14, textDecoration: "none",
                    transition: "all 0.25s",
                    boxShadow: dlHover
                      ? "0 8px 32px rgba(16,185,129,0.4), 0 0 0 1px rgba(16,185,129,0.2)"
                      : "0 4px 24px rgba(16,185,129,0.25)",
                    transform: dlHover ? "translateY(-2px)" : "translateY(0)",
                    letterSpacing: "0.01em",
                  }}
                >
                  {/* Ícone de download com seta */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Baixar certificado em PDF
                  {/* ✅ v4: Indicador de abertura em nova aba */}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: -2 }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </motion.a>
              </motion.div>
            )}

            {/* Compartilhar */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: cert!.pdf_url ? 1.0 : 0.95 }}
              onClick={handleShare}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                color: "rgba(255,255,255,0.6)", padding: "12px 0",
                borderRadius: 12, fontSize: 13, cursor: "pointer",
                transition: "all 0.2s", fontFamily: "'Syne', system-ui, sans-serif",
                fontWeight: 500,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.18)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Compartilhar verificação
            </motion.button>
          </div>
        </div>

        {/* ── RODAPÉ ───────────────────────────────────────────── */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          style={{ marginTop: 20, textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", margin: 0, fontFamily: "monospace" }}>
              Verificado por NexaSpark · Certificação Digital
            </p>
          </div>
          <p style={{ color: "rgba(255,255,255,0.08)", fontSize: 10, fontFamily: "monospace", margin: 0 }}>
            nexaspark.com.br/verificar/{codigo}
          </p>
        </motion.footer>
      </motion.main>
    </div>
  );
}