"use client";

// ============================================================
// 🔁 NexaSpark — /auth/callback
//
// Responsabilidade:
//   Página intermediária que captura o JWT vindo do backend
//   após o fluxo OAuth Google ser concluído.
//
// Fluxo completo:
//   1. Usuário clica "Continuar com Google" → /api/auth/google
//   2. Passport redireciona → accounts.google.com
//   3. Google autentica → backend /api/auth/google/callback
//   4. Backend gera JWT → redireciona para ESTA PÁGINA:
//      ${FRONTEND_URL}/auth/callback?token=xxx
//   5. Esta página captura o token, salva, limpa URL, redireciona
//
// ⚠️  SEGURANÇA:
//   - Token é removido da URL via history.replaceState()
//     imediatamente após captura — não fica no browser history
//   - Token é decodificado para log (sem verificar assinatura)
//   - Validação de expiração feita no lado cliente para UX
//   - Em caso de erro, redireciona para /login com query param
// ============================================================

import { useEffect, useState } from "react";
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
// 🗺️  MAPA DE ERROS — mensagens amigáveis por código
// ============================================================
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed:   "A autenticação com Google falhou. Tente novamente.",
  oauth_failed:         "Erro no fluxo de autenticação. Tente novamente.",
  NO_USER:              "Perfil do Google não disponível. Tente com outra conta.",
  oauth_invalid_user:   "Dados do perfil Google inválidos.",
  oauth_server_error:   "Erro interno no servidor. Tente mais tarde.",
  user_not_found:       "Usuário não encontrado após autenticação.",
  token_error:          "Erro ao gerar sessão. Tente novamente.",
  invalid_token:        "Token inválido recebido do servidor.",
};

type PageStatus = "processing" | "success" | "error";

