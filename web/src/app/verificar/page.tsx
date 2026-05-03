"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Verification System
//
// Cada evento de verificação é rastreado com precisão:
// — tempo de resposta da API
// — origem do request
// — resultado da verificação
// — interações do usuário
//
// Em produção esses logs alimentam o dashboard de auditoria.
// ============================================================
const LOG_PREFIX = "[NexaSpark:Verificar]";

const logger = {
  info:    (scope: string, msg: string, data?: any) =>
    console.log(   `%c${LOG_PREFIX} ℹ️  [${scope}]%c ${msg}`, "color:#60a5fa;font-weight:bold;", "color:inherit;", data ?? ""),
  success: (scope: string, msg: string, data?: any) =>
    console.log(   `%c${LOG_PREFIX} ✅ [${scope}]%c ${msg}`, "color:#34d399;font-weight:bold;", "color:inherit;", data ?? ""),
  warn:    (scope: string, msg: string, data?: any) =>
    console.warn(  `%c${LOG_PREFIX} ⚠️  [${scope}]%c ${msg}`, "color:#fbbf24;font-weight:bold;", "color:inherit;", data ?? ""),
  error:   (scope: string, msg: string, data?: any) =>
    console.error( `%c${LOG_PREFIX} ❌ [${scope}]%c ${msg}`, "color:#f87171;font-weight:bold;", "color:inherit;", data ?? ""),
  perf:    (scope: string, label: string, ms: number) =>
    console.log(   `%c${LOG_PREFIX} ⏱️  [${scope}]%c ${label} — ${ms.toFixed(2)}ms`, "color:#a78bfa;font-weight:bold;", "color:inherit;"),
  event:   (scope: string, action: string, data?: any) =>
    console.log(   `%c${LOG_PREFIX} 🎯 [${scope}]%c ACTION → ${action}`, "color:#f472b6;font-weight:bold;", "color:inherit;", data ?? ""),
  sec:     (msg: string, data?: any) =>
    console.warn(  `%c${LOG_PREFIX} 🚨 [SECURITY]%c ${msg}`, "color:#f87171;font-weight:bold;", "color:inherit;", data ?? ""),
  mount:   (c: string) =>
    console.log(   `%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}> renderizado`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) =>
    console.log(   `%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}> destruído`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
};

// ============================================================
// 🌐 API BASE URL — Fonte única de verdade
//
// NEXT_PUBLIC_API_URL configurado no Vercel aponta para Railway.
// Fallback para localhost em desenvolvimento local.
// ============================================================
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================================
// 📋 TYPES — Contrato com a API
// Espelha a resposta de GET /api/certificates/verify/:codigo
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

type PageState = "loading" | "valid" | "invalid" | "error";

// ============================================================
// 🔧 HELPERS — Formatação e utilitários
// ============================================================

function formatDate(iso: string): string {
  try {
    // Adiciona T00:00:00 para evitar offset de timezone
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
  } catch {
    return iso;
  }
}

// ============================================================
// 🎨 SUB-COMPONENTES
// ============================================================

// ── Contador animado de verificações ─────────────────────────
function VerificationCounter({ count }: { count: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame: number;
    const start   = performance.now();
    const duration = 800;

    const tick = (now: number) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.round(eased * count));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [count]);

  return <span>{display}</span>;
}

// ── Linha de dado com stagger animation ──────────────────────
function DataRow({
  label,
  value,
  mono   = false,
  accent = false,
  delay  = 0,
}: {
  label:   string;
  value:   string | React.ReactNode;
  mono?:   boolean;
  accent?: boolean;
  delay?:  number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start justify-between gap-6 py-4 border-b border-white/[0.04] last:border-0"
    >
      <span className="text-[10px] uppercase tracking-[0.15em] text-gray-600 font-medium shrink-0 mt-0.5 select-none">
        {label}
      </span>
      <span className={`text-right leading-relaxed ${
        mono   ? "font-mono text-[11px] text-emerald-400 break-all" :
        accent ? "text-sm font-semibold text-white" :
                 "text-sm text-gray-300 font-medium"
      }`}>
        {value}
      </span>
    </motion.div>
  );
}

// ── Linha divisora com label ──────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-1 mt-5 first:mt-0">
      <span className="text-[9px] uppercase tracking-[0.2em] text-gray-700 font-medium select-none whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
  );
}

