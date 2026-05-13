"use client";

// ============================================================
// 🏢 NexaSpark — /dashboard/page.tsx v3.1 LUXURY ENTERPRISE
//
// UPGRADE v3 — SaaS que respira:
//   ✅ Canvas de partículas flutuantes no fundo (vive sozinho)
//   ✅ Números que contam ao aparecer (counter animation)
//   ✅ Gradiente animado pulsante nos cards de métricas
//   ✅ Glow verde nos inputs ao focar
//   ✅ Timeline visual no histórico (não tabela)
//   ✅ Barra de progresso animada do plano Free
//   ✅ Sidebar com indicador de presença animado
//   ✅ Header com data/hora em tempo real
//   ✅ Animação de entrada staggered (cada elemento aparece)
//   ✅ Shimmer effect nos cards enquanto carrega
//   ✅ Todos os console.log preservados + novos
//   ✅ Session timeout 6min com aviso visual
//
// ✅ v3.1 — ADIÇÕES (zero remoção, apenas acréscimo):
//   🔐 CompleteProfileModal integrado
//      — Aparece automaticamente para usuários Google sem CPF
//      — Modal obrigatório: cpf_cadastrado === false
//      — Detectado em validateAuth() após setUser(userData)
//      — Fecha após sucesso, atualiza token, libera dashboard
//   🔐 Interface User expandida: + cpf_cadastrado?: boolean
//   🔐 Estado showCpfModal adicionado
//   🔐 logger.modal() — novo scope de log para o modal
//   🔐 Log detalhado do fluxo de detecção de CPF pendente
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter }                                 from "next/navigation";

// ✅ v3.1: import do modal obrigatório para usuários Google
import CompleteProfileModal from "./CompleteProfileModal";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Frontend v3.1
// ============================================================
const LOG_PREFIX = "[NexaSpark:Dashboard:v3.1]";

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
  table:   (scope: string, msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 📊 [${scope}]%c ${msg}`, "color:#22d3ee;font-weight:bold;", "color:inherit;", data ?? ""),
  sidebar: (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🗂️  [SIDEBAR]%c ${msg}`, "color:#818cf8;font-weight:bold;", "color:inherit;", data ?? ""),
  timeout: (msg: string, data?: any) =>
    console.warn(`%c${LOG_PREFIX} ⏰ [TIMEOUT]%c ${msg}`, "color:#fb923c;font-weight:bold;", "color:inherit;", data ?? ""),
  metrics: (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 📈 [METRICS]%c ${msg}`, "color:#4ade80;font-weight:bold;", "color:inherit;", data ?? ""),
  anim:    (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🎨 [ANIM]%c ${msg}`, "color:#f9a8d4;font-weight:bold;", "color:inherit;", data ?? ""),
  canvas:  (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🖼️  [CANVAS]%c ${msg}`, "color:#93c5fd;font-weight:bold;", "color:inherit;", data ?? ""),
  clock:   (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🕐 [CLOCK]%c ${msg}`, "color:#6ee7b7;font-weight:bold;", "color:inherit;", data ?? ""),
  // ✅ v3.1: novo scope para o modal de CPF
  modal:   (msg: string, data?: any) =>
    console.log(`%c${LOG_PREFIX} 🪟 [MODAL:CPF]%c ${msg}`, "color:#fb923c;font-weight:bold;", "color:inherit;", data ?? ""),
};

const API_URL            = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const SESSION_TIMEOUT_MS = 6 * 60 * 1000;
const PLAN_LIMIT         = 5;

// ============================================================
// 📋 TIPOS
// ============================================================
interface User {
  id:              number;
  email:           string;
  nome?:           string;
  avatar?:         string;
  auth_provider?:  string;
  // ✅ v3.1: cpf_cadastrado — controla exibição do modal
  // false = usuário Google sem CPF → modal aparece
  // true  = CPF já vinculado → dashboard liberado normalmente
  cpf_cadastrado?: boolean;
  criado_em?:      string;
}

interface Certificate {
  id:                 number;
  nome_participante:  string;
  nome_curso:         string;
  carga_horaria:      number;
  data_emissao:       string;
  codigo_verificacao: string;
  pdf_url?:           string;
  criado_em:          string;
}

interface CertForm {
  nome_participante: string;
  cpf:               string;
  nome_curso:        string;
  carga_horaria:     string;
  data_emissao:      string;
}

type ActiveTab = "emitir" | "historico" | "perfil";

// ============================================================
// 🎨 HOOK — Contador animado
// ============================================================
function useCountUp(target: number, duration = 1200, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start || target === 0) { setValue(0); return; }
    logger.anim("Counter iniciado", { target, duration });
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
      else setValue(target);
    };
    requestAnimationFrame(step);
  }, [target, start]);
  return value;
}

