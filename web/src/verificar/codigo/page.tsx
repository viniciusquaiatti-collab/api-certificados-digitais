"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark
// ============================================================
const LOG_PREFIX = "[NexaSpark]";
const logger = {
  info:    (scope: string, msg: string, data?: any) => console.log(`%c${LOG_PREFIX} ℹ️  [${scope}]%c ${msg}`, "color:#60a5fa;font-weight:bold;", "color:inherit;", data ?? ""),
  success: (scope: string, msg: string, data?: any) => console.log(`%c${LOG_PREFIX} ✅ [${scope}]%c ${msg}`, "color:#34d399;font-weight:bold;", "color:inherit;", data ?? ""),
  warn:    (scope: string, msg: string, data?: any) => console.warn(`%c${LOG_PREFIX} ⚠️  [${scope}]%c ${msg}`, "color:#fbbf24;font-weight:bold;", "color:inherit;", data ?? ""),
  error:   (scope: string, msg: string, data?: any) => console.error(`%c${LOG_PREFIX} ❌ [${scope}]%c ${msg}`, "color:#f87171;font-weight:bold;", "color:inherit;", data ?? ""),
  perf:    (scope: string, label: string, ms: number) => console.log(`%c${LOG_PREFIX} ⏱️  [${scope}]%c ${label} — ${ms.toFixed(2)}ms`, "color:#a78bfa;font-weight:bold;", "color:inherit;"),
};

// ============================================================
// 🌐 API URL
// ============================================================
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================================
// 📋 TYPES
// ============================================================
interface Certificate {
  valido:       boolean;
  participante: { nome: string; cpf: string };
  curso:        { nome: string; carga_horaria: number; data_emissao: string; instrutor?: string };
  verificacao:  { codigo: string; hash_preview: string | null; total_verificacoes: number; verificado_em: string };
  pdf_url:      string | null;
}

// ============================================================
// 🔧 HELPERS
// ============================================================
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return iso; }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

