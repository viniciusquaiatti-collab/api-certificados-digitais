"use client";

// ============================================================
// 🔁 NexaSpark — /auth/callback/page.tsx
//
// ⚠️  ARQUITETURA Next.js 16 — SUSPENSE OBRIGATÓRIO:
//     useSearchParams() DEVE estar dentro de <Suspense>.
//
// ESTRUTURA:
//   AuthCallbackLoading → fallback durante hidratação
//   AuthCallbackInner   → lógica + useSearchParams() (dentro do Suspense)
//   AuthCallbackPage    → export default, apenas wrapper <Suspense>
//
// RESPONSABILIDADE:
//   Captura o JWT enviado pelo backend via ?token=xxx após
//   autenticação Google OAuth bem-sucedida, salva no
//   localStorage + cookie e redireciona para /dashboard.
// ============================================================

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Frontend
// ============================================================
const LOG_PREFIX = "[NexaSpark:AuthCallback]";

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
  oauth:   (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🌐 [OAUTH]%c ${msg}`, "color:#22d3ee;font-weight:bold;", "color:inherit;", data ?? ""),
  sec:     (msg: string, data?: any) =>
    console.warn(`%c${LOG_PREFIX} 🚨 [SEC]%c ${msg}`, "color:#ef4444;font-weight:bold;", "color:inherit;", data ?? ""),
  sep:     () => console.log("%c" + "─".repeat(60), "color:#374151;"),
  bigsep:  () => console.log("%c" + "═".repeat(60), "color:#374151;"),
};

// ============================================================
// 🗺️  MAPA DE ERROS OAUTH
// ============================================================
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed:  "A autenticação com Google falhou. Tente novamente.",
  oauth_failed:        "Erro no fluxo de autenticação. Tente novamente.",
  NO_USER:             "Perfil do Google não disponível. Tente com outra conta.",
  oauth_invalid_user:  "Dados do perfil Google inválidos.",
  oauth_server_error:  "Erro interno no servidor. Tente mais tarde.",
  user_not_found:      "Usuário não encontrado após autenticação.",
  token_error:         "Erro ao gerar sessão. Tente novamente.",
  invalid_token:       "Token inválido recebido do servidor.",
};

type PageStatus = "processing" | "success" | "error";

// ============================================================
// ⏳ LOADING FALLBACK — exibido enquanto o Suspense hidrata
// ============================================================
function AuthCallbackLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-900/40 flex items-center justify-center mx-auto mb-6">
          <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
        <p className="text-white font-semibold text-lg mb-2">Autenticando...</p>
        <p className="text-gray-500 text-sm">Verificando suas credenciais Google</p>
      </div>
    </div>
  );
}

// ============================================================
// 🔁 AUTH CALLBACK INNER — lógica real com useSearchParams()
// ⚠️  DEVE ser filho de <Suspense> — nunca exporte diretamente
// ============================================================
function AuthCallbackInner() {
  const router       = useRouter();
  const searchParams = useSearchParams(); // ← dentro de <Suspense>

  const [status,       setStatus]       = useState<PageStatus>("processing");
  const [errorMessage, setErrorMessage] = useState("");
  const [userInfo,     setUserInfo]     = useState<{ email?: string; nome?: string; provider?: string } | null>(null);
  const [countdown,    setCountdown]    = useState(3);

  useEffect(() => {
    const t0 = performance.now();

    logger.bigsep();
    logger.oauth("Página /auth/callback carregada");
    logger.info("INIT", "Processando retorno do OAuth...", {
      url:       window.location.href,
      timestamp: new Date().toISOString(),
    });

    const token      = searchParams.get("token");
    const errorParam = searchParams.get("error");
    const errorCode  = searchParams.get("code");

    logger.info("PARAMS", "Parâmetros recebidos na URL", {
      hasToken:    !!token,
      tokenSize:   token?.length ?? 0,
      hasError:    !!errorParam,
      errorParam,
      errorCode,
      tokenPrefix: token ? token.substring(0, 25) + "..." : null,
    });

    // ── CASO 1: Erro vindo do backend ─────────────────────────
    if (errorParam) {
      logger.error("OAUTH", "Erro OAuth detectado", { error: errorParam, code: errorCode });

      const friendlyMsg =
        OAUTH_ERROR_MESSAGES[errorParam] ||
        OAUTH_ERROR_MESSAGES[errorCode || ""] ||
        `Erro de autenticação: ${errorParam}`;

      window.history.replaceState({}, "", "/auth/callback");
      logger.info("SEC", "URL limpa via replaceState");

      setStatus("error");
      setErrorMessage(friendlyMsg);

      let remaining = 3;
      const interval = setInterval(() => {
        remaining--;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          router.replace(`/login?error=${errorParam}`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }

    // ── CASO 2: Sem token e sem erro ──────────────────────────
    if (!token) {
      logger.warn("OAUTH", "Nenhum token recebido — acesso direto à página?");
      logger.sec("Possível acesso direto sem fluxo OAuth", { referrer: document.referrer || "none" });
      router.replace("/login");
      return;
    }

    // ── CASO 3: Token recebido — processa ─────────────────────
    logger.oauth("Token JWT recebido do backend");

    // ⚠️  SEGURANÇA: remove da URL IMEDIATAMENTE
    //     Token na URL fica no browser history
    window.history.replaceState({}, "", "/auth/callback");
    logger.sec("Token removido da URL via replaceState ✅");

    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error(`JWT malformado — ${parts.length} partes`);

      const payloadRaw = parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(parts[1].length + (4 - parts[1].length % 4) % 4, "=");

      const payload = JSON.parse(atob(payloadRaw));

      logger.oauth("Payload JWT decodificado", {
        userId:    payload.id,
        email:     payload.email,
        nome:      payload.nome     || null,
        avatar:    payload.avatar   ? "[present]" : null,
        provider:  payload.auth_provider || "google",
        role:      payload.role,
        issuer:    payload.iss,
        issuedAt:  new Date((payload.iat || 0) * 1000).toISOString(),
        expiresAt: new Date((payload.exp || 0) * 1000).toISOString(),
        tokenSize: token.length,
      });

      // Valida expiração
      const isExpired = Date.now() > (payload.exp || 0) * 1000;
      if (isExpired) {
        logger.sec("Token expirado recebido!", { expiredAt: new Date((payload.exp || 0) * 1000).toISOString() });
        throw new Error("Token expirado recebido do servidor");
      }

      // Salva token
      logger.info("STORAGE", "Salvando token...");
      localStorage.setItem("token", token);
      document.cookie = `token=${token}; path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;

      logger.success("STORAGE", "Token salvo — localStorage + cookie (7d) ✅", {
        userId:   payload.id,
        email:    payload.email,
        provider: payload.auth_provider,
      });

      setUserInfo({
        email:    payload.email,
        nome:     payload.nome || payload.email?.split("@")[0],
        provider: payload.auth_provider || "google",
      });

      const totalMs = performance.now() - t0;
      logger.perf("CALLBACK", "Processamento completo", totalMs);
      logger.success("OAUTH", "══ OAUTH CALLBACK CONCLUÍDO ══", {
        userId:   payload.id,
        email:    payload.email,
        provider: payload.auth_provider,
        totalMs:  totalMs.toFixed(2) + "ms",
      });
      logger.bigsep();

      setStatus("success");

      setTimeout(() => {
        logger.info("NAV", "Redirecionando para /dashboard...");
        router.replace("/dashboard");
      }, 1200);

    } catch (decodeErr: any) {
      logger.error("TOKEN", "Erro ao processar JWT", { message: decodeErr.message });
      console.error(decodeErr.stack);

      setStatus("error");
      setErrorMessage("Token inválido. Tente fazer login novamente.");

      let remaining = 3;
      const interval = setInterval(() => {
        remaining--;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          router.replace("/login?error=invalid_token");
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, []);

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 relative overflow-hidden">

      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)" }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <AnimatePresence mode="wait">

        {/* PROCESSING */}
        {status === "processing" && (
          <motion.div key="processing" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4 }} className="text-center relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-900/40 flex items-center justify-center mx-auto mb-6">
              <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
            <p className="text-white font-semibold text-lg mb-2">Autenticando...</p>
            <p className="text-gray-500 text-sm">Verificando suas credenciais Google</p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}

        {/* SUCCESS */}
        {status === "success" && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="text-center relative z-10">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }} className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </motion.div>
            <p className="text-white font-semibold text-lg mb-1">Autenticado com sucesso!</p>
            {userInfo?.nome && <p className="text-emerald-400 text-sm mb-1">Bem-vindo, {userInfo.nome.split(" ")[0]}</p>}
            {userInfo?.email && <p className="text-gray-500 text-xs mb-4">{userInfo.email}</p>}
            <p className="text-gray-600 text-xs">Redirecionando para o dashboard...</p>
          </motion.div>
        )}

        {/* ERROR */}
        {status === "error" && (
          <motion.div key="error" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4 }} className="text-center relative z-10 max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-900/40 flex items-center justify-center mx-auto mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <p className="text-white font-semibold text-lg mb-2">Falha na autenticação</p>
            <p className="text-red-400 text-sm mb-4 leading-relaxed">{errorMessage}</p>
            <p className="text-gray-600 text-xs">
              Redirecionando em <span className="text-gray-400 font-medium">{countdown}s</span>...
            </p>
            <button onClick={() => router.replace("/login")} className="mt-4 text-emerald-500 hover:text-emerald-400 text-xs transition-colors underline underline-offset-2">
              Ir para login agora
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ============================================================
// 🔁 EXPORT DEFAULT — AuthCallbackPage
//
// ⚠️  ÚNICO PROPÓSITO: envolver AuthCallbackInner em <Suspense>.
//     Nunca adicione lógica aqui.
// ============================================================
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackInner />
    </Suspense>
  );
}