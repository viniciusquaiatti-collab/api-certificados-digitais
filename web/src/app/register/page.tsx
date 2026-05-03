"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Monitoring System
// ============================================================
const LOG_PREFIX = "[NexaSpark]";

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
};

// ============================================================
// 👁️  ÍCONE — Toggle visibilidade de senha
// ============================================================
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ============================================================
// 🌐 API BASE URL — fonte única de verdade
//
// ⚠️  CORREÇÃO: fetch("http://localhost:8080/...") em produção
//     chamaria o localhost do usuário — que não tem nada rodando.
//
// ✅  CORREÇÃO: NEXT_PUBLIC_API_URL aponta para o Railway em
//     produção (configurado no Vercel como variável de ambiente).
//     Em desenvolvimento usa localhost:8080 como fallback.
// ============================================================
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================================
// 📝 REGISTER PAGE
// ============================================================
export default function RegisterPage() {
  const router = useRouter();

  const [email,        setEmail]        = useState("");
  const [senha,        setSenha]        = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  // ── Floating label state ─────────────────────────────────
  const [emailFocused, setEmailFocused] = useState(false);
  const [senhaFocused, setSenhaFocused] = useState(false);

  // ============================================================
  // 🔐 HANDLE REGISTER
  //
  // ⚠️  BUG ORIGINAL CORRIGIDO:
  //     O código anterior chamava data.errors.map() sem verificar
  //     se data.errors era um array — quando o backend retornava
  //     { success: false, error: "string" } (sem array errors),
  //     map() lançava "Cannot read properties of undefined".
  //
  // ✅  CORREÇÃO: tratamento defensivo de todos os formatos
  //     de resposta de erro do backend:
  //     - { error: "string" }        → exibe error diretamente
  //     - { errors: [...] }          → junta mensagens do array
  //     - { message: "string" }      → exibe message
  //     - qualquer outro             → mensagem genérica
  // ============================================================
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const t0 = performance.now();
    logger.event("REGISTER", "Formulário submetido", { email });

    // Validação client-side antes de chamar a API
    if (!email.trim()) {
      setErrorMsg("E-mail é obrigatório");
      return;
    }
    if (senha.length < 8) {
      setErrorMsg("A senha deve ter no mínimo 8 caracteres");
      logger.warn("REGISTER", "Senha muito curta — bloqueado no cliente", { length: senha.length });
      return;
    }

    setLoading(true);
    logger.info("REGISTER", "Chamando API...", { email });

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password: senha }),
      });

      logger.info("REGISTER", "Resposta recebida", { status: response.status });

      // ── Parse seguro do JSON ─────────────────────────────
      let data: any = {};
      try {
        data = await response.json();
        logger.info("REGISTER", "Body parseado", data);
      } catch (parseErr) {
        logger.error("REGISTER", "JSON inválido na resposta", parseErr);
        throw new Error("Resposta inválida do servidor");
      }

      // ── Trata erros HTTP ─────────────────────────────────
      if (!response.ok) {
        // ✅ CORREÇÃO: extrai mensagem de qualquer formato de erro
        let msg = "Erro ao criar conta";

        if (typeof data?.error === "string") {
          msg = data.error;
        } else if (Array.isArray(data?.errors) && data.errors.length > 0) {
          // Zod retorna array de objetos { field, message }
          msg = data.errors.map((e: any) => e.message || e).join(" • ");
        } else if (typeof data?.message === "string") {
          msg = data.message;
        }

        logger.error("REGISTER", "Erro na criação de conta", { status: response.status, msg, data });
        setErrorMsg(msg);
        return;
      }

      // ── Sucesso ──────────────────────────────────────────
      const token = data.token || data.data?.token;
      logger.success("REGISTER", "Conta criada com sucesso", { token: !!token });
      logger.perf("REGISTER", "Fluxo completo", performance.now() - t0);

      if (token) {
        localStorage.setItem("token", token);
        document.cookie = `token=${token}; path=/;`;
        logger.success("REGISTER", "Token salvo — redirecionando para dashboard");
        router.push("/dashboard");
      } else {
        logger.warn("REGISTER", "Sem token na resposta — redirecionando para login");
        router.push("/login");
      }

    } catch (error: any) {
      logger.error("REGISTER", "Erro não tratado", { message: error.message });
      setErrorMsg(error.message || "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
      logger.info("REGISTER", "Fluxo finalizado");
    }
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">

      {/* Grid background — mesmo padrão da tela de login */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Ambient glow — mesmo padrão da tela de login */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 70%)",
        }}
      />

      {/* ── LOGO / HEADER ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mb-8 text-center"
      >
        <p className="text-white font-semibold text-lg tracking-tight">NexaSpark</p>
        <p className="text-gray-600 text-xs mt-1 uppercase tracking-widest">Certificação Digital</p>
      </motion.div>

      {/* ── CARD ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.5)" }}
        >

          {/* Ícone de escudo */}
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-900/40 flex items-center justify-center mb-6">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>

          {/* Título */}
          <h1 className="text-white font-semibold text-xl mb-1 tracking-tight">Criar conta</h1>
          <p className="text-gray-500 text-sm mb-7">Bem-vindo à NexaSpark.</p>

          {/* ── FORMULÁRIO ── */}
          <form onSubmit={handleRegister} className="space-y-4" noValidate>

            {/* Campo E-mail — floating label */}
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                autoComplete="email"
                onFocus={() => { setEmailFocused(true); logger.event("REGISTER:INPUT", "email focused"); }}
                onBlur={() => setEmailFocused(false)}
                onChange={(e) => { setEmail(e.target.value); setErrorMsg(null); }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pt-5 pb-2.5 text-sm text-white placeholder-transparent focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.06] transition-all duration-200 peer"
                placeholder="E-mail"
              />
              <label
                htmlFor="email"
                className={`absolute left-4 transition-all duration-200 pointer-events-none select-none
                  ${emailFocused || email
                    ? "top-2 text-[10px] text-emerald-400 uppercase tracking-widest font-medium"
                    : "top-1/2 -translate-y-1/2 text-sm text-gray-500"
                  }`}
              >
                E-mail
              </label>
            </div>

            {/* Campo Senha — floating label + toggle */}
            <div className="relative">
              <input
                id="senha"
                type={showPassword ? "text" : "password"}
                value={senha}
                autoComplete="new-password"
                onFocus={() => { setSenhaFocused(true); logger.event("REGISTER:INPUT", "senha focused"); }}
                onBlur={() => setSenhaFocused(false)}
                onChange={(e) => { setSenha(e.target.value); setErrorMsg(null); }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pt-5 pb-2.5 pr-11 text-sm text-white placeholder-transparent focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.06] transition-all duration-200"
                placeholder="Senha"
              />
              <label
                htmlFor="senha"
                className={`absolute left-4 transition-all duration-200 pointer-events-none select-none
                  ${senhaFocused || senha
                    ? "top-2 text-[10px] text-emerald-400 uppercase tracking-widest font-medium"
                    : "top-1/2 -translate-y-1/2 text-sm text-gray-500"
                  }`}
              >
                Senha
              </label>
              <button
                type="button"
                onClick={() => { setShowPassword(!showPassword); logger.event("REGISTER:INPUT", "toggle senha", { visible: !showPassword }); }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors duration-200"
                tabIndex={-1}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {/* Requisito de senha */}
            <p className={`text-[11px] transition-colors duration-200 ${senha.length > 0 && senha.length < 8 ? "text-amber-400" : "text-gray-600"}`}>
              Mínimo 8 caracteres {senha.length > 0 && `(${senha.length}/8)`}
            </p>

            {/* ── MENSAGEM DE ERRO ── */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-950/40 border border-red-500/20"
                >
                  <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-red-400 text-xs leading-relaxed">{errorMsg}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── BOTÃO SUBMIT ── */}
            <button
              type="submit"
              disabled={loading}
              onClick={() => logger.event("REGISTER:BTN", "submit clicado")}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900 disabled:text-emerald-700 text-black font-semibold py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-sm tracking-wide mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Criando conta...
                </span>
              ) : (
                "Criar conta"
              )}
            </button>

          </form>

          {/* ── LINK PARA LOGIN ── */}
          <p className="text-center text-gray-600 text-xs mt-6">
            Já tem uma conta?{" "}
            <button
              onClick={() => { logger.event("REGISTER:NAV", "→ /login"); router.push("/login"); }}
              className="text-emerald-400 hover:text-emerald-300 transition-colors duration-200 font-medium"
            >
              Entrar
            </button>
          </p>

        </div>
      </motion.div>

      {/* ── FOOTER ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="relative z-10 mt-8 text-gray-700 text-xs"
      >
        © {new Date().getFullYear()} NexaSpark. Todos os direitos reservados.
      </motion.p>

    </div>
  );
}