"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
  event:   (scope: string, action: string, data?: any) => console.log(`%c${LOG_PREFIX} 🎯 [${scope}]%c ACTION → ${action}`, "color:#f472b6;font-weight:bold;", "color:inherit;", data ?? ""),
  mount:   (c: string) => console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}> renderizado`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) => console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}> destruído`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
  nav:     (dest: string) => console.log(`%c${LOG_PREFIX} 🧭 [NAV]%c Navegando → ${dest}`, "color:#fb923c;font-weight:bold;", "color:inherit;"),
  auth:    (msg: string, data?: any) => console.log(`%c${LOG_PREFIX} 🔐 [AUTH]%c ${msg}`, "color:#c084fc;font-weight:bold;", "color:inherit;", data ?? ""),
};

// ============================================================
// 🔐 LOGIN PAGE
// ============================================================
export default function Login() {
  const router = useRouter();

  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]    = useState(false);
  const [loading, setLoading]      = useState(false);
  const [error, setError]          = useState("");
  const [focused, setFocused]      = useState<"email" | "password" | null>(null);
  const [attempts, setAttempts]    = useState(0);

  const emailRef    = useRef<HTMLInputElement>(null);
  const t0Ref       = useRef(0);

  useEffect(() => {
    logger.mount("Login");
    logger.info("AUTH", "Página de login carregada");

    // ✅ Se já tem token, redireciona direto
    const token = localStorage.getItem("token");
    if (token) {
      logger.auth("Token existente detectado — redirecionando para dashboard");
      logger.nav("/dashboard");
      router.replace("/dashboard");
      return;
    }

    logger.auth("Nenhuma sessão ativa — exibindo formulário de login");

    // Foco automático no campo email
    setTimeout(() => emailRef.current?.focus(), 600);

    return () => logger.unmount("Login");
  }, []);

  // ── Validação client-side ────────────────────────────────
  function validate(): string | null {
    if (!email.trim())           return "Informe seu e-mail.";
    if (!/\S+@\S+\.\S+/.test(email)) return "E-mail inválido.";
    if (!password)               return "Informe sua senha.";
    if (password.length < 6)    return "Senha deve ter no mínimo 6 caracteres.";
    return null;
  }

  // ── Submit ───────────────────────────────────────────────
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

    logger.auth("Tentativa de login iniciada", { email, attempt: attempts + 1 });
    logger.event("AUTH", "Form submetido", { email });

    try {
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });

      const data = await res.json();
      const ms   = performance.now() - t0Ref.current;

      logger.perf("AUTH", "Resposta do servidor recebida", ms);

      if (!res.ok) {
        logger.warn("AUTH", `Login rejeitado: ${data.message || res.status}`, { status: res.status });
        setError(data.message || "Credenciais inválidas. Verifique e tente novamente.");
        setLoading(false);
        return;
      }

      // ✅ Sucesso
      logger.auth("Login bem-sucedido — armazenando token");
      localStorage.setItem("token", data.token);

      logger.success("AUTH", "Token armazenado ✅");
      logger.nav("/dashboard");
      logger.perf("LOGIN-FLOW", "Login completo (form → dashboard)", ms);

      router.replace("/dashboard");

    } catch (err: any) {
      const ms = performance.now() - t0Ref.current;
      logger.error("AUTH", `Erro de rede ou servidor: ${err.message}`, { err, ms });
      setError("Não foi possível conectar ao servidor. Tente novamente.");
      setLoading(false);
    }
  }

  // ── Google OAuth (preparado — ativa quando backend estiver pronto) ──
  function handleGoogleLogin() {
  logger.auth("Google OAuth iniciado");
  logger.event("AUTH", "Usuário clicou em Entrar com Google");
  logger.warn("AUTH", "Google OAuth ainda não configurado no backend — aguardando integração");
  // TODO: quando backend estiver pronto, descomentar:
  // window.location.href = "/api/auth/google";
}

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 relative overflow-hidden">

      {/* BACKGROUND GLOW AMBIENT */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(16,185,129,0.04) 0%, transparent 70%)",
        }}
      />

      {/* GRID PATTERN SUTIL */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* LOGO NO TOPO */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute top-6 left-1/2 -translate-x-1/2"
      >
        <button
          onClick={() => { logger.nav("/"); router.push("/"); }}
          className="text-white font-semibold text-sm tracking-tight hover:text-emerald-400 transition-colors"
        >
          NexaSpark
        </button>
      </motion.div>

      {/* CARD */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* CARD CONTAINER */}
        <div
  className="rounded-2xl border border-white/[0.08] p-8 relative z-10"
  style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}
