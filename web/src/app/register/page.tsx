"use client";

// ============================================================
// 📝 NexaSpark — /register/page.tsx
//
// ⚠️  ARQUITETURA Next.js 16 — SUSPENSE PREVENTIVO:
//     Register não usa useSearchParams() diretamente, mas
//     aplicamos o padrão Suspense por consistência e para
//     evitar regressão caso useSearchParams() seja adicionado.
//
// ESTRUTURA DO ARQUIVO:
//   RegisterLoading  → fallback visual durante hidratação
//   RegisterInner    → toda a lógica (dentro do Suspense)
//   RegisterPage     → export default, apenas wrapper <Suspense>
//
// FLUXO OAuth:
//   handleGoogleRegister() → mesmo endpoint do login.
//   Backend detecta automaticamente se cria ou vincula conta.
// ============================================================

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Frontend
// ============================================================
const LOG_PREFIX = "[NexaSpark:Register]";

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
  oauth:   (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🌐 [OAUTH]%c ${msg}`, "color:#22d3ee;font-weight:bold;", "color:inherit;", data ?? ""),
  auth:    (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🔐 [AUTH]%c ${msg}`, "color:#c084fc;font-weight:bold;", "color:inherit;", data ?? ""),
  sep:     () => console.log("%c" + "─".repeat(60), "color:#374151;"),
};