// ============================================================
// 🖼️  COMPONENTE — Canvas de partículas
// ============================================================
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    logger.canvas("Canvas de partículas iniciado");

    let animId: number;
    let W = 0, H = 0;

    const PARTICLE_COUNT = 55;
    type Particle = { x: number; y: number; vx: number; vy: number; r: number; alpha: number; pulse: number; speed: number };
    let particles: Particle[] = [];

    function resize() {
      W = canvas!.width  = window.innerWidth;
      H = canvas!.height = window.innerHeight;
      logger.canvas("Canvas redimensionado", { W, H });
    }

    function spawn(): Particle {
      return {
        x:     Math.random() * W,
        y:     Math.random() * H,
        vx:    (Math.random() - 0.5) * 0.3,
        vy:    (Math.random() - 0.5) * 0.3,
        r:     Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.4 + 0.05,
        pulse: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.015 + 0.005,
      };
    }

    function init() {
      particles = Array.from({ length: PARTICLE_COUNT }, spawn);
      logger.canvas("Partículas criadas", { count: PARTICLE_COUNT });
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);

      particles.forEach((p, i) => {
        p.x    += p.vx;
        p.y    += p.vy;
        p.pulse += p.speed;

        // wrap around
        if (p.x < -5)    p.x = W + 5;
        if (p.x > W + 5) p.x = -5;
        if (p.y < -5)    p.y = H + 5;
        if (p.y > H + 5) p.y = -5;

        const a = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(16,185,129,${a})`;
        ctx!.fill();

        // linhas entre partículas próximas
        for (let j = i + 1; j < particles.length; j++) {
          const q    = particles[j];
          const dx   = p.x - q.x, dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(q.x, q.y);
            ctx!.strokeStyle = `rgba(16,185,129,${0.06 * (1 - dist / 120)})`;
            ctx!.lineWidth   = 0.5;
            ctx!.stroke();
          }
        }
      });

      animId = requestAnimationFrame(draw);
    }

    resize();
    init();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      logger.canvas("Canvas destruído");
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.6 }}
    />
  );
}

// ============================================================
// 🕐 HOOK — Relógio em tempo real
// ============================================================
function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1000);
    logger.clock("Relógio iniciado");
    return () => clearInterval(id);
  }, []);
  return time;
}

// ============================================================
// 🏠 DASHBOARD ENTERPRISE v3.1
// ============================================================
export default function Dashboard() {
  const router = useRouter();
  const clock  = useClock();

  const [loadingAuth,      setLoadingAuth]      = useState(true);
  const [loadingSubmit,    setLoadingSubmit]     = useState(false);
  const [loadingCerts,     setLoadingCerts]      = useState(false);
  const [user,             setUser]              = useState<User | null>(null);
  const [certificates,     setCertificates]      = useState<Certificate[]>([]);
  const [pdfUrl,           setPdfUrl]            = useState("");
  const [submitError,      setSubmitError]       = useState("");
  const [submitSuccess,    setSubmitSuccess]     = useState(false);
  const [activeTab,        setActiveTab]         = useState<ActiveTab>("emitir");
  const [sidebarCollapsed, setSidebarCollapsed]  = useState(false);
  const [timeoutWarning,   setTimeoutWarning]    = useState(false);
  const [mounted,          setMounted]           = useState(false);
  const [countStart,       setCountStart]        = useState(false);

  // ✅ v3.1: estado do modal de CPF obrigatório para usuários Google
  // true  = modal visível, bloqueia interação com o dashboard
  // false = modal oculto, dashboard totalmente acessível
  const [showCpfModal,     setShowCpfModal]      = useState(false);

  const mountTime  = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);

  const [form, setForm] = useState<CertForm>({
    nome_participante: "",
    cpf:               "",
    nome_curso:        "",
    carga_horaria:     "",
    data_emissao:      new Date().toISOString().split("T")[0],
  });

  // Métricas calculadas
  const metricsThisMonth = certificates.filter(c => {
    const d = new Date(c.criado_em), n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  // Counters animados
  const countMonth = useCountUp(metricsThisMonth, 900, countStart);
  const countTotal = useCountUp(certificates.length, 1200, countStart);

  // Inicia contagem após montar
  useEffect(() => {
    if (!loadingAuth && user) {
      setTimeout(() => {
        setMounted(true);
        setTimeout(() => setCountStart(true), 300);
        logger.anim("Animações de entrada disparadas");
      }, 100);
    }
  }, [loadingAuth, user]);

  // ============================================================
  // ⏰ SESSION TIMEOUT 6min
  // ============================================================
  const resetActivityTimer = useCallback(() => {
    setTimeoutWarning(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    warningRef.current = setTimeout(() => {
      logger.timeout("Sessão expira em 1 minuto", { timeoutMs: SESSION_TIMEOUT_MS });
      setTimeoutWarning(true);
    }, SESSION_TIMEOUT_MS - 60_000);

    timeoutRef.current = setTimeout(() => {
      logger.timeout("Sessão expirada por inatividade — logout automático", {
        sessionDuration: Date.now() - mountTime.current,
      });
      doLogout();
    }, SESSION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!user) return;
    const events  = ["click", "keypress", "mousemove", "touchstart", "scroll"];
    const handler = () => resetActivityTimer();
    events.forEach(e => document.addEventListener(e, handler, { passive: true }));
    resetActivityTimer();
    logger.timeout("Session timeout ativo", { minutos: SESSION_TIMEOUT_MS / 60000 });
    return () => {
      events.forEach(e => document.removeEventListener(e, handler));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [user, resetActivityTimer]);

  // ============================================================
  // 🔐 VALIDAÇÃO DE SESSÃO
  // ============================================================
  useEffect(() => {
    logger.sep();
    logger.mount("Dashboard v3.1 Luxury Enterprise");
    logger.info("INIT", "Dashboard v3.1 inicializando", {
      apiUrl:    API_URL,
      timestamp: new Date().toISOString(),
      version:   "3.1.0",
      novidade:  "CompleteProfileModal para usuários Google sem CPF",
    });

    async function validateAuth() {
      const t0 = performance.now();
      try {
        const token = localStorage.getItem("token");
        logger.auth("Token no localStorage?", { hasToken: !!token });

        if (!token) {
          logger.warn("AUTH", "Sem token — redirecionando");
          router.replace("/login");
          return;
        }

        try {
          const payload   = JSON.parse(atob(token.split(".")[1]));
          const isExpired = Date.now() > payload.exp * 1000;
          logger.auth("Token decodificado", {
            userId:         payload.id,
            email:          payload.email,
            provider:       payload.auth_provider || "local",
            expiresAt:      new Date(payload.exp * 1000).toISOString(),
            cpf_cadastrado: payload.cpf_cadastrado,
            isExpired,
            tokenSize:      token.length,
          });
          if (isExpired) {
            logger.warn("AUTH", "Token expirado localmente — limpando");
            localStorage.removeItem("token");
            document.cookie = "token=; Max-Age=0; path=/;";
            router.replace("/login");
            return;
          }
        } catch (decodeErr) {
          logger.warn("AUTH", "Token não decodificável — validando remotamente", { error: String(decodeErr) });
        }

        logger.info("AUTH:HTTP", "Chamando /api/auth/me...", { url: `${API_URL}/api/auth/me` });
        const tFetch   = performance.now();
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "X-Request-ID":  `dashboard_v3_${Date.now()}`,
          },
        });
        logger.perf("AUTH:HTTP", "/api/auth/me", performance.now() - tFetch);
        logger.info("AUTH:HTTP", "Resposta", { status: response.status, ok: response.ok });

        let data: any = {};
        try {
          data = await response.json();
          logger.info("AUTH:PARSE", "Body parseado", {
            success:    data.success,
            hasUser:    !!data.data,
            userFields: data.data ? Object.keys(data.data) : [],
          });
        } catch (parseErr) {
          logger.error("AUTH:PARSE", "JSON inválido", { parseErr: String(parseErr) });
          throw new Error("Resposta inválida do servidor");
        }

        if (!response.ok) {
          logger.sec("Token rejeitado", { status: response.status, code: data?.code });
          throw new Error(data.error || "Token inválido");
        }

        const userData: User = data.data;
        logger.success("AUTH", "Sessão validada ✅", { userId: userData.id, email: userData.email });
        logger.perf("AUTH", "Validação completa", performance.now() - t0);
        setUser(userData);

        // ✅ v3.1: Detecta usuário Google sem CPF cadastrado
        // Condições para abrir o modal:
        //   1. auth_provider é "google" (veio pelo OAuth)
        //   2. cpf_cadastrado é false ou undefined (nunca preencheu)
        // O modal é obrigatório — não tem como fechar sem preencher
        if (userData.auth_provider === "google" && !userData.cpf_cadastrado) {
          logger.modal("🚨 Usuário Google sem CPF detectado — abrindo modal obrigatório", {
            userId:          userData.id,
            email:           userData.email,
            auth_provider:   userData.auth_provider,
            cpf_cadastrado:  userData.cpf_cadastrado,
            acao:            "Modal obrigatório será exibido — usuário não pode fechar sem preencher",
            endpoint_alvo:   "POST /api/auth/complete-profile",
          });
          setShowCpfModal(true);
        } else {
          logger.auth("✅ CPF verificado — dashboard liberado normalmente", {
            userId:         userData.id,
            provider:       userData.auth_provider,
            cpf_cadastrado: userData.cpf_cadastrado,
          });
        }

      } catch (error: any) {
        logger.error("AUTH", `Validação falhou — ${error.message}`, { type: error.name });
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          logger.error("AUTH:NETWORK", "Backend inacessível", { url: `${API_URL}/api/auth/me` });
        }
        logger.warn("AUTH", "Limpando sessão inválida");
        localStorage.removeItem("token");
        document.cookie = "token=; Max-Age=0; path=/;";
        router.replace("/login");
      } finally {
        logger.info("AUTH", "setLoadingAuth(false)");
        setLoadingAuth(false);
      }
    }

    validateAuth();

    return () => {
      logger.unmount("Dashboard v3.1 Luxury Enterprise");
      logger.perf("DASHBOARD:LIFECYCLE", "Tempo total montado", Date.now() - mountTime.current);
      logger.sep();
    };
  }, []);

  // ============================================================
  // 📊 HISTÓRICO DE CERTIFICADOS
  // ============================================================
  async function fetchCertificates() {
    const t0 = performance.now();
    logger.table("HIST", "Carregando histórico...");
    setLoadingCerts(true);
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        logger.sec("fetchCertificates sem token", {});
        throw new Error("Usuário não autenticado");
      }

      logger.table("HIST:HTTP", "GET /api/certificates iniciando", { url: `${API_URL}/api/certificates` });

      const response = await fetch(`${API_URL}/api/certificates`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Request-ID":  `hist_${Date.now()}`,
        },
      });

      logger.perf("HIST", "GET /api/certificates", performance.now() - t0);
      logger.table("HIST:HTTP", "Resposta recebida", { status: response.status, ok: response.ok });

      // ⚠️  Parse ANTES do check — evita erro se response não for JSON
      let data: any = {};
      try {
        data = await response.json();
        logger.table("HIST:PARSE", "Body parseado", {
          success:    data.success,
          keys:       Object.keys(data),
          dataType:   Array.isArray(data.data) ? "array" : typeof data.data,
          dataLength: Array.isArray(data.data) ? data.data.length : "N/A",
        });
      } catch (parseErr) {
        logger.error("HIST:PARSE", "JSON inválido na resposta", { parseErr: String(parseErr) });
        throw new Error("Resposta inválida do servidor ao carregar histórico");
      }

      if (!response.ok) {
        logger.error("HIST:HTTP", "Resposta não-ok", { status: response.status, error: data?.error, code: data?.code });
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      // ⚠️  Suporta múltiplos formatos de resposta da API:
      //   { data: { certificates: [...] } }
      //   { data: [...] }
      //   { certificates: [...] }
      //   [...]
      const certs: Certificate[] =
        Array.isArray(data.data?.certificates) ? data.data.certificates :
        Array.isArray(data.data)               ? data.data               :
        Array.isArray(data.certificates)       ? data.certificates       :
        Array.isArray(data)                    ? data                    : [];

      logger.table("HIST", "Certificados carregados ✅", {
        count:  certs.length,
        format: Array.isArray(data.data?.certificates) ? "data.certificates" :
                Array.isArray(data.data)               ? "data.data[]"       :
                Array.isArray(data)                    ? "root[]"            : "vazio",
      });

      const esteMes = certs.filter((c: Certificate) => {
        const d = new Date(c.criado_em), n = new Date();
        return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
      }).length;

      logger.metrics("Métricas atualizadas", { total: certs.length, esteMes });

      setCertificates(certs);
      setCountStart(false);
      setTimeout(() => setCountStart(true), 50);

    } catch (error: any) {
      logger.error("HIST", "Falha ao carregar histórico", {
        message: error.message,
        type:    error.name,
        hint:    "Verifique se GET /api/certificates retorna { success, data: [] }",
      });
    } finally {
      setLoadingCerts(false);
    }
  }

  useEffect(() => {
    if (user && activeTab === "historico") {
      logger.sidebar("Tab histórico ativada — buscando certificados");
      fetchCertificates();
    }
  }, [user, activeTab]);

  // ============================================================
  // 🚪 LOGOUT
  // ============================================================
  function doLogout() {
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
      value: name === "cpf" ? `[${value.length} chars]` : value,
    });
    setSubmitError("");
    setForm(prev => ({ ...prev, [name]: value }));
  }

  // ============================================================
  // 🎓 EMISSÃO DE CERTIFICADO
  // ============================================================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);
    setPdfUrl("");

    const t0 = performance.now();
    logger.sep();
    logger.cert("Iniciando emissão...");
    logger.event("CERT", "Formulário submetido", {
      nome_participante: form.nome_participante,
      cpf:               `[${form.cpf.length} chars]`,
      nome_curso:        form.nome_curso,
      carga_horaria:     form.carga_horaria,
      data_emissao:      form.data_emissao,
    });

    setLoadingSubmit(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) { logger.sec("Emissão sem token", { userId: user?.id }); throw new Error("Usuário não autenticado"); }

      const payload = { ...form, carga_horaria: Number(form.carga_horaria) };
      logger.cert("Payload preparado", { ...payload, cpf: `[${payload.cpf.length} chars]` });
      logger.info("CERT:HTTP", "POST /api/certificates...", { url: `${API_URL}/api/certificates` });

      const tFetch   = performance.now();
      const response = await fetch(`${API_URL}/api/certificates`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Request-ID":  `cert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        },
        body: JSON.stringify(payload),
      });
      logger.perf("CERT:HTTP", "Resposta recebida", performance.now() - tFetch);
      logger.info("CERT:HTTP", "Status", { status: response.status, ok: response.ok });

      let data: any = {};
      try {
        data = await response.json();
        logger.info("CERT:PARSE", "Body parseado", {
          success:   data.success,
          hasPdfUrl: !!(data.data?.pdf_url || data.pdf_url),
          keys:      Object.keys(data),
        });
      } catch (parseErr) {
        logger.error("CERT:PARSE", "JSON inválido", { parseErr: String(parseErr) });
        throw new Error("Resposta inválida do servidor");
      }

      if (!response.ok) {
        logger.error("CERT", "Erro da API", { status: response.status, code: data?.code, error: data?.error });
        if (response.status === 401) {
          logger.sec("Token expirado na emissão — logout", { status: response.status });
          localStorage.removeItem("token");
          document.cookie = "token=; Max-Age=0; path=/;";
          router.replace("/login");
          return;
        }
        throw new Error(data.error || "Erro ao emitir certificado");
      }

      const url = data.data?.pdf_url || data.pdf_url || data.data?.url;
      logger.cert("Certificado emitido com sucesso!", { pdfUrl: url, id: data.data?.id, codigo: data.data?.codigo_verificacao });
      if (!url) { logger.warn("CERT", "PDF não retornado", { data }); throw new Error("PDF não foi gerado. Tente novamente."); }

      logger.perf("CERT", "Emissão completa", performance.now() - t0);
      logger.success("CERT", "══ CERTIFICADO EMITIDO ══", { url, totalMs: (performance.now() - t0).toFixed(2) + "ms" });

      setPdfUrl(url);
      setSubmitSuccess(true);
      setForm({ nome_participante: "", cpf: "", nome_curso: "", carga_horaria: "", data_emissao: new Date().toISOString().split("T")[0] });

    } catch (error: any) {
      logger.error("CERT", `Emissão falhou — ${error.message}`, { type: error.name });
      setSubmitError(error.message || "Erro inesperado. Tente novamente.");
    } finally {
      logger.info("CERT", "Fluxo de emissão finalizado — setLoadingSubmit(false)");
      setLoadingSubmit(false);
      logger.sep();
    }
  }

  function handleTabChange(tab: ActiveTab) {
    logger.sidebar(`Tab alterada`, { from: activeTab, to: tab });
    setActiveTab(tab);
    setSubmitSuccess(false);
    setPdfUrl("");
    setSubmitError("");
  }

  // ── LOADING ─────────────────────────────────────────────────
  if (loadingAuth) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050810" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative", width: 48, height: 48 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(16,185,129,0.15)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid transparent", borderTopColor: "#10b981", animation: "spin 0.8s linear infinite" }} />
            <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: "1px solid transparent", borderTopColor: "rgba(16,185,129,0.4)", animation: "spin 1.2s linear infinite reverse" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, letterSpacing: "0.3em", fontFamily: "monospace" }}>NEXASPARK</span>
            <span style={{ color: "rgba(16,185,129,0.4)", fontSize: 9, letterSpacing: "0.2em", fontFamily: "monospace" }}>AUTENTICANDO...</span>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  const initials = (user.nome || user.email).substring(0, 2).toUpperCase();
  const planUsed = metricsThisMonth;
  const planPct  = Math.min((planUsed / PLAN_LIMIT) * 100, 100);

  logger.info("RENDER", "Renderizando Dashboard v3.1 Luxury", {
    userId:        user.id,
    email:         user.email,
    activeTab,
    certsLoaded:   certificates.length,
    mounted,
    showCpfModal,
    cpf_cadastrado: user.cpf_cadastrado,
  });

  // ── Estilos de animação de entrada staggered ─────────────────
  const fadeIn = (delay = 0): React.CSSProperties => ({
    opacity:    mounted ? 1 : 0,
    transform:  mounted ? "translateY(0)" : "translateY(12px)",
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
  });

  return (
    <>
      {/* CSS global */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } 50% { box-shadow: 0 0 20px 2px rgba(16,185,129,0.12); } }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        @keyframes progress-fill { from { width: 0%; } to { width: ${planPct}%; } }
        @keyframes fade-slide-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.2); border-radius: 2px; }
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.3) sepia(1) hue-rotate(100deg); cursor: pointer; }
      `}</style>

      {/* CANVAS */}
      <ParticleCanvas />

      {/*
        ✅ v3.1 — CompleteProfileModal
        Renderizado ANTES do conteúdo principal para garantir z-index correto.
        Condições de exibição:
          1. showCpfModal === true (detectado em validateAuth)
          2. user !== null (sessão validada)
        O modal tem z-index: 200 e backdrop blur total.
        onComplete: fecha o modal e loga a conclusão.
      */}
      {showCpfModal && user && (
        <CompleteProfileModal
          user={user}
          onComplete={() => {
            logger.modal("✅ Modal de CPF concluído — dashboard liberado", {
              userId:         user.id,
              email:          user.email,
              cpf_cadastrado: true,
              acao:           "setShowCpfModal(false) — usuário pode usar o dashboard",
            });
            setShowCpfModal(false);
          }}
        />
      )}

      <div style={{ minHeight: "100vh", display: "flex", background: "#050810", color: "white", fontFamily: "'Syne', system-ui, sans-serif", position: "relative", zIndex: 1 }}>

        {/* TIMEOUT WARNING */}
        {timeoutWarning && (
          <div style={{
            position:       "fixed", top: 20, right: 20, zIndex: 100,
            background:     "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)",
            borderRadius:   14, padding: "12px 18px",
            display:        "flex", alignItems: "center", gap: 12,
            backdropFilter: "blur(20px)",
            animation:      "fade-slide-up 0.3s ease",
            boxShadow:      "0 0 30px rgba(251,191,36,0.08)",
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", animation: "blink 1s ease infinite" }} />
            <div>
              <p style={{ color: "#fbbf24", fontSize: 12, fontWeight: 600, margin: 0 }}>Sessão expirando</p>
              <p style={{ color: "rgba(251,191,36,0.5)", fontSize: 11, margin: "2px 0 0", fontFamily: "monospace" }}>Mova o mouse para continuar</p>
            </div>
          </div>
        )}

        {/* SIDEBAR */}
        <aside style={{
          width:          sidebarCollapsed ? 60 : 230,
          minHeight:      "100vh",
          background:     "rgba(10,15,24,0.9)",
          borderRight:    "1px solid rgba(16,185,129,0.08)",
          display:        "flex", flexDirection: "column", flexShrink: 0,
          transition:     "width 0.3s cubic-bezier(0.4,0,0.2,1)",
          backdropFilter: "blur(20px)",
          position:       "relative", zIndex: 10,
        }}>

          {/* Logo */}
          <div style={{ padding: sidebarCollapsed ? "20px 14px" : "20px 18px", borderBottom: "1px solid rgba(16,185,129,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width:          32, height: 32, borderRadius: 10,
              background:     "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
              border:         "1px solid rgba(16,185,129,0.3)",
              display:        "flex", alignItems: "center", justifyContent: "center",
              flexShrink:     0, fontSize: 15,
              animation:      "float 3s ease-in-out infinite",
              boxShadow:      "0 0 20px rgba(16,185,129,0.1)",
            }}>⚡</div>
            {!sidebarCollapsed && (
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.02em" }}>NexaSpark</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", animation: "blink 2s ease infinite" }} />
                  <span style={{ fontSize: 9, color: "rgba(16,185,129,0.6)", letterSpacing: "0.1em", fontFamily: "monospace" }}>ONLINE</span>
                </div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "16px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
            {([
              { tab: "emitir",    icon: "✦", label: "Emitir",    desc: "Novo certificado"    },
              { tab: "historico", icon: "◈", label: "Histórico", desc: "Emissões anteriores" },
              { tab: "perfil",    icon: "◉", label: "Perfil",    desc: "Dados da conta"      },
            ] as { tab: ActiveTab; icon: string; label: string; desc: string }[]).map((item) => {
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  onClick={() => handleTabChange(item.tab)}
                  style={{
                    width:          "100%",
                    display:        "flex", alignItems: "center", gap: 12,
                    padding:        sidebarCollapsed ? "11px 0" : "11px 14px",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    borderRadius:   10,
                    border:         isActive ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent",
                    background:     isActive ? "rgba(16,185,129,0.08)" : "transparent",
                    color:          isActive ? "#34d399" : "rgba(255,255,255,0.3)",
                    fontSize:       13, fontWeight: isActive ? 600 : 400,
                    cursor:         "pointer", transition: "all 0.2s",
                    position:       "relative",
                    boxShadow:      isActive ? "inset 0 0 20px rgba(16,185,129,0.04)" : "none",
                  }}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}}
                >
                  {isActive && (
                    <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2, height: 16, background: "#10b981", borderRadius: "0 2px 2px 0" }} />
                  )}
                  <span style={{ fontSize: 12, flexShrink: 0, width: 14, textAlign: "center" }}>{item.icon}</span>
                  {!sidebarCollapsed && (
                    <div style={{ textAlign: "left" }}>
                      <div>{item.label}</div>
                      {isActive && <div style={{ fontSize: 9, color: "rgba(16,185,129,0.5)", fontFamily: "monospace", marginTop: 1 }}>{item.desc}</div>}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Plano progress */}
          {!sidebarCollapsed && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(16,185,129,0.06)", borderBottom: "1px solid rgba(16,185,129,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace" }}>Plano Free</span>
                <span style={{ fontSize: 9, color: planPct > 80 ? "#f87171" : "rgba(16,185,129,0.6)", fontFamily: "monospace" }}>{planUsed}/{PLAN_LIMIT}</span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height:     "100%", borderRadius: 2,
                  background: planPct > 80 ? "#f87171" : "linear-gradient(90deg, #10b981, #34d399)",
                  width:      `${planPct}%`,
                  transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
                  boxShadow:  planPct > 0 ? "0 0 8px rgba(16,185,129,0.4)" : "none",
                }} />
              </div>
            </div>
          )}

          {/* User footer */}
          <div style={{ padding: "14px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px", justifyContent: sidebarCollapsed ? "center" : "flex-start" }}>
              <div style={{
                width:      32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
                border:     "1px solid rgba(16,185,129,0.25)",
                display:    "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                animation:  "pulse-glow 4s ease-in-out infinite",
              }}>
                <span style={{ color: "#6ee7b7", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>{initials}</span>
              </div>
              {!sidebarCollapsed && (
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.nome || "Usuário"}</p>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{user.email}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => { logger.sidebar("Sidebar toggled", { collapsed: !sidebarCollapsed }); setSidebarCollapsed(p => !p); }}
              style={{ width: "100%", marginTop: 12, padding: "5px 0", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 16, transition: "all 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.12)")}
            >
              {sidebarCollapsed ? "›" : "‹"}
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Header */}
          <header style={{ ...fadeIn(0), display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 36px", borderBottom: "1px solid rgba(16,185,129,0.06)", backdropFilter: "blur(10px)" }}>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: 0, letterSpacing: "-0.01em" }}>
                {activeTab === "emitir"    && "Emitir Certificado"}
                {activeTab === "historico" && "Histórico de Emissões"}
                {activeTab === "perfil"    && "Meu Perfil"}
              </h1>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: "3px 0 0", fontFamily: "monospace" }}>
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Relógio em tempo real */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.1)" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", animation: "blink 1s ease infinite" }} />
                <span style={{ fontSize: 11, color: "rgba(16,185,129,0.7)", fontFamily: "monospace", letterSpacing: "0.05em" }}>{clock}</span>
              </div>

              {user.auth_provider === "google" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20, background: "rgba(66,133,244,0.06)", border: "1px solid rgba(66,133,244,0.15)" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span style={{ color: "rgba(147,197,253,0.6)", fontSize: 10, fontWeight: 500 }}>Google</span>
                </div>
              )}
              <button
                onClick={doLogout}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.25)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 13 }}>⎋</span><span>Sair</span>
              </button>
            </div>
          </header>

          <div style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>

            {/* CARDS MÉTRICAS — sempre visíveis com animação */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 36 }}>
              {[
                { label: "Este mês",    value: countMonth, unit: "emissões",       color: "#10b981", glow: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.15)", delay: 100 },
                { label: "Total geral", value: countTotal, unit: "certificados",   color: "#60a5fa", glow: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.15)",  delay: 200 },
                { label: "Plano",       value: "Free",     unit: "5 emissões/mês", color: "#fbbf24", glow: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.15)",  delay: 300 },
              ].map((m, i) => (
                <div key={i} style={{
                  ...fadeIn(m.delay),
                  borderRadius: 16,
                  border:       `1px solid ${m.border}`,
                  background:   `radial-gradient(ellipse at top left, ${m.glow} 0%, rgba(5,8,16,0) 70%)`,
                  padding:      "22px 24px",
                  position:     "relative", overflow: "hidden",
                  cursor:       "default",
                  transition:   "transform 0.2s, box-shadow 0.2s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${m.glow}`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                >
                  <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: m.glow, filter: "blur(20px)", pointerEvents: "none" }} />
                  <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", margin: "0 0 10px", fontFamily: "monospace" }}>{m.label}</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: m.color, margin: 0, fontFamily: "monospace", lineHeight: 1 }}>{m.value}</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", margin: "8px 0 0" }}>{m.unit}</p>
                </div>
              ))}
            </div>

            {/* TAB: EMITIR */}
            {activeTab === "emitir" && (
              <div style={{ ...fadeIn(150), display: "flex", gap: 48, alignItems: "flex-start" }}>

                {/* FORMULÁRIO — lado esquerdo */}
                <div style={{ maxWidth: 480, flex: "0 0 480px" }}>
                  <div style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", margin: "0 0 4px", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "monospace" }}>Novo certificado</h2>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0 }}>Preencha os dados do participante e emita</p>
                  </div>

                  <form onSubmit={handleSubmit}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { name: "nome_participante", placeholder: "Nome completo do participante", type: "text"   },
                        { name: "cpf",               placeholder: "CPF (XXX.XXX.XXX-XX)",          type: "text"   },
                        { name: "nome_curso",        placeholder: "Nome do curso ou treinamento",  type: "text"   },
                        { name: "carga_horaria",     placeholder: "Carga horária em horas",        type: "number" },
                      ].map(f => (
                        <div key={f.name} style={{ position: "relative" }}>
                          <input
                            name={f.name}
                            value={form[f.name as keyof CertForm]}
                            placeholder={f.placeholder}
                            type={f.type}
                            min={f.type === "number" ? "1" : undefined}
                            onChange={handleChange}
                            required
                            style={{
                              width:       "100%", background: "rgba(10,15,24,0.8)",
                              border:      "1px solid rgba(255,255,255,0.07)",
                              borderRadius: 10, padding: "12px 16px",
                              fontSize:    13, color: "rgba(255,255,255,0.8)",
                              outline:     "none", boxSizing: "border-box",
                              fontFamily:  "'Syne', system-ui, sans-serif",
                              transition:  "border-color 0.2s, box-shadow 0.2s",
                            }}
                            onFocus={e => {
                              e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)";
                              e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(16,185,129,0.06), inset 0 0 20px rgba(16,185,129,0.02)";
                              logger.event("FORM:FOCUS", f.name);
                            }}
                            onBlur={e => {
                              e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                              e.currentTarget.style.boxShadow   = "none";
                            }}
                          />
                        </div>
                      ))}

                      <input
                        name="data_emissao"
                        value={form.data_emissao}
                        type="date"
                        onChange={handleChange}
                        required
                        style={{
                          width:       "100%", background: "rgba(10,15,24,0.8)",
                          border:      "1px solid rgba(255,255,255,0.07)",
                          borderRadius: 10, padding: "12px 16px",
                          fontSize:    13, color: "rgba(255,255,255,0.5)",
                          outline:     "none", boxSizing: "border-box",
                          colorScheme: "dark",
                          fontFamily:  "'Syne', system-ui, sans-serif",
                          transition:  "border-color 0.2s, box-shadow 0.2s",
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.06)"; }}
                        onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow = "none"; }}
                      />

                      {submitError && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)", animation: "fade-slide-up 0.3s ease" }}>
                          <span style={{ color: "#f87171", fontSize: 12, flexShrink: 0, marginTop: 1 }}>✕</span>
                          <p style={{ color: "rgba(248,113,113,0.8)", fontSize: 12, margin: 0, lineHeight: 1.6 }}>{submitError}</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loadingSubmit}
                        onClick={() => logger.event("CERT", "Botão Emitir clicado")}
                        style={{
                          width:       "100%",
                          background:  loadingSubmit
                            ? "rgba(16,185,129,0.04)"
                            : "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.08))",
                          border:      "1px solid rgba(16,185,129,0.3)",
                          borderRadius: 10, padding: "13px 0",
                          color:       "#34d399", fontSize: 13, fontWeight: 700,
                          cursor:      loadingSubmit ? "not-allowed" : "pointer",
                          display:     "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          transition:  "all 0.2s", opacity: loadingSubmit ? 0.5 : 1,
                          fontFamily:  "'Syne', system-ui, sans-serif",
                          letterSpacing: "0.03em",
                          boxShadow:   loadingSubmit ? "none" : "0 0 20px rgba(16,185,129,0.08)",
                        }}
                        onMouseEnter={e => { if (!loadingSubmit) { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 30px rgba(16,185,129,0.15)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.5)"; }}}
                        onMouseLeave={e => { if (!loadingSubmit) { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(16,185,129,0.08)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.3)"; }}}
                      >
                        {loadingSubmit ? (
                          <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid rgba(52,211,153,0.3)", borderTopColor: "#34d399", animation: "spin 0.7s linear infinite" }} /><span>Gerando PDF...</span></>
                        ) : (
                          <><span style={{ fontSize: 12 }}>✦</span><span>Emitir Certificado</span></>
                        )}
                      </button>
                    </div>
                  </form>

                  {submitSuccess && pdfUrl && (
                    <div style={{ marginTop: 16, padding: "18px 20px", borderRadius: 14, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.2)", animation: "fade-slide-up 0.4s ease", boxShadow: "0 0 40px rgba(16,185,129,0.06)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "#34d399", fontSize: 11 }}>✓</span>
                        </div>
                        <p style={{ color: "#34d399", fontSize: 13, fontWeight: 600, margin: 0 }}>Certificado gerado com sucesso</p>
                      </div>
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => logger.event("CERT", "PDF aberto pelo usuário", { url: pdfUrl })}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#6ee7b7", fontSize: 12, textDecoration: "none", fontWeight: 600, transition: "all 0.2s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.15)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 20px rgba(16,185,129,0.1)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.1)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none"; }}
                      >
                        <span>⬡</span><span>Abrir PDF</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* HERO IMAGE — lado direito */}
                {/* ⚠️  Salve a imagem em web/public/images/hero-dashboard.png
                    Ela aparece automaticamente aqui com o efeito cinematográfico */}
                <div style={{
                  flex:         1,
                  minHeight:    520,
                  borderRadius: 20,
                  overflow:     "hidden",
                  position:     "relative",
                  border:       "1px solid rgba(16,185,129,0.08)",
                  ...fadeIn(300),
                }}>
                  {/* Imagem de fundo */}
                  <div style={{
                    position:           "absolute", inset: 0,
                    backgroundImage:    "url('/images/hero-dashboard.png')",
                    backgroundSize:     "cover",
                    backgroundPosition: "center right",
                    opacity:            0.22,
                    filter:             "blur(1px)",
                    maskImage:          "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 20%, rgba(0,0,0,1) 100%)",
                    WebkitMaskImage:    "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 20%, rgba(0,0,0,1) 100%)",
                    transition:         "opacity 1s ease",
                  }} />

                  {/* Gradiente de integração dark-left */}
                  <div style={{
                    position:   "absolute", inset: 0,
                    background: "linear-gradient(to right, rgba(5,8,16,0.96) 0%, rgba(5,8,16,0.65) 35%, rgba(5,8,16,0.1) 100%)",
                  }} />

                  {/* Glow verde ambiental */}
                  <div style={{
                    position:     "absolute", bottom: -60, right: -60,
                    width:        280, height: 280,
                    borderRadius: "50%",
                    background:   "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
                    filter:       "blur(40px)",
                    animation:    "pulse-glow 5s ease-in-out infinite",
                  }} />

                  {/* Conteúdo sobre a imagem */}
                  <div style={{
                    position:       "relative", zIndex: 2,
                    display:        "flex", flexDirection: "column",
                    justifyContent: "flex-end",
                    height:         "100%", padding: "36px 36px 44px",
                  }}>
                    {/* Badge premium */}
                    <div style={{
                      display:      "inline-flex", alignItems: "center", gap: 6,
                      padding:      "5px 12px", borderRadius: 20,
                      background:   "rgba(16,185,129,0.08)",
                      border:       "1px solid rgba(16,185,129,0.2)",
                      marginBottom: 16, width: "fit-content",
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", animation: "blink 2s ease infinite" }} />
                      <span style={{ fontSize: 10, color: "rgba(16,185,129,0.7)", letterSpacing: "0.12em", fontFamily: "monospace" }}>CERTIFICAÇÃO DIGITAL</span>
                    </div>

                    <h3 style={{
                      fontSize:      26, fontWeight: 700,
                      color:         "rgba(255,255,255,0.9)",
                      margin:        "0 0 12px",
                      lineHeight:    1.25,
                      letterSpacing: "-0.02em",
                      maxWidth:      360,
                    }}>
                      Transforme conquistas em<br />
                      <span style={{ color: "#34d399" }}>certificações profissionais.</span>
                    </h3>

                    <p style={{
                      fontSize:  13, color: "rgba(255,255,255,0.35)",
                      margin:    "0 0 28px", lineHeight: 1.7, maxWidth: 340,
                    }}>
                      Emitidos em segundos. Verificáveis instantaneamente.<br />
                      Assinados com SHA-256.
                    </p>

                    {/* Stats inline */}
                    <div style={{ display: "flex", gap: 24 }}>
                      {[
                        { value: "< 3s",   label: "tempo de emissão"  },
                        { value: "SHA-256", label: "assinatura digital" },
                        { value: "QR Code", label: "verificação pública" },
                      ].map((s, i) => (
                        <div key={i}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: "0 0 3px", fontFamily: "monospace" }}>{s.value}</p>
                          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", margin: 0, letterSpacing: "0.05em" }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: HISTÓRICO — timeline visual */}
            {activeTab === "historico" && (
              <div style={{ ...fadeIn(100) }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", margin: "0 0 2px", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "monospace" }}>Timeline</h2>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0 }}>{certificates.length} certificados emitidos</p>
                  </div>
                  <button
                    onClick={() => { logger.table("HIST", "Refresh manual acionado"); fetchCertificates(); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", transition: "all 0.2s", fontFamily: "monospace" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.2)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
                  >
                    <span style={{ animation: loadingCerts ? "spin 0.8s linear infinite" : "none", display: "inline-block" }}>↻</span>
                    <span>Atualizar</span>
                  </button>
                </div>

                {loadingCerts ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ height: 80, borderRadius: 12, background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.5s infinite", border: "1px solid rgba(255,255,255,0.04)" }} />
                    ))}
                  </div>
                ) : certificates.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", color: "rgba(255,255,255,0.15)" }}>
                    <div style={{ fontSize: 40, marginBottom: 16, animation: "float 3s ease-in-out infinite" }}>◈</div>
                    <p style={{ fontSize: 14, margin: "0 0 8px", color: "rgba(255,255,255,0.2)" }}>Nenhum certificado ainda</p>
                    <p style={{ fontSize: 12, margin: "0 0 20px", color: "rgba(255,255,255,0.1)" }}>Emita o primeiro para ver aqui</p>
                    <button onClick={() => handleTabChange("emitir")} style={{ fontSize: 12, color: "rgba(16,185,129,0.5)", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: "8px 16px", cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#34d399")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(16,185,129,0.5)")}
                    >
                      Emitir primeiro certificado →
                    </button>
                  </div>
                ) : (
                  <div style={{ position: "relative", paddingLeft: 28 }}>
                    {/* Linha vertical da timeline */}
                    <div style={{ position: "absolute", left: 10, top: 10, bottom: 10, width: 1, background: "linear-gradient(to bottom, rgba(16,185,129,0.3), rgba(16,185,129,0.05))" }} />

                    {certificates.map((cert, i) => (
                      <div
                        key={cert.id}
                        style={{
                          position:   "relative", marginBottom: 16,
                          opacity:    mounted ? 1 : 0,
                          transform:  mounted ? "translateX(0)" : "translateX(-8px)",
                          transition: `all 0.4s ease ${i * 60}ms`,
                        }}
                        onMouseEnter={() => logger.table("HIST:ROW", `Hover #${cert.id}`, { nome: cert.nome_participante })}
                      >
                        {/* Dot na timeline */}
                        <div style={{ position: "absolute", left: -22, top: 18, width: 8, height: 8, borderRadius: "50%", background: i === 0 ? "#10b981" : "rgba(16,185,129,0.3)", border: i === 0 ? "2px solid rgba(16,185,129,0.4)" : "1px solid rgba(16,185,129,0.2)", boxShadow: i === 0 ? "0 0 10px rgba(16,185,129,0.4)" : "none" }} />

                        <div style={{
                          borderRadius:   12, border: "1px solid rgba(255,255,255,0.05)",
                          background:     "rgba(10,15,24,0.6)", padding: "14px 18px",
                          backdropFilter: "blur(8px)", transition: "all 0.2s",
                          cursor:         "default",
                        }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(16,185,129,0.15)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(16,185,129,0.03)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(10,15,24,0.6)"; }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cert.nome_participante}</p>
                              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cert.nome_curso}</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
                                  {new Date(cert.data_emissao).toLocaleDateString("pt-BR")}
                                </span>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>{cert.carga_horaria}h</span>
                                <span style={{ fontSize: 9, color: "rgba(16,185,129,0.4)", fontFamily: "monospace", background: "rgba(16,185,129,0.05)", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(16,185,129,0.1)" }}>
                                  #{cert.codigo_verificacao?.substring(0, 8)}
                                </span>
                              </div>
                            </div>
                            {cert.pdf_url && (
                              <a
                                href={cert.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => logger.table("HIST:PDF", "PDF aberto", { certId: cert.id })}
                                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", color: "rgba(52,211,153,0.6)", fontSize: 11, textDecoration: "none", fontWeight: 500, flexShrink: 0, transition: "all 0.2s" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#34d399"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(16,185,129,0.35)"; (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.1)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(52,211,153,0.6)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(16,185,129,0.15)"; (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.06)"; }}
                              >
                                <span>⬡</span><span>PDF</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: PERFIL */}
            {activeTab === "perfil" && (
              <div style={{ ...fadeIn(100), maxWidth: 420 }}>
                <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,15,24,0.8)", padding: 28, backdropFilter: "blur(12px)" }}>
                  {/* Avatar grande */}
                  <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28 }}>
                    <div style={{
                      width:        56, height: 56, borderRadius: "50%",
                      background:   "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.04))",
                      border:       "1.5px solid rgba(16,185,129,0.3)",
                      display:      "flex", alignItems: "center", justifyContent: "center",
                      boxShadow:    "0 0 30px rgba(16,185,129,0.15)",
                      animation:    "pulse-glow 4s ease-in-out infinite",
                    }}>
                      <span style={{ color: "#6ee7b7", fontSize: 18, fontWeight: 700, fontFamily: "monospace" }}>{initials}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0 }}>{user.nome || "Usuário"}</p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>{user.email}</p>
                    </div>
                  </div>

                  {[
                    { label: "ID da conta",        value: `#${user.id}`,                                                               mono: true  },
                    { label: "Autenticação",        value: user.auth_provider === "google" ? "Google OAuth 2.0" : "Email + Senha",      mono: false },
                    { label: "Identidade",          value: user.cpf_cadastrado ? "✅ CPF verificado" : "⚠️  CPF pendente",              mono: false },
                    { label: "Plano atual",         value: "Free — 5 emissões/mês",                                                    mono: false },
                    { label: "Emissões no mês",     value: `${metricsThisMonth} de ${PLAN_LIMIT}`,                                     mono: true  },
                    { label: "Membro desde",        value: user.criado_em ? new Date(user.criado_em).toLocaleDateString("pt-BR") : "—", mono: true  },
                  ].map((item, i, arr) => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{item.label}</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 500, fontFamily: item.mono ? "monospace" : "inherit" }}>{item.value}</span>
                    </div>
                  ))}

                  {/* Barra de progresso do plano */}
                  <div style={{ marginTop: 20, padding: "16px", borderRadius: 10, background: "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.1)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", letterSpacing: "0.08em" }}>USO DO PLANO</span>
                      <span style={{ fontSize: 10, color: planPct > 80 ? "#f87171" : "rgba(16,185,129,0.6)", fontFamily: "monospace" }}>{Math.round(planPct)}%</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height:     "100%", borderRadius: 2,
                        background: planPct > 80 ? "linear-gradient(90deg, #f87171, #fbbf24)" : "linear-gradient(90deg, #10b981, #34d399)",
                        width:      `${planPct}%`,
                        transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)",
                        boxShadow:  planPct > 0 ? "0 0 10px rgba(16,185,129,0.5)" : "none",
                      }} />
                    </div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", margin: "8px 0 0", fontFamily: "monospace" }}>
                      {PLAN_LIMIT - metricsThisMonth} emissões restantes este mês
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}