>

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
              <label
                htmlFor="email"
                className={`absolute left-3 transition-all duration-200 pointer-events-none text-xs font-medium ${
                  focused === "email" || email
                    ? "-top-2 text-emerald-400 bg-black px-1"
                    : "top-3.5 text-gray-500"
                }`}
              >
                E-mail
              </label>
              <input
                ref={emailRef}
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onFocus={() => { setFocused("email"); logger.event("UX", "Campo email focado"); }}
                onBlur={() => setFocused(null)}
                autoComplete="email"
                className={`w-full bg-white/[0.04] border rounded-lg px-3 pt-5 pb-2.5 text-sm text-white outline-none transition-all duration-200 ${
                  focused === "email"
                    ? "border-emerald-500/60"
                    : "border-white/[0.08] hover:border-white/[0.15]"
                }`}
              />
            </div>

            {/* SENHA */}
            <div className="relative">
              <label
                htmlFor="password"
                className={`absolute left-3 transition-all duration-200 pointer-events-none text-xs font-medium ${
                  focused === "password" || password
                    ? "-top-2 text-emerald-400 bg-black px-1"
                    : "top-3.5 text-gray-500"
                }`}
              >
                Senha
              </label>
              <input
                id="password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onFocus={() => { setFocused("password"); logger.event("UX", "Campo senha focado"); }}
                onBlur={() => setFocused(null)}
                autoComplete="current-password"
                className={`w-full bg-white/[0.04] border rounded-lg px-3 pt-5 pb-2.5 pr-10 text-sm text-white outline-none transition-all duration-200 ${
                  focused === "password"
                    ? "border-emerald-500/60"
                    : "border-white/[0.08] hover:border-white/[0.15]"
                }`}
              />
              {/* TOGGLE SENHA */}
              <button
                type="button"
                onClick={() => { setShowPass((v) => !v); logger.event("UX", `Senha ${showPass ? "ocultada" : "exibida"}`); }}
                className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {/* MENSAGEM DE ERRO */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-900/40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-red-400 text-xs leading-relaxed">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* BOTÃO ENTRAR */}
            <button
              type="submit"
              disabled={loading}
              onClick={() => !loading && logger.event("AUTH", "Botão Entrar clicado")}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Verificando...
                </>
              ) : (
                "Entrar"
              )}
            </button>

          </form>

          {/* DIVIDER */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-gray-600">ou</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* GOOGLE LOGIN
              ✅ PREPARADO — botão funcional visualmente.
              🔧 Para ativar: configurar Google OAuth no backend
                 e descomentar a linha no handleGoogleLogin()
          */}
          <button
  type="button"
  onClick={handleGoogleLogin}
  className="w-full flex items-center justify-center gap-3 border border-white/[0.08] hover:border-white/[0.18] bg-white/[0.03] hover:bg-white/[0.06] text-white text-sm py-3 rounded-lg transition-all duration-200 group relative z-10 cursor-pointer"
>
            {/* Logo Google SVG oficial */}
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-gray-300 group-hover:text-white transition-colors">
              Continuar com Google
            </span>
          </button>

        </div>

        {/* LINKS ABAIXO DO CARD */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-gray-600 text-xs">
            Problemas com acesso?{" "}
            <a
              href="https://wa.me/5519982714815?text=Preciso%20de%20ajuda%20para%20acessar%20a%20NexaSpark"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logger.event("AUTH", "Suporte via WhatsApp clicado")}
              className="text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Falar com suporte
            </a>
          </p>
          <p className="text-gray-700 text-xs">
            © {new Date().getFullYear()} NexaSpark
          </p>
        </div>

      </motion.div>
    </div>
  );
}