// ============================================================
// 🌐 API BASE URL
// ============================================================
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================================
// 👁️  ÍCONE TOGGLE SENHA
// ============================================================
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
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
// ⏳ LOADING FALLBACK
// ============================================================
function RegisterLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ============================================================
// 📝 REGISTER INNER — toda a lógica real
// ============================================================
function RegisterInner() {
  const router = useRouter();

  const [email,         setEmail]         = useState("");
  const [senha,         setSenha]         = useState("");
  const [showPassword,  setShowPassword]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  const [emailFocused,  setEmailFocused]  = useState(false);
  const [senhaFocused,  setSenhaFocused]  = useState(false);

  // ============================================================
  // 📝 HANDLE REGISTER — cadastro local email + senha
  // ============================================================
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const t0 = performance.now();
    logger.sep();
    logger.event("REGISTER", "Formulário submetido", {
      email:          email.trim().toLowerCase(),
      passwordLength: senha.length,
      apiUrl:         `${API_URL}/api/auth/register`,
      timestamp:      new Date().toISOString(),
    });

    // ── Validação client-side ────────────────────────────────
    if (!email.trim()) {
      logger.warn("VALIDATE", "Email vazio — bloqueado no cliente");
      setErrorMsg("E-mail é obrigatório");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      logger.warn("VALIDATE", "Formato de email inválido", { email });
      setErrorMsg("Formato de e-mail inválido");
      return;
    }
    if (senha.length < 8) {
      logger.warn("VALIDATE", "Senha fraca — bloqueado no cliente", { length: senha.length, minimum: 8 });
      setErrorMsg("A senha deve ter no mínimo 8 caracteres");
      return;
    }

    logger.success("VALIDATE", "Validação client-side OK");
    setLoading(true);

    try {
      logger.info("HTTP", "Enviando POST /api/auth/register...");
      const tFetch = performance.now();

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          // ⚠️  X-Request-ID para correlacionar com logs do Railway
          "X-Request-ID": `register_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        },
        body: JSON.stringify({
          email:    email.trim().toLowerCase(),
          password: senha,
        }),
      });

      const fetchMs = performance.now() - tFetch;
      logger.perf("HTTP", "Resposta HTTP recebida", fetchMs);
      logger.info("HTTP", "Status da resposta", { status: response.status, ok: response.ok });

      // ── Parse seguro do JSON ─────────────────────────────
      let data: any = {};
      try {
        data = await response.json();
        logger.info("HTTP:PARSE", "Body parseado", {
          hasToken:  !!(data.token || data.data?.token),
          hasError:  !!data.error,
          hasErrors: Array.isArray(data.errors),
          success:   data.success,
          keys:      Object.keys(data),
        });
      } catch (parseErr) {
        logger.error("HTTP:PARSE", "JSON inválido na resposta", { error: String(parseErr) });
        throw new Error("Resposta inválida do servidor");
      }

      // ── Trata erros HTTP ─────────────────────────────────
      if (!response.ok) {
        let msg = "Erro ao criar conta";
        if (typeof data?.error === "string")                         msg = data.error;
        else if (Array.isArray(data?.errors) && data.errors.length)  msg = data.errors.map((e: any) => e.message || e).join(" • ");
        else if (typeof data?.message === "string")                   msg = data.message;

        logger.error("REGISTER", "Erro retornado pelo servidor", {
          status: response.status,
          code:   data?.code,
          msg,
        });
        setErrorMsg(msg);
        return;
      }

      // ── Sucesso ──────────────────────────────────────────
      const token = data.token || data.data?.token;
      logger.success("REGISTER", "Conta criada com sucesso!", {
        userId:   data.data?.id,
        email:    data.data?.email,
        hasToken: !!token,
      });

      const totalMs = performance.now() - t0;
      logger.perf("REGISTER:FLOW", "Fluxo completo (submit → sucesso)", totalMs);

      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          logger.auth("Token decodificado", {
            userId:    payload.id,
            email:     payload.email,
            provider:  payload.auth_provider || "local",
            expiresAt: new Date(payload.exp * 1000).toISOString(),
          });
        } catch { /* não crítico para o fluxo */ }

        localStorage.setItem("token", token);
        document.cookie = `token=${token}; path=/; SameSite=Lax`;
        logger.success("AUTH", "Token armazenado — localStorage + cookie ✅");
        logger.info("NAV", "Redirecionando para /dashboard");
        router.push("/dashboard");
      } else {
        logger.warn("REGISTER", "Conta criada mas sem token — redirecionando para login");
        router.push("/login");
      }

    } catch (error: any) {
      const totalMs = performance.now() - t0;
      logger.error("REGISTER:NETWORK", `Erro após ${totalMs.toFixed(2)}ms`, {
        message: error.message,
        type:    error.name,
      });
      setErrorMsg(error.message || "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
      logger.sep();
    }
  }

  // ============================================================
  // 🌐 GOOGLE OAUTH — Registro/Login via Google
  //
  // ⚠️  Registro e login usam o MESMO endpoint OAuth.
  //     O backend (passport.js) detecta automaticamente:
  //     - Se email novo → INSERT (novo usuário)
  //     - Se email existe → UPDATE/vinculação
  //     O usuário não precisa distinguir — é transparente.
  // ============================================================
  function handleGoogleRegister() {
    logger.sep();
    logger.oauth("Iniciando fluxo OAuth 2.0 Google via Register...");
    logger.oauth("Configurações do fluxo", {
      backendUrl:    API_URL,
      oauthEndpoint: `${API_URL}/api/auth/google`,
      callbackPage:  `${window.location.origin}/auth/callback`,
      note:          "Mesmo endpoint do login — backend decide se cria ou vincula",
      timestamp:     new Date().toISOString(),
    });

    setLoadingGoogle(true);
    logger.event("REGISTER:GOOGLE", "Usuário clicou em Continuar com Google");

    setTimeout(() => {
      logger.oauth("Redirecionando para backend OAuth...", { url: `${API_URL}/api/auth/google` });
      window.location.href = `${API_URL}/api/auth/google`;
    }, 150);
  }

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">

      {/* Grid background */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      {/* Ambient glow */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 70%)" }} />

      {/* LOGO */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 mb-8 text-center">
        <p className="text-white font-semibold text-lg tracking-tight">NexaSpark</p>
        <p className="text-gray-600 text-xs mt-1 uppercase tracking-widest">Certificação Digital</p>
      </motion.div>

      {/* CARD */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="relative z-10 w-full max-w-sm">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.5)" }}>

          {/* Ícone escudo */}
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-900/40 flex items-center justify-center mb-6">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>

          <h1 className="text-white font-semibold text-xl mb-1 tracking-tight">Criar conta</h1>
          <p className="text-gray-500 text-sm mb-7">Bem-vindo à NexaSpark.</p>

          {/* FORMULÁRIO */}
          <form onSubmit={handleRegister} className="space-y-4" noValidate>

            {/* Email */}
            <div className="relative">
              <input id="email" type="email" value={email} autoComplete="email" disabled={loading || loadingGoogle}
                onFocus={() => { setEmailFocused(true); logger.event("INPUT", "email focused"); }}
                onBlur={() => setEmailFocused(false)}
                onChange={(e) => { setEmail(e.target.value); setErrorMsg(null); }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pt-5 pb-2.5 text-sm text-white placeholder-transparent focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                placeholder="E-mail"
              />
              <label htmlFor="email" className={`absolute left-4 transition-all duration-200 pointer-events-none select-none ${emailFocused || email ? "top-2 text-[10px] text-emerald-400 uppercase tracking-widest font-medium" : "top-1/2 -translate-y-1/2 text-sm text-gray-500"}`}>E-mail</label>
            </div>

            {/* Senha */}
            <div className="relative">
              <input id="senha" type={showPassword ? "text" : "password"} value={senha} autoComplete="new-password" disabled={loading || loadingGoogle}
                onFocus={() => { setSenhaFocused(true); logger.event("INPUT", "senha focused"); }}
                onBlur={() => setSenhaFocused(false)}
                onChange={(e) => { setSenha(e.target.value); setErrorMsg(null); }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pt-5 pb-2.5 pr-11 text-sm text-white placeholder-transparent focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                placeholder="Senha"
              />
              <label htmlFor="senha" className={`absolute left-4 transition-all duration-200 pointer-events-none select-none ${senhaFocused || senha ? "top-2 text-[10px] text-emerald-400 uppercase tracking-widest font-medium" : "top-1/2 -translate-y-1/2 text-sm text-gray-500"}`}>Senha</label>
              <button type="button" onClick={() => { setShowPassword(!showPassword); logger.event("INPUT", "toggle senha", { visible: !showPassword }); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors duration-200" tabIndex={-1}>
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {/* Indicador força senha */}
            <p className={`text-[11px] transition-colors duration-200 ${senha.length > 0 && senha.length < 8 ? "text-amber-400" : "text-gray-600"}`}>
              Mínimo 8 caracteres {senha.length > 0 && `(${senha.length}/8)`}
            </p>

            {/* ERRO */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.2 }} className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-950/40 border border-red-500/20">
                  <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-red-400 text-xs leading-relaxed">{errorMsg}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* BOTÃO CRIAR CONTA */}
            <button type="submit" disabled={loading || loadingGoogle} onClick={() => logger.event("BTN", "submit clicado")} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900 disabled:text-emerald-700 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-sm tracking-wide mt-1">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Criando conta...
                </span>
              ) : "Criar conta"}
            </button>

          </form>

          {/* DIVIDER */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-gray-600">ou</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* GOOGLE REGISTER */}
          <button type="button" onClick={handleGoogleRegister} disabled={loading || loadingGoogle} className="w-full flex items-center justify-center gap-3 border border-white/[0.08] hover:border-white/[0.18] bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm py-3 rounded-xl transition-all duration-200 group cursor-pointer">
            {loadingGoogle ? (
              <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span className="text-gray-400">Redirecionando para Google...</span></>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg><span className="text-gray-300 group-hover:text-white transition-colors">Continuar com Google</span></>
            )}
          </button>

          {/* LINK LOGIN */}
          <p className="text-center text-gray-600 text-xs mt-6">
            Já tem uma conta?{" "}
            <button onClick={() => { logger.event("NAV", "→ /login"); router.push("/login"); }} className="text-emerald-400 hover:text-emerald-300 transition-colors duration-200 font-medium">
              Entrar
            </button>
          </p>

        </div>
      </motion.div>

      {/* FOOTER */}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="relative z-10 mt-8 text-gray-700 text-xs">
        © {new Date().getFullYear()} NexaSpark. Todos os direitos reservados.
      </motion.p>

    </div>
  );
}

// ============================================================
// 📝 EXPORT DEFAULT — RegisterPage
//
// ⚠️  ÚNICO PROPÓSITO: envolver RegisterInner em <Suspense>.
//     Nunca adicione lógica aqui — tudo vai em RegisterInner.
// ============================================================
export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterLoading />}>
      <RegisterInner />
    </Suspense>
  );
}