// ============================================================
// 🛡️  SHIELD ICON — Animated
// ============================================================
function ShieldIcon({ valid }: { valid: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
        valid
          ? "bg-emerald-950/80 border border-emerald-500/30"
          : "bg-red-950/80 border border-red-500/30"
      }`}
      style={{ boxShadow: valid ? "0 0 40px rgba(16,185,129,0.15)" : "0 0 40px rgba(239,68,68,0.15)" }}
    >
      {valid ? (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
      ) : (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      )}
    </motion.div>
  );
}

// ============================================================
// 📊 DATA ROW
// ============================================================
function DataRow({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start justify-between gap-4 py-3.5 border-b border-white/[0.05] last:border-0"
    >
      <span className="text-[10px] uppercase tracking-widest text-gray-600 font-medium shrink-0 mt-0.5">
        {label}
      </span>
      <span className={`text-sm text-white text-right ${mono ? "font-mono text-xs text-emerald-400" : "font-medium"}`}>
        {value}
      </span>
    </motion.div>
  );
}

// ============================================================
// 🔍 VERIFICAR PAGE
// ============================================================
export default function VerificarPage() {
  const params = useParams();
  const router = useRouter();
  const codigo = (params?.codigo as string || "").toUpperCase();

  const [state,  setState]  = useState<"loading" | "valid" | "invalid" | "error">("loading");
  const [cert,   setCert]   = useState<Certificate | null>(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!codigo) {
      setState("error");
      setErrMsg("Código de verificação ausente.");
      return;
    }

    const t0 = performance.now();
    logger.info("VERIFY", "Iniciando verificação", { codigo, api: API_URL });

    fetch(`${API_URL}/api/certificates/verify/${codigo}`)
      .then(async (res) => {
        const ms   = performance.now() - t0;
        const data = await res.json();

        logger.perf("VERIFY", "Resposta recebida", ms);
        logger.info("VERIFY", "Payload", data);

        if (!res.ok || !data.success) {
          logger.warn("VERIFY", "Certificado não encontrado ou inválido", { status: res.status });
          setState("invalid");
          return;
        }

        setCert(data.data);
        setState("valid");
        logger.success("VERIFY", "Certificado válido", data.data);
      })
      .catch((err) => {
        logger.error("VERIFY", "Erro de rede", { message: err.message });
        setState("error");
        setErrMsg("Não foi possível conectar ao servidor de verificação.");
      });
  }, [codigo]);

  // ── Render: Loading ──────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.06) 0%, transparent 70%)" }} />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <p className="text-gray-600 text-xs uppercase tracking-widest">Verificando autenticidade...</p>
        </motion.div>
      </div>
    );
  }

  // ── Render: Error / Not found ────────────────────────────
  if (state === "error" || state === "invalid") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(239,68,68,0.05) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-red-950/80 border border-red-500/30 flex items-center justify-center mx-auto mb-6"
            style={{ boxShadow: "0 0 40px rgba(239,68,68,0.15)" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>

          <h1 className="text-white font-semibold text-xl mb-2">
            {state === "invalid" ? "Certificado não encontrado" : "Erro de verificação"}
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            {state === "invalid"
              ? "O código informado não corresponde a nenhum certificado em nossa base."
              : errMsg}
          </p>
          <p className="text-gray-700 text-xs font-mono mb-8">{codigo}</p>

          <button
            onClick={() => router.push("/")}
            className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
          >
            ← Voltar para NexaSpark
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Render: Valid ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Ambient glow — verde para válido */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 65%)" }} />

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      {/* Logo */}
      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onClick={() => router.push("/")}
        className="relative z-10 mb-10 text-white font-semibold text-sm tracking-tight hover:text-emerald-400 transition-colors"
      >
        NexaSpark
      </motion.button>

      {/* Card principal */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div
          className="rounded-2xl border border-white/[0.08] p-8"
          style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.6)" }}
        >
          {/* Shield + Status */}
          <div className="text-center mb-8">
            <ShieldIcon valid={true} />

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              {/* Badge VÁLIDO */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/20 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-medium">Autêntico e verificado</span>
              </div>

              <h1 className="text-white font-semibold text-2xl mb-1 tracking-tight">
                {cert!.participante.nome}
              </h1>
              <p className="text-gray-500 text-sm">
                CPF: <span className="font-mono text-gray-400">{cert!.participante.cpf}</span>
              </p>
            </motion.div>
          </div>

          {/* Dados do certificado */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 mb-5"
          >
            <DataRow label="Curso"         value={cert!.curso.nome} />
            <DataRow label="Carga horária" value={`${cert!.curso.carga_horaria} horas`} />
            <DataRow label="Emissão"       value={formatDate(cert!.curso.data_emissao)} />
            {cert!.curso.instrutor && (
              <DataRow label="Instrutor" value={cert!.curso.instrutor} />
            )}
          </motion.div>

          {/* Dados de verificação */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 mb-6"
          >
            <DataRow label="Código"        value={cert!.verificacao.codigo} mono />
            {cert!.verificacao.hash_preview && (
              <DataRow label="SHA-256"     value={`${cert!.verificacao.hash_preview}...`} mono />
            )}
            <DataRow label="Verificações"  value={`${cert!.verificacao.total_verificacoes}ª verificação`} />
            <DataRow label="Verificado em" value={formatDateTime(cert!.verificacao.verificado_em)} />
          </motion.div>

          {/* Botão PDF */}
          {cert!.pdf_url && (
            <motion.a
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              href={cert!.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 rounded-xl text-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              Baixar certificado em PDF
            </motion.a>
          )}
        </div>

        {/* Rodapé institucional */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-6 text-center space-y-1"
        >
          <p className="text-gray-700 text-[10px] uppercase tracking-widest">
            Verificado por NexaSpark · Sistema de Certificação Digital
          </p>
          <p className="text-gray-800 text-[10px] font-mono">
            nexaspark.com.br/verificar/{codigo}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}