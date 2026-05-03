"use client";

// ============================================================
// 🔐 NexaSpark — /login/page.tsx
//
// ⚠️  ARQUITETURA Next.js 16 — SUSPENSE OBRIGATÓRIO:
//     useSearchParams() DEVE estar dentro de <Suspense boundary>.
//     Build falha com "useSearchParams() should be wrapped in
//     a suspense boundary" se usado diretamente no export default.
//
// ESTRUTURA DO ARQUIVO:
//   LoginLoading    → fallback visual enquanto Suspense hidrata
//   LoginInner      → toda a lógica + useSearchParams() (dentro do Suspense)
//   LoginPage       → export default, apenas o wrapper <Suspense>
//
// FLUXO OAuth detectado aqui:
//   Backend redireciona /login?error=google_auth_failed → capturamos
//   via searchParams e exibimos mensagem amigável ao usuário.
// ============================================================

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Frontend
// Padrão idêntico ao backend — colored console com prefixos.
// Cada evento é rastreável no DevTools do browser.
// ============================================================
const LOG_PREFIX = "[NexaSpark:Login]";

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
  auth:    (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🔐 [AUTH]%c ${msg}`, "color:#c084fc;font-weight:bold;", "color:inherit;", data ?? ""),
  oauth:   (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🌐 [OAUTH]%c ${msg}`, "color:#22d3ee;font-weight:bold;", "color:inherit;", data ?? ""),
  nav:     (dest: string) =>
    console.log(`%c${LOG_PREFIX} 🧭 [NAV]%c Navegando → ${dest}`, "color:#fb923c;font-weight:bold;", "color:inherit;"),
  mount:   (c: string) =>
    console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}> renderizado`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) =>
    console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}> destruído`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
  sep:     () => console.log("%c" + "─".repeat(60), "color:#374151;"),
};

// ============================================================
// 🌐 API BASE URL — fonte única de verdade
//
// ⚠️  NEXT_PUBLIC_API_URL deve estar configurada na Vercel:
//     https://api-certificados-digitais-production.up.railway.app
//     Em desenvolvimento usa localhost:8080 como fallback.
// ============================================================
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================================
// 🗺️  MAPA DE ERROS OAUTH — mensagens amigáveis por código
// Erros enviados pelo backend como ?error=CODIGO
// ============================================================
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed:  "Autenticação com Google falhou. Tente novamente.",
  oauth_failed:        "Erro no fluxo OAuth. Tente novamente.",
  oauth_invalid_user:  "Perfil Google inválido. Tente com outra conta.",
  oauth_server_error:  "Erro interno no servidor OAuth. Tente mais tarde.",
  user_not_found:      "Usuário não encontrado após autenticação Google.",
  token_error:         "Erro ao gerar sessão. Tente novamente.",
  invalid_token:       "Token inválido recebido. Tente novamente.",
  NO_USER:             "Perfil do Google não disponível. Tente com outra conta.",
};