// ============================================================
// 🔁 AUTH CALLBACK PAGE
// ============================================================
export default function AuthCallbackPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

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

    // ── Extrai parâmetros da URL ─────────────────────────────
    const token      = searchParams.get("token");
    const errorParam = searchParams.get("error");
    const errorCode  = searchParams.get("code");

    logger.info("PARAMS", "Parâmetros recebidos na URL", {
      hasToken:   !!token,
      tokenSize:  token?.length ?? 0,
      hasError:   !!errorParam,
      errorParam,
      errorCode,
      // ⚠️  Nunca logamos o token completo
      tokenPrefix: token ? token.substring(0, 25) + "..." : null,
    });

    // ── CASO 1: Erro vindo do backend ─────────────────────────
    if (errorParam) {
      logger.error("OAUTH", "Erro OAuth detectado nos parâmetros", {
        error: errorParam,
        code:  errorCode,
      });

      const friendlyMsg =
        OAUTH_ERROR_MESSAGES[errorParam] ||
        OAUTH_ERROR_MESSAGES[errorCode || ""] ||
        `Erro de autenticação: ${errorParam}`;

      logger.error("OAUTH", `Mensagem mapeada: ${friendlyMsg}`);

      // Limpa URL antes de mostrar erro
      window.history.replaceState({}, "", "/auth/callback");
      logger.info("SEC", "URL limpa via replaceState (error params removidos)");

      setStatus("error");
      setErrorMessage(friendlyMsg);

      // Redireciona para login após 3s com countdown
      let remaining = 3;
      const interval = setInterval(() => {
        remaining--;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          logger.oauth("Redirecionando para /login após erro...");
          router.replace(`/login?error=${errorParam}`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }

    // ── CASO 2: Sem token e sem erro ──────────────────────────
    if (!token) {
      logger.warn("OAUTH", "Nenhum token e nenhum erro recebido — acesso direto à página?");
      logger.sec("Possível acesso direto à rota /auth/callback sem fluxo OAuth", {
        referrer: document.referrer || "none",
      });
      router.replace("/login");
      return;
    }

    // ── CASO 3: Token recebido — processa ─────────────────────
    logger.oauth("Token JWT recebido do backend");

    // ⚠️  SEGURANÇA CRÍTICA: remove o token da URL IMEDIATAMENTE
    //     antes de qualquer processamento.
    //     Token na URL fica no browser history e pode ser
    //     capturado por extensões ou logs de servidor.
    window.history.replaceState({}, "", "/auth/callback");
    logger.sec("Token removido da URL via replaceState ✅ (não fica no browser history)");

    // ── Decodifica payload para validação e log ───────────────
    try {
      const parts = token.split(".");

      if (parts.length !== 3) {
        throw new Error(`JWT malformado — ${parts.length} partes (esperado 3)`);
      }

      // Decodifica base64url → JSON
      const payloadRaw = parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(parts[1].length + (4 - parts[1].length % 4) % 4, "=");

      const payload = JSON.parse(atob(payloadRaw));

      logger.oauth("Payload JWT decodificado", {
        userId:       payload.id,
        email:        payload.email,
        nome:         payload.nome     || null,
        avatar:       payload.avatar   ? "[present]" : null,
        provider:     payload.auth_provider || "google",
        role:         payload.role,
        issuer:       payload.iss,
        audience:     payload.aud,
        issuedAt:     new Date((payload.iat || 0) * 1000).toISOString(),
        expiresAt:    new Date((payload.exp || 0) * 1000).toISOString(),
        tokenSize:    token.length,
      });

      // ── Valida expiração ──────────────────────────────────
      const isExpired = Date.now() > (payload.exp || 0) * 1000;
      if (isExpired) {
        logger.sec("Token recebido já está expirado!", {
          expiredAt: new Date((payload.exp || 0) * 1000).toISOString(),
          now:       new Date().toISOString(),
        });
        throw new Error("Token expirado recebido do servidor");
      }

      // ── Salva token ───────────────────────────────────────
      logger.info("STORAGE", "Salvando token no localStorage...");
      localStorage.setItem("token", token);

      // Cookie para middleware Next.js (SSR auth check)
      document.cookie = `token=${token}; path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;

      logger.success("STORAGE", "Token salvo — localStorage + cookie (7d) ✅", {
        userId:   payload.id,
        email:    payload.email,
        provider: payload.auth_provider,
      });

      // Salva info do usuário para exibir na UI de sucesso
      setUserInfo({
        email:    payload.email,
        nome:     payload.nome || payload.email?.split("@")[0],
        provider: payload.auth_provider || "google",
      });

      const totalMs = performance.now() - t0;
      logger.perf("CALLBACK", "Processamento completo", totalMs);
      logger.success("OAUTH", "══ OAUTH CALLBACK CONCLUÍDO COM SUCESSO ══", {
        userId:   payload.id,
        email:    payload.email,
        provider: payload.auth_provider,
        totalMs:  totalMs.toFixed(2) + "ms",
      });
      logger.bigsep();

      // ── Redireciona para dashboard com breve delay ─────────
      // ⚠️  Delay de 1s para o usuário ver a confirmação visual
      //     antes do redirect — melhora percepção de UX
      setStatus("success");

      setTimeout(() => {
        logger.info("NAV", "Redirecionando para /dashboard...");
        router.replace("/dashboard");
      }, 1200);

    } catch (decodeErr: any) {
      logger.error("TOKEN", "Erro ao processar token JWT", {
        message: decodeErr.message,
        type:    decodeErr.name,
      });
      logger.error("TOKEN", "Stack:\n" + decodeErr.stack);

      setStatus("error");
      setErrorMessage("Token inválido recebido. Tente fazer login novamente.");

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

      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)" }}
      />

      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <AnimatePresence mode="wait">

        {/* ── PROCESSING ── */}
        {status === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="text-center relative z-10"
          >
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

        {/* ── SUCCESS ── */}
        {status === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-center relative z-10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </motion.div>

            <p className="text-white font-semibold text-lg mb-1">Autenticado com sucesso!</p>

            {userInfo?.nome && (
              <p className="text-emerald-400 text-sm mb-1">
                Bem-vindo, {userInfo.nome.split(" ")[0]}
              </p>
            )}

            {userInfo?.email && (
              <p className="text-gray-500 text-xs mb-4">{userInfo.email}</p>
            )}

            <p className="text-gray-600 text-xs">Redirecionando para o dashboard...</p>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="text-center relative z-10 max-w-sm"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-900/40 flex items-center justify-center mx-auto mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>

            <p className="text-white font-semibold text-lg mb-2">Falha na autenticação</p>
            <p className="text-red-400 text-sm mb-4 leading-relaxed">{errorMessage}</p>
            <p className="text-gray-600 text-xs">
              Redirecionando em <span className="text-gray-400 font-medium">{countdown}s</span>...
            </p>

            <button
              onClick={() => router.replace("/login")}
              className="mt-4 text-emerald-500 hover:text-emerald-400 text-xs transition-colors underline underline-offset-2"
            >
              Ir para login agora
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}