// ── Partícula de fundo animada ────────────────────────────────
function BackgroundParticles({ valid }: { valid: boolean }) {
  const shouldReduce = useReducedMotion();
  if (shouldReduce) return null;

  const color = valid ? "rgba(52,211,153," : "rgba(248,113,113,";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width:      Math.random() * 300 + 100,
            height:     Math.random() * 300 + 100,
            left:       `${Math.random() * 100}%`,
            top:        `${Math.random() * 100}%`,
            background: `radial-gradient(circle, ${color}0.03) 0%, transparent 70%)`,
            filter:     "blur(40px)",
          }}
          animate={{
            x:       [0, Math.random() * 40 - 20, 0],
            y:       [0, Math.random() * 40 - 20, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: Math.random() * 8 + 6,
            repeat:   Infinity,
            ease:     "easeInOut",
            delay:    i * 1.2,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// 🔍 VERIFICAR PAGE — Main Component
// ============================================================
export default function VerificarPage() {
  const params = useParams();
  const router = useRouter();

  // ⚠️  Normaliza o código para uppercase — garante que
  //     "abc123" e "ABC123" apontem para o mesmo certificado
  const codigo = ((params?.codigo as string) || "").toUpperCase().trim();

  const [state,    setState]    = useState<PageState>("loading");
  const [cert,     setCert]     = useState<CertificateData | null>(null);
  const [errMsg,   setErrMsg]   = useState("");
  const [latency,  setLatency]  = useState<number | null>(null);
  const [copied,   setCopied]   = useState(false);

  const t0Ref = useRef(performance.now());

  // ── Efeito de mount/unmount ──────────────────────────────
  useEffect(() => {
    logger.mount("VerificarPage");
    return () => logger.unmount("VerificarPage");
  }, []);

  // ── Verificação principal ────────────────────────────────
  useEffect(() => {
    if (!codigo) {
      logger.error("VERIFY", "Código ausente na URL");
      setState("error");
      setErrMsg("Código de verificação não informado na URL.");
      return;
    }

    // ⚠️  Validação básica de formato antes de chamar a API
    //     Código gerado pelo backend: 8 bytes hex → 16 chars uppercase
    //     Evita requests desnecessários com códigos obviamente inválidos
    if (codigo.length < 8 || codigo.length > 64) {
      logger.sec("Código com formato suspeito — pode ser tentativa de enumeração", { codigo, length: codigo.length });
      setState("invalid");
      return;
    }

    t0Ref.current = performance.now();
    logger.info("VERIFY", "Iniciando verificação de certificado", {
      codigo,
      api:       API_URL,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.substring(0, 80),
    });

    fetch(`${API_URL}/api/certificates/verify/${codigo}`, {
      headers: {
        "Accept":       "application/json",
        "X-Client":     "nexaspark-web",
        "X-Page":       "verificar",
        "X-Timestamp":  new Date().toISOString(),
      },
    })
      .then(async (res) => {
        const ms   = performance.now() - t0Ref.current;
        const data = await res.json();

        setLatency(ms);
        logger.perf("VERIFY", "Resposta da API recebida", ms);
        logger.info("VERIFY", "Payload completo", {
          status:  res.status,
          ok:      res.ok,
          success: data?.success,
          valido:  data?.data?.valido,
        });

        if (!res.ok || !data.success) {
          logger.warn("VERIFY", "Certificado não encontrado ou API retornou erro", {
            status:  res.status,
            message: data?.error || data?.message,
          });
          setState("invalid");
          return;
        }

        setCert(data.data);
        setState("valid");
        logger.success("VERIFY", "══ Certificado VÁLIDO e autenticado ══", {
          participante:       data.data.participante.nome,
          curso:              data.data.curso.nome,
          total_verificacoes: data.data.verificacao.total_verificacoes,
          latencyMs:          ms.toFixed(2),
        });
      })
      .catch((err: Error) => {
        const ms = performance.now() - t0Ref.current;
        setLatency(ms);
        logger.error("VERIFY", "Erro de rede ou timeout", {
          message:   err.message,
          latencyMs: ms.toFixed(2),
          api:       API_URL,
          hint:      "Verifique NEXT_PUBLIC_API_URL e se o backend está online",
        });
        setState("error");
        setErrMsg("Não foi possível conectar ao servidor de verificação. Tente novamente.");
      });
  }, [codigo]);

  // ── Handler de cópia do código ───────────────────────────
  function handleCopyCode() {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo).then(() => {
      setCopied(true);
      logger.event("UX", "Código de verificação copiado", { codigo });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Handler de compartilhamento ──────────────────────────
  function handleShare() {
    const url = `https://nexaspark.com.br/verificar/${codigo}`;
    if (navigator.share) {
      navigator.share({
        title: "Certificado NexaSpark",
        text:  `Verifique a autenticidade deste certificado em: ${url}`,
        url,
      }).then(() => logger.event("UX", "Certificado compartilhado via Web Share API"));
    } else {
      navigator.clipboard.writeText(url).then(() => {
        logger.event("UX", "URL de verificação copiada (fallback)", { url });
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  // RENDER: LOADING
  // ──────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[#020204] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(16,185,129,0.05) 0%, transparent 70%)" }} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-6"
        >
          {/* Loader ring duplo */}
          <div className="relative w-16 h-16">
            <svg className="animate-spin absolute inset-0" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="28" stroke="rgba(52,211,153,0.12)" strokeWidth="2"/>
              <path d="M32 4 A28 28 0 0 1 60 32" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <svg className="animate-spin absolute inset-2" style={{ animationDuration: "1.4s", animationDirection: "reverse" }} viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="rgba(52,211,153,0.08)" strokeWidth="1.5"/>
              <path d="M24 4 A20 20 0 0 1 44 24" stroke="rgba(52,211,153,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-white text-sm font-medium tracking-tight">Verificando autenticidade</p>
            <p className="text-gray-600 text-[11px] uppercase tracking-[0.15em]">
              {codigo.substring(0, 8)}...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // RENDER: INVÁLIDO / ERRO
  // ──────────────────────────────────────────────────────────
  if (state === "error" || state === "invalid") {
    return (
      <div className="min-h-screen bg-[#020204] flex items-center justify-center px-4 relative overflow-hidden">
        <BackgroundParticles valid={false} />

        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(239,68,68,0.04) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.015]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm text-center relative z-10"
        >
          {/* Ícone de erro */}
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="w-20 h-20 rounded-2xl bg-red-950/60 border border-red-500/20 flex items-center justify-center mx-auto mb-6"
            style={{ boxShadow: "0 0 60px rgba(239,68,68,0.1), inset 0 1px 0 rgba(255,255,255,0.05)" }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/40 border border-red-500/15 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-red-400 font-medium">
                {state === "invalid" ? "Não autenticado" : "Falha na verificação"}
              </span>
            </div>

            <h1 className="text-white font-semibold text-xl mb-3 tracking-tight">
              {state === "invalid" ? "Certificado não encontrado" : "Erro de conexão"}
            </h1>

            <p className="text-gray-500 text-sm leading-relaxed mb-4 max-w-xs mx-auto">
              {state === "invalid"
                ? "O código informado não corresponde a nenhum certificado em nossa base de dados. Verifique se digitou corretamente."
                : errMsg}
            </p>

            {codigo && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] mb-8">
                <span className="text-[10px] text-gray-600 uppercase tracking-widest">Código:</span>
                <span className="font-mono text-xs text-gray-500">{codigo}</span>
              </div>
            )}

            {latency && (
              <p className="text-gray-800 text-[10px] font-mono mb-6">
                latência: {latency.toFixed(0)}ms
              </p>
            )}
          </motion.div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={() => { logger.event("NAV", "Voltar para home"); router.push("/"); }}
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm transition-colors font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Voltar para NexaSpark
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // RENDER: VÁLIDO — O estado principal e mais importante
  // ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020204] flex flex-col items-center px-4 py-10 relative overflow-hidden">

      <BackgroundParticles valid={true} />

      {/* Glow superior */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 40% at 50% -10%, rgba(16,185,129,0.08) 0%, transparent 60%)" }} />

      {/* Grid sutil */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }} />

      {/* ── HEADER ─────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-lg flex items-center justify-between mb-8"
      >
        <button
          onClick={() => { logger.event("NAV", "Logo clicado → home"); router.push("/"); }}
          className="text-white font-semibold text-sm tracking-tight hover:text-emerald-400 transition-colors"
        >
          NexaSpark
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 uppercase tracking-[0.15em] font-medium">Sistema ativo</span>
        </div>
      </motion.header>

      {/* ── CARD PRINCIPAL ──────────────────────────────────── */}
      <motion.main
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Card container */}
        <div
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{
            background:    "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)",
            backdropFilter: "blur(24px)",
            boxShadow:     "0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px rgba(0,0,0,0.7), 0 0 80px rgba(16,185,129,0.04)",
          }}
        >
          {/* ── HERO do certificado ─────────────────────────── */}
          <div className="px-8 pt-8 pb-6 border-b border-white/[0.05]">

            {/* Shield animado com check */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="w-16 h-16 rounded-2xl bg-emerald-950/70 border border-emerald-500/25 flex items-center justify-center mb-5 relative"
              style={{ boxShadow: "0 0 40px rgba(16,185,129,0.12), inset 0 1px 0 rgba(255,255,255,0.06)" }}
            >
              {/* Ring pulsante externo */}
              <motion.div
                className="absolute inset-0 rounded-2xl border border-emerald-500/15"
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <motion.polyline
                  points="9 12 11 14 15 10"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.7, ease: "easeOut" }}
                />
              </svg>
            </motion.div>

            {/* Badge de status */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/20 mb-4"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-emerald-400 font-medium">
                Certificado autêntico e verificado
              </span>
            </motion.div>

            {/* Nome do participante — protagonista da tela */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4 }}
              className="text-2xl font-semibold text-white mb-1.5 tracking-tight leading-tight"
            >
              {cert!.participante.nome}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-gray-600 text-xs font-mono"
            >
              CPF: {cert!.participante.cpf}
            </motion.p>
          </div>

          {/* ── DADOS DO CERTIFICADO ────────────────────────── */}
          <div className="px-8 py-6 border-b border-white/[0.05]">
            <SectionLabel>Dados do certificado</SectionLabel>
            <DataRow label="Curso"          value={cert!.curso.nome}                                  accent delay={0.55} />
            <DataRow label="Carga horária"  value={`${cert!.curso.carga_horaria} horas`}             delay={0.6}  />
            <DataRow label="Data de emissão" value={formatDate(cert!.curso.data_emissao)}             delay={0.65} />
            {cert!.curso.instrutor && (
              <DataRow label="Instrutor"    value={cert!.curso.instrutor}                             delay={0.7}  />
            )}
          </div>

          {/* ── DADOS DE VERIFICAÇÃO ────────────────────────── */}
          <div className="px-8 py-6 border-b border-white/[0.05]">
            <SectionLabel>Dados de verificação</SectionLabel>

            {/* Código com botão de cópia */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-start justify-between gap-6 py-4 border-b border-white/[0.04]"
            >
              <span className="text-[10px] uppercase tracking-[0.15em] text-gray-600 font-medium shrink-0 mt-0.5 select-none">
                Código
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-emerald-400">{cert!.verificacao.codigo}</span>
                <button
                  onClick={handleCopyCode}
                  title="Copiar código"
                  className="text-gray-700 hover:text-emerald-400 transition-colors shrink-0"
                >
                  <AnimatePresence mode="wait">
                    {copied ? (
                      <motion.svg key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </motion.svg>
                    ) : (
                      <motion.svg key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </motion.div>

            {cert!.verificacao.hash_preview && (
              <DataRow label="SHA-256"     value={`${cert!.verificacao.hash_preview}...`} mono  delay={0.8}  />
            )}

            {/* Contador animado de verificações */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-start justify-between gap-6 py-4 border-b border-white/[0.04]"
            >
              <span className="text-[10px] uppercase tracking-[0.15em] text-gray-600 font-medium shrink-0 mt-0.5 select-none">
                Verificações
              </span>
              <span className="text-sm text-gray-300 font-medium tabular-nums">
                <VerificationCounter count={cert!.verificacao.total_verificacoes} />ª verificação
              </span>
            </motion.div>

            <DataRow label="Verificado em" value={formatDateTime(cert!.verificacao.verificado_em)} delay={0.9} />

            {latency && (
              <DataRow label="Latência API" value={`${latency.toFixed(0)}ms`} mono delay={0.95} />
            )}
          </div>

          {/* ── AÇÕES ───────────────────────────────────────── */}
          <div className="px-8 py-6 space-y-3">
            {/* Download PDF */}
            {cert!.pdf_url && (
              <motion.a
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.4 }}
                href={cert!.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logger.event("UX", "Download PDF clicado", { codigo })}
                className="w-full flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 rounded-xl text-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9"  y1="15" x2="15" y2="15"/>
                </svg>
                Baixar certificado em PDF
              </motion.a>
            )}

            {/* Compartilhar */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.05, duration: 0.4 }}
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2.5 border border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300 hover:text-white py-3 rounded-xl text-sm transition-all duration-200"
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

        {/* ── RODAPÉ INSTITUCIONAL ─────────────────────────── */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-6 text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-2">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <p className="text-gray-700 text-[10px] uppercase tracking-[0.15em]">
              Verificado por NexaSpark · Sistema de Certificação Digital
            </p>
          </div>
          <p className="text-gray-800 text-[10px] font-mono">
            nexaspark.com.br/verificar/{codigo}
          </p>
        </motion.footer>
      </motion.main>
    </div>
  );
}