// ============================================================
// ⏳ LOADING FALLBACK — exibido durante hidratação do Suspense
// ============================================================
function LoginLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ============================================================
// 🔐 LOGIN INNER — toda a lógica real
// ⚠️  Este componente DEVE ser filho de <Suspense> pois usa
//     useSearchParams(). Nunca exporte este componente diretamente.
// ============================================================
function LoginInner() {
  const router       = useRouter();
  const searchParams = useSearchParams(); // ← DEVE estar dentro de <Suspense>

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [showPass,      setShowPass]      = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error,         setError]         = useState("");
  const [focused,       setFocused]       = useState<"email" | "password" | null>(null);
  const [attempts,      setAttempts]      = useState(0);

  const emailRef = useRef<HTMLInputElement>(null);
  const t0Ref    = useRef(0);

  // ============================================================
  // 🚀 INICIALIZAÇÃO — detecta erros OAuth + sessão existente
  // ============================================================
  useEffect(() => {
    logger.sep();
    logger.mount("LoginInner");
    logger.info("INIT", "Página de login carregada", {
      apiUrl:    API_URL,
      timestamp: new Date().toISOString(),
    });

    // ── Detecta erros OAuth na URL (?error=google_auth_failed etc) ──
    // Backend redireciona aqui quando OAuth falha
    const oauthError = searchParams.get("error");
    if (oauthError) {
      logger.oauth("Erro OAuth detectado na URL", { error: oauthError });

      const friendlyMsg = OAUTH_ERROR_MESSAGES[oauthError] || `Erro de autenticação: ${oauthError}`;
      setError(friendlyMsg);
      logger.error("OAUTH", `Mensagem mapeada: ${friendlyMsg}`, { oauthError });

      // ⚠️  Limpa o query param sem reload — evita erro reaparecer no F5
      window.history.replaceState({}, "", "/login");
      logger.info("OAUTH", "Query param ?error removido da URL via replaceState");
    }

    // ── Verifica sessão JWT existente ────────────────────────
    const token = localStorage.getItem("token");
    if (token) {
      logger.auth("Token existente detectado — verificando validade...");

      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const isExpired = Date.now() > payload.exp * 1000;

        logger.auth("Token decodificado", {
          userId:    payload.id,
          email:     payload.email,
          provider:  payload.auth_provider || "local",
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          isExpired,
        });

        if (isExpired) {
          logger.warn("AUTH", "Token expirado — removendo e exibindo formulário");
          localStorage.removeItem("token");
        } else {
          logger.nav("/dashboard");
          router.replace("/dashboard");
          return;
        }
      } catch (decodeErr) {
        logger.warn("AUTH", "Token malformado — removendo", { error: String(decodeErr) });
        localStorage.removeItem("token");
      }
    } else {
      logger.auth("Nenhuma sessão ativa — exibindo formulário");
    }

    // Foca email após animação de entrada
    const focusTimer = setTimeout(() => {
      emailRef.current?.focus();
      logger.info("UX", "Focus automático no campo email");
    }, 600);

    return () => {
      clearTimeout(focusTimer);
      logger.unmount("LoginInner");
      logger.sep();
    };
  }, []);

  // ============================================================
  // ✅ VALIDAÇÃO CLIENT-SIDE
  // ============================================================
  function validate(): string | null {
    if (!email.trim())                return "Informe seu e-mail.";
    if (!/\S+@\S+\.\S+/.test(email)) return "E-mail inválido.";
    if (!password)                    return "Informe sua senha.";
    if (password.length < 8)         return "Senha deve ter no mínimo 8 caracteres.";
    return null;
  }

  // ============================================================
  // 🔑 SUBMIT — Login local email + senha
  // ============================================================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      logger.warn("AUTH", `Validação client-side falhou: ${validationError}`);
      setError(validationError);
      return;
    }

    t0Ref.current = performance.now();
    setLoading(true);
    setAttempts((n) => n + 1);
    const currentAttempt = attempts + 1;

    logger.sep();
    logger.auth("Iniciando tentativa de login", {
      email:   email.trim().toLowerCase(),
      attempt: currentAttempt,
      apiUrl:  `${API_URL}/api/auth/login`,
    });

    try {
      logger.info("AUTH:HTTP", "Enviando POST /api/auth/login...");
      const tFetch = performance.now();

      const res = await fetch(`${API_URL}/api/auth/login`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          // ⚠️  X-Request-ID para correlacionar com logs do Railway
          "X-Request-ID": `login_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        },
        body: JSON.stringify({
          email:    email.trim().toLowerCase(),
          password,
        }),
      });

      const fetchMs = performance.now() - tFetch;
      logger.perf("AUTH:HTTP", "Resposta HTTP recebida", fetchMs);
      logger.info("AUTH:HTTP", "Status da resposta", { status: res.status, ok: res.ok });

      // ── Parse JSON seguro ────────────────────────────────
      let data: any = {};
      try {
        data = await res.json();
        logger.info("AUTH:PARSE", "Body parseado", {
          hasToken:  !!(data.token || data.data?.token),
          hasError:  !!data.error,
          hasErrors: Array.isArray(data.errors),
          keys:      Object.keys(data),
        });
      } catch (parseErr) {
        logger.error("AUTH:PARSE", "JSON inválido na resposta", { parseErr: String(parseErr) });
        throw new Error("Resposta inválida do servidor");
      }

      const totalMs = performance.now() - t0Ref.current;

      // ── Trata erros HTTP ─────────────────────────────────
      if (!res.ok) {
        const msg =
          typeof data?.error   === "string" ? data.error   :
          typeof data?.message === "string" ? data.message :
          Array.isArray(data?.errors)       ? data.errors.map((e: any) => e.message || e).join(" • ") :
          "Credenciais inválidas. Verifique e tente novamente.";

        logger.warn("AUTH", "Login rejeitado pelo servidor", {
          status:  res.status,
          code:    data?.code,
          message: msg,
          attempt: currentAttempt,
          totalMs: totalMs.toFixed(2) + "ms",
        });

        // ⚠️  Caso especial: conta criada via Google sem senha local
        if (data?.code === "OAUTH_ACCOUNT_NO_PASSWORD") {
          logger.oauth("Conta OAuth detectada — orientando usuário", { provider: data?.provider });
        }

        setError(msg);
        setLoading(false);
        return;
      }

      // ── Sucesso ──────────────────────────────────────────
      const token = data.token || data.data?.token;
      if (!token) {
        logger.error("AUTH", "Resposta OK mas sem token", { data });
        setError("Erro inesperado — tente novamente.");
        setLoading(false);
        return;
      }

      // Decodifica payload para log
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        logger.auth("Token recebido e decodificado", {
          userId:    payload.id,
          email:     payload.email,
          provider:  payload.auth_provider || "local",
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          tokenSize: token.length,
        });
      } catch {
        logger.warn("AUTH", "Token recebido mas não decodificável para log");
      }

      localStorage.setItem("token", token);
      document.cookie = `token=${token}; path=/; SameSite=Lax`;
      logger.success("AUTH", "Token armazenado — localStorage + cookie ✅");
      logger.perf("LOGIN:FLOW", "Login completo (submit → armazenamento)", totalMs);
      logger.nav("/dashboard");
      logger.sep();

      router.replace("/dashboard");

    } catch (err: any) {
      const totalMs = performance.now() - t0Ref.current;
      logger.error("AUTH:NETWORK", `Erro de rede após ${totalMs.toFixed(2)}ms`, {
        message: err.message,
        type:    err.name,
      });
      setError("Não foi possível conectar ao servidor. Verifique sua conexão.");
      setLoading(false);
    }
  }

  // ============================================================
  // 🌐 GOOGLE OAUTH — Login via Google
  //
  // ⚠️  FLUXO COMPLETO:
  //   1. window.location.href → backend /api/auth/google
  //   2. Passport → accounts.google.com
  //   3. Google → backend /api/auth/google/callback
  //   4. Backend gera JWT → redirect → /auth/callback?token=xxx
  //   5. /auth/callback salva token → redireciona /dashboard
  //
  // ⚠️  Usa window.location.href (não router.push) pois é
  //     redirect cross-domain para o Railway.
  // ============================================================
  function handleGoogleLogin() {
    logger.sep();
    logger.oauth("Iniciando fluxo OAuth 2.0 Google...");
    logger.oauth("Configurações do fluxo", {
      backendUrl:    API_URL,
      oauthEndpoint: `${API_URL}/api/auth/google`,
      callbackPage:  `${window.location.origin}/auth/callback`,
      timestamp:     new Date().toISOString(),
    });

    setLoadingGoogle(true);
    logger.event("AUTH:GOOGLE", "Usuário clicou em Continuar com Google");

    // ⚠️  Delay mínimo para o spinner renderizar antes do redirect
    setTimeout(() => {
      logger.oauth("Redirecionando para backend OAuth...", { url: `${API_URL}/api/auth/google` });
      window.location.href = `${API_URL}/api/auth/google`;
    }, 150);
  }

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 relative overflow-hidden">

      {/* BACKGROUND GLOW AMBIENT */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(16,185,129,0.04) 0%, transparent 70%)" }} />

      {/* GRID PATTERN */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      {/* LOGO */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="absolute top-6 left-1/2 -translate-x-1/2">
        <button onClick={() => { logger.nav("/"); router.push("/"); }} className="text-white font-semibold text-sm tracking-tight hover:text-emerald-400 transition-colors">
          NexaSpark
        </button>
      </motion.div>

      {/* CARD */}
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-sm relative z-10">
        <div className="rounded-2xl border border-white/[0.08] p-8 relative z-10" style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}>

          {/* HEADER */}
          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-900/40 flex items-center justify-center mb-5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-1">Acessar plataforma</h1>
            <p className="text-gray-500 text-sm">Bem-vindo de volta à NexaSpark.</p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* EMAIL */}
            <div className="relative">
              <label htmlFor="email" className={`absolute left-3 transition-all duration-200 pointer-events-none text-xs font-medium ${focused === "email" || email ? "-top-2 text-emerald-400 bg-black px-1" : "top-3.5 text-gray-500"}`}>E-mail</label>
              <input
                ref={emailRef}
                id="email" type="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onFocus={() => { setFocused("email"); logger.event("UX", "Campo email focado"); }}
                onBlur={() => setFocused(null)}
                autoComplete="email"
                disabled={loading || loadingGoogle}
                className={`w-full bg-white/[0.04] border rounded-lg px-3 pt-5 pb-2.5 text-sm text-white outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${focused === "email" ? "border-emerald-500/60" : "border-white/[0.08] hover:border-white/[0.15]"}`}
              />
            </div>

            {/* SENHA */}
            <div className="relative">
              <label htmlFor="password" className={`absolute left-3 transition-all duration-200 pointer-events-none text-xs font-medium ${focused === "password" || password ? "-top-2 text-emerald-400 bg-black px-1" : "top-3.5 text-gray-500"}`}>Senha</label>
              <input
                id="password" type={showPass ? "text" : "password"} value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onFocus={() => { setFocused("password"); logger.event("UX", "Campo senha focado"); }}
                onBlur={() => setFocused(null)}
                autoComplete="current-password"
                disabled={loading || loadingGoogle}
                className={`w-full bg-white/[0.04] border rounded-lg px-3 pt-5 pb-2.5 pr-10 text-sm text-white outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${focused === "password" ? "border-emerald-500/60" : "border-white/[0.08] hover:border-white/[0.15]"}`}
              />
              <button type="button" onClick={() => { setShowPass((v) => !v); logger.event("UX", `Senha ${showPass ? "ocultada" : "exibida"}`); }} className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>

            {/* ERRO */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -6, height: 0 }} transition={{ duration: 0.2 }} className="flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-900/40">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-red-400 text-xs leading-relaxed">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* BOTÃO ENTRAR */}
            <button type="submit" disabled={loading || loadingGoogle} onClick={() => !loading && logger.event("AUTH", "Botão Entrar clicado")} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] text-sm flex items-center justify-center gap-2">
              {loading ? (<><svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Verificando...</>) : "Entrar"}
            </button>

          </form>

          {/* DIVIDER */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-gray-600">ou</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* GOOGLE LOGIN */}
          <button type="button" onClick={handleGoogleLogin} disabled={loading || loadingGoogle} className="w-full flex items-center justify-center gap-3 border border-white/[0.08] hover:border-white/[0.18] bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm py-3 rounded-lg transition-all duration-200 group relative z-10 cursor-pointer">
            {loadingGoogle ? (
              <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span className="text-gray-400">Redirecionando para Google...</span></>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg><span className="text-gray-300 group-hover:text-white transition-colors">Continuar com Google</span></>
            )}
          </button>

        </div>

        {/* LINKS */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-gray-600 text-xs">
            Problemas com acesso?{" "}
            <a href="https://wa.me/5519982714815?text=Preciso%20de%20ajuda%20para%20acessar%20a%20NexaSpark" target="_blank" rel="noopener noreferrer" onClick={() => logger.event("AUTH", "Suporte via WhatsApp clicado")} className="text-emerald-500 hover:text-emerald-400 transition-colors">
              Falar com suporte
            </a>
          </p>
          <p className="text-gray-700 text-xs">© {new Date().getFullYear()} NexaSpark</p>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================
// 🔐 EXPORT DEFAULT — LoginPage
//
// ⚠️  ÚNICO PROPÓSITO: envolver LoginInner em <Suspense>.
//     Nunca adicione lógica aqui — tudo vai em LoginInner.
//
// Por que Suspense aqui e não em layout.tsx?
//   O Suspense deve estar o mais próximo possível do componente
//   que usa useSearchParams() para minimizar a área de fallback.
//   Um Suspense no layout envolveria toda a árvore desnecessariamente.
// ============================================================
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginInner />
    </Suspense>
  );
}