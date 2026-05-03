"use client";

// ============================================================
// 🏢 NexaSpark — /dashboard/page.tsx
//
// Responsabilidades:
//   1. Valida JWT via /api/auth/me ao montar
//   2. Exibe dados do usuário autenticado
//   3. Permite emissão de certificados via /api/certificates
//   4. Gerencia logout limpando token do localStorage + cookie
//
// ⚠️  CORREÇÃO CRÍTICA:
//     O original usava http://localhost:8080 hardcoded.
//     Em produção isso chamava o localhost do USUÁRIO (que não
//     tem nada rodando), a fetch falhava, o token era removido
//     e o usuário era jogado de volta pro /login imediatamente.
//
// ✅  CORREÇÃO: NEXT_PUBLIC_API_URL aponta para o Railway.
// ============================================================

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Frontend
// Padrão idêntico ao backend — colored console com prefixos.
// ============================================================
const LOG_PREFIX = "[NexaSpark:Dashboard]";

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
  cert:    (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🎓 [CERT]%c ${msg}`, "color:#f472b6;font-weight:bold;", "color:inherit;", data ?? ""),
  sec:     (msg: string, data?: any) =>
    console.warn(`%c${LOG_PREFIX} 🚨 [SEC]%c ${msg}`, "color:#ef4444;font-weight:bold;", "color:inherit;", data ?? ""),
  mount:   (c: string) =>
    console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}> renderizado`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) =>
    console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}> destruído`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
  nav:     (dest: string) =>
    console.log(`%c${LOG_PREFIX} 🧭 [NAV]%c Navegando → ${dest}`, "color:#fb923c;font-weight:bold;", "color:inherit;"),
  sep:     () => console.log("%c" + "─".repeat(60), "color:#374151;"),
};

// ============================================================
// 🌐 API BASE URL — fonte única de verdade
//
// ⚠️  CRÍTICO: deve ser NEXT_PUBLIC_API_URL (Railway), não
//     localhost. Em produção, localhost não tem servidor.
// ============================================================
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================================
// 📋 TIPOS
// ============================================================
interface User {
  id:            number;
  email:         string;
  nome?:         string;
  avatar?:       string;
  auth_provider?: string;
  criado_em?:    string;
}

interface CertForm {
  nome_participante: string;
  cpf:               string;
  nome_curso:        string;
  carga_horaria:     string;
  data_emissao:      string;
}

// ============================================================
// 🏠 DASHBOARD
// ============================================================
export default function Dashboard() {
  const router = useRouter();

  // ── Estados ─────────────────────────────────────────────
  const [loadingAuth,   setLoadingAuth]   = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [user,          setUser]          = useState<User | null>(null);
  const [pdfUrl,        setPdfUrl]        = useState("");
  const [submitError,   setSubmitError]   = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [form, setForm] = useState<CertForm>({
    nome_participante: "",
    cpf:               "",
    nome_curso:        "",
    carga_horaria:     "",
    data_emissao:      "",
  });

  const mountTime = useRef(Date.now());

  // ============================================================
  // 🔐 VALIDAÇÃO DE SESSÃO — ao montar o componente
  //
  // ⚠️  CORREÇÃO: estava usando http://localhost:8080 que em
  //     produção chama o localhost do USUÁRIO (nada rodando lá),
  //     a fetch falhava com TypeError, o catch limpava o token
  //     e redirecionava para /login imediatamente.
  //
  // ✅  Agora usa API_URL = NEXT_PUBLIC_API_URL (Railway).
  // ============================================================
  useEffect(() => {
    logger.sep();
    logger.mount("Dashboard");
    logger.info("INIT", "Dashboard montado — iniciando validação de sessão", {
      apiUrl:    API_URL,
      timestamp: new Date().toISOString(),
    });

    async function validateAuth() {
      const t0 = performance.now();

      try {
        // ── STEP 1: Verifica token no localStorage ───────────
        const token = localStorage.getItem("token");

        logger.auth("Token encontrado no localStorage?", { hasToken: !!token });

        if (!token) {
          logger.warn("AUTH", "Nenhum token encontrado — redirecionando para login");
          logger.nav("/login");
          router.replace("/login");
          return;
        }

        // ── STEP 2: Decodifica payload para log (sem verificar assinatura) ──
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const isExpired = Date.now() > payload.exp * 1000;

          logger.auth("Token decodificado", {
            userId:    payload.id,
            email:     payload.email,
            provider:  payload.auth_provider || "local",
            expiresAt: new Date(payload.exp * 1000).toISOString(),
            isExpired,
            tokenSize: token.length,
          });

          // ⚠️  Token expirado detectado no cliente — evita round-trip desnecessário
          if (isExpired) {
            logger.warn("AUTH", "Token expirado detectado localmente — limpando sem chamada ao backend");
            localStorage.removeItem("token");
            document.cookie = "token=; Max-Age=0; path=/;";
            logger.nav("/login");
            router.replace("/login");
            return;
          }
        } catch (decodeErr) {
          logger.warn("AUTH", "Token não decodificável — continuando com validação remota", { error: String(decodeErr) });
        }

        // ── STEP 3: Valida token no backend via /api/auth/me ─
        logger.info("AUTH:HTTP", "Chamando /api/auth/me para validação remota...", {
          url: `${API_URL}/api/auth/me`,
        });

        const tFetch = performance.now();
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            // ⚠️  X-Request-ID para correlacionar com logs do Railway
            "X-Request-ID": `dashboard_auth_${Date.now()}`,
          },
        });

        const fetchMs = performance.now() - tFetch;
        logger.perf("AUTH:HTTP", "/api/auth/me", fetchMs);
        logger.info("AUTH:HTTP", "Resposta recebida", { status: response.status, ok: response.ok });

        let data: any = {};
        try {
          data = await response.json();
          logger.info("AUTH:PARSE", "Body parseado", {
            success:      data.success,
            hasUser:      !!data.data,
            userFields:   data.data ? Object.keys(data.data) : [],
            auth_provider: data.data?.auth_provider,
          });
        } catch (parseErr) {
          logger.error("AUTH:PARSE", "JSON inválido na resposta de /me", { parseErr: String(parseErr) });
          throw new Error("Resposta inválida do servidor");
        }

        if (!response.ok) {
          logger.sec("Token rejeitado pelo backend", {
            status: response.status,
            code:   data?.code,
            error:  data?.error,
          });
          throw new Error(data.error || "Token inválido");
        }

        const userData: User = data.data;
        logger.success("AUTH", "Sessão validada com sucesso ✅", {
          userId:   userData.id,
          email:    userData.email,
          provider: userData.auth_provider || "local",
        });

        const totalMs = performance.now() - t0;
        logger.perf("AUTH", "Validação completa", totalMs);

        setUser(userData);

      } catch (error: any) {
        const totalMs = performance.now() - t0;
        logger.error("AUTH", `Validação falhou após ${totalMs.toFixed(2)}ms`, {
          message: error.message,
          type:    error.name,
        });

        // ⚠️  Distingue erro de rede de token inválido
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          logger.error("AUTH:NETWORK", "Erro de rede — backend inacessível?", {
            url:     `${API_URL}/api/auth/me`,
            message: error.message,
          });
        }

        logger.warn("AUTH", "Limpando sessão inválida e redirecionando...");
        localStorage.removeItem("token");
        document.cookie = "token=; Max-Age=0; path=/;";
        logger.nav("/login");
        router.replace("/login");
      } finally {
        logger.info("AUTH", "Validação finalizada — setLoadingAuth(false)");
        setLoadingAuth(false);
      }
    }

    validateAuth();

    return () => {
      logger.unmount("Dashboard");
      logger.perf("DASHBOARD:LIFECYCLE", "Tempo total montado", Date.now() - mountTime.current);
      logger.sep();
    };
  }, []);

  // ============================================================
  // 🚪 LOGOUT
  // ============================================================
  function handleLogout() {
    logger.sep();
    logger.event("DASHBOARD", "Logout iniciado", { userId: user?.id, email: user?.email });

    try {
      localStorage.removeItem("token");
      document.cookie = "token=; Max-Age=0; path=/;";

      logger.success("AUTH", "Token removido — localStorage + cookie limpos ✅");
      logger.nav("/login");
      router.replace("/login");
    } catch (error: any) {
      logger.error("LOGOUT", "Erro ao fazer logout", { message: error.message });
    }
  }

  // ============================================================
  // ✏️  INPUT CHANGE
  // ============================================================
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;

    logger.event("FORM", `Campo alterado: ${name}`, {
      field: name,
      // ⚠️  Não logamos CPF completo — apenas tamanho
      value: name === "cpf" ? `[${value.length} chars]` : value,
    });

    setSubmitError("");
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // ============================================================
  // 🎓 SUBMIT — Emissão de certificado
  //
  // ⚠️  CORREÇÃO: estava usando http://localhost:8080 hardcoded.
  //     Corrigido para API_URL (Railway).
  // ============================================================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);
    setPdfUrl("");

    const t0 = performance.now();
    logger.sep();
    logger.cert("Iniciando emissão de certificado...");
    logger.event("CERT", "Formulário submetido", {
      nome_participante: form.nome_participante,
      cpf:               `[${form.cpf.length} chars]`, // ⚠️  Nunca loga CPF completo
      nome_curso:        form.nome_curso,
      carga_horaria:     form.carga_horaria,
      data_emissao:      form.data_emissao,
    });

    setLoadingSubmit(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        logger.sec("Tentativa de emissão sem token", { userId: user?.id });
        throw new Error("Usuário não autenticado");
      }

      // ── Payload com carga_horaria como número ─────────────
      const payload = {
        ...form,
        carga_horaria: Number(form.carga_horaria),
      };

      logger.cert("Payload preparado", {
        ...payload,
        cpf: `[${payload.cpf.length} chars]`,
      });

      logger.info("CERT:HTTP", "Enviando POST /api/certificates...", {
        url: `${API_URL}/api/certificates`,
      });

      const tFetch = performance.now();
      const response = await fetch(`${API_URL}/api/certificates`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Request-ID":  `cert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        },
        body: JSON.stringify(payload),
      });

      const fetchMs = performance.now() - tFetch;
      logger.perf("CERT:HTTP", "Resposta recebida", fetchMs);
      logger.info("CERT:HTTP", "Status da resposta", { status: response.status, ok: response.ok });

      let data: any = {};
      try {
        data = await response.json();
        logger.info("CERT:PARSE", "Body parseado", {
          success:   data.success,
          hasPdfUrl: !!(data.data?.pdf_url || data.pdf_url),
          keys:      Object.keys(data),
        });
      } catch (parseErr) {
        logger.error("CERT:PARSE", "JSON inválido na resposta", { parseErr: String(parseErr) });
        throw new Error("Resposta inválida do servidor");
      }

      if (!response.ok) {
        logger.error("CERT", "Erro retornado pela API", {
          status: response.status,
          code:   data?.code,
          error:  data?.error,
        });

        // ⚠️  Token expirado durante emissão — limpa e redireciona
        if (response.status === 401) {
          logger.sec("Token inválido/expirado detectado na emissão — fazendo logout", { status: response.status });
          localStorage.removeItem("token");
          document.cookie = "token=; Max-Age=0; path=/;";
          logger.nav("/login");
          router.replace("/login");
          return;
        }

        throw new Error(data.error || "Erro ao emitir certificado");
      }

      // ── Sucesso ──────────────────────────────────────────
      const url = data.data?.pdf_url || data.pdf_url || data.data?.url;

      logger.cert("Certificado emitido com sucesso!", {
        pdfUrl:        url,
        certificateId: data.data?.id,
        codigo:        data.data?.codigo_verificacao,
      });

      if (!url) {
        logger.warn("CERT", "PDF não retornado na resposta", { data });
        throw new Error("PDF não foi gerado. Tente novamente.");
      }

      const totalMs = performance.now() - t0;
      logger.perf("CERT", "Emissão completa", totalMs);
      logger.success("CERT", "══ CERTIFICADO EMITIDO ══", { url, totalMs: totalMs.toFixed(2) + "ms" });

      setPdfUrl(url);
      setSubmitSuccess(true);

      // ⚠️  Reseta o formulário após sucesso
      setForm({
        nome_participante: "",
        cpf:               "",
        nome_curso:        "",
        carga_horaria:     "",
        data_emissao:      "",
      });

    } catch (error: any) {
      const totalMs = performance.now() - t0;
      logger.error("CERT", `Emissão falhou após ${totalMs.toFixed(2)}ms`, {
        message: error.message,
        type:    error.name,
      });

      setSubmitError(error.message || "Erro inesperado. Tente novamente.");
    } finally {
      logger.info("CERT", "Fluxo de emissão finalizado");
      setLoadingSubmit(false);
      logger.sep();
    }
  }

  // ============================================================
  // 🎨 RENDER — Loading Auth
  // ============================================================
  if (loadingAuth) {
    logger.info("RENDER", "Exibindo loading de autenticação...");
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-sm">Validando sessão...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // 🎨 RENDER — Sem usuário (não deve acontecer — redirect já ocorreu)
  // ============================================================
  if (!user) {
    logger.warn("RENDER", "Sem usuário após loadingAuth=false — retornando null");
    return null;
  }

  // ============================================================
  // 🎨 RENDER — Dashboard principal
  // ============================================================
  logger.info("RENDER", "Renderizando Dashboard", {
    userId:   user.id,
    email:    user.email,
    provider: user.auth_provider || "local",
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 p-8 rounded-2xl shadow-lg">

        {/* HEADER */}
        <h1 className="text-2xl font-bold mb-2 text-center">🎓 Emissão de Certificado</h1>

        <p className="text-center text-sm text-gray-400 mb-1">
          Logado como: <span className="text-emerald-400">{user.email}</span>
        </p>

        {/* Badge provider */}
        {user.auth_provider === "google" && (
          <p className="text-center text-xs text-gray-600 mb-4 flex items-center justify-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Autenticado via Google
          </p>
        )}

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          className="w-full mb-6 bg-red-600 hover:bg-red-700 active:scale-[0.98] p-2 rounded font-bold transition-all duration-200"
        >
          Sair
        </button>

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            name="nome_participante"
            value={form.nome_participante}
            placeholder="Nome do participante"
            className="w-full p-3 rounded bg-slate-800 border border-slate-700 focus:outline-none focus:border-emerald-500 transition-colors"
            onChange={handleChange}
            required
          />

          <input
            name="cpf"
            value={form.cpf}
            placeholder="CPF (XXX.XXX.XXX-XX)"
            className="w-full p-3 rounded bg-slate-800 border border-slate-700 focus:outline-none focus:border-emerald-500 transition-colors"
            onChange={handleChange}
            required
          />

          <input
            name="nome_curso"
            value={form.nome_curso}
            placeholder="Nome do curso"
            className="w-full p-3 rounded bg-slate-800 border border-slate-700 focus:outline-none focus:border-emerald-500 transition-colors"
            onChange={handleChange}
            required
          />

          <input
            name="carga_horaria"
            value={form.carga_horaria}
            placeholder="Carga horária (horas)"
            type="number"
            min="1"
            className="w-full p-3 rounded bg-slate-800 border border-slate-700 focus:outline-none focus:border-emerald-500 transition-colors"
            onChange={handleChange}
            required
          />

          <input
            name="data_emissao"
            value={form.data_emissao}
            type="date"
            className="w-full p-3 rounded bg-slate-800 border border-slate-700 focus:outline-none focus:border-emerald-500 transition-colors"
            onChange={handleChange}
            required
          />

          {/* Erro de submit */}
          {submitError && (
            <div className="flex items-start gap-2 p-3 rounded bg-red-950/40 border border-red-900/40">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-red-400 text-xs leading-relaxed">{submitError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loadingSubmit}
            onClick={() => logger.event("CERT", "Botão Emitir clicado")}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed active:scale-[0.98] p-3 rounded font-bold transition-all duration-200 flex items-center justify-center gap-2"
          >
            {loadingSubmit ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Emitindo...
              </>
            ) : "Emitir Certificado"}
          </button>

        </form>

        {/* SUCESSO + PDF */}
        {submitSuccess && pdfUrl && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-900/40 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p className="text-emerald-400 text-sm font-semibold">Certificado gerado com sucesso!</p>
            </div>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logger.event("CERT", "PDF aberto", { url: pdfUrl })}
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 text-sm transition-colors"
            >
              📄 Abrir PDF
            </a>
          </div>
        )}

      </div>
    </div>
  );
}