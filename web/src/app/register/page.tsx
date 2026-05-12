"use client";

// ============================================================
// 📝 NexaSpark — /register/page.tsx v2.1
//
// ADIÇÕES v2.1 sobre v2.0:
//   ✅ Campo CPF obrigatório com formatação automática
//   ✅ Validação matemática dos dígitos verificadores (client-side)
//   ✅ FingerprintJS silencioso (device fingerprint anti-abuse)
//   ✅ Feedback visual do plano free (3 certificados)
//   ✅ Todos os demais recursos v2.0 preservados intactos
// ============================================================

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";

const LOG_PREFIX = "[NexaSpark:Register:v2.1]";
const logger = {
  info:    (s: string, m: string, d?: any) => console.log(`%c${LOG_PREFIX} ℹ️  [${s}]%c ${m}`, "color:#60a5fa;font-weight:bold;", "color:inherit;", d ?? ""),
  success: (s: string, m: string, d?: any) => console.log(`%c${LOG_PREFIX} ✅ [${s}]%c ${m}`, "color:#34d399;font-weight:bold;", "color:inherit;", d ?? ""),
  warn:    (s: string, m: string, d?: any) => console.warn(`%c${LOG_PREFIX} ⚠️  [${s}]%c ${m}`, "color:#fbbf24;font-weight:bold;", "color:inherit;", d ?? ""),
  error:   (s: string, m: string, d?: any) => console.error(`%c${LOG_PREFIX} ❌ [${s}]%c ${m}`, "color:#f87171;font-weight:bold;", "color:inherit;", d ?? ""),
  perf:    (s: string, l: string, ms: number) => console.log(`%c${LOG_PREFIX} ⏱️  [${s}]%c ${l} — ${ms.toFixed(2)}ms`, "color:#a78bfa;font-weight:bold;", "color:inherit;"),
  event:   (s: string, a: string, d?: any) => console.log(`%c${LOG_PREFIX} 🎯 [${s}]%c ACTION → ${a}`, "color:#f472b6;font-weight:bold;", "color:inherit;", d ?? ""),
  oauth:   (m: string, d?: any) => console.log(`%c${LOG_PREFIX} 🌐 [OAUTH]%c ${m}`, "color:#22d3ee;font-weight:bold;", "color:inherit;", d ?? ""),
  auth:    (m: string, d?: any) => console.log(`%c${LOG_PREFIX} 🔐 [AUTH]%c ${m}`, "color:#c084fc;font-weight:bold;", "color:inherit;", d ?? ""),
  abuse:   (m: string, d?: any) => console.warn(`%c${LOG_PREFIX} 🚩 [ABUSE]%c ${m}`, "color:#f97316;font-weight:bold;", "color:inherit;", d ?? ""),
  fp:      (m: string, d?: any) => console.log(`%c${LOG_PREFIX} 🖥️  [FP]%c ${m}`, "color:#818cf8;font-weight:bold;", "color:inherit;", d ?? ""),
  mount:   (c: string) => console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}>`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) => console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}>`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
  sep:     () => console.log("%c" + "─".repeat(60), "color:#374151;"),
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================================
// 📱 useIsMobile
// ============================================================
function useIsMobile(bp = 768): boolean {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${bp}px)`);
    setV(mql.matches);
    const h = (e: MediaQueryListEvent) => setV(e.matches);
    mql.addEventListener("change", h);
    return () => mql.removeEventListener("change", h);
  }, [bp]);
  return v ?? false;
}

// ============================================================
// 🖥️  DEVICE FINGERPRINT — silencioso, sem libs externas
//
// Gera um hash do dispositivo baseado em características
// disponíveis via browser APIs sem permissão do usuário.
// Não é 100% único mas é suficiente para flag de abuso.
// ============================================================
async function getDeviceFingerprint(): Promise<string> {
  try {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.platform || "",
    ].join("|");

    // Canvas fingerprint — mais único
    const canvas = document.createElement("canvas");
    const ctx    = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font         = "14px Arial";
      ctx.fillText("NexaSpark🔐", 2, 2);
      components.concat(canvas.toDataURL().slice(-20));
    }

    // Web Crypto API para hash SHA-256
    const encoder = new TextEncoder();
    const data    = encoder.encode(components);
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const hashHex = hashArr.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    logger.fp("Device fingerprint gerado", {
      hash_prefix: hashHex.substring(0, 12) + "...",
      components_length: components.length,
    });

    return hashHex;
  } catch (e) {
    logger.warn("FP", "Falha ao gerar fingerprint (não crítico)", { error: String(e) });
    return "";
  }
}

// ============================================================
// 🔒 CPF — Formatação e validação client-side
// ============================================================
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3)  return digits;
  if (digits.length <= 6)  return `${digits.slice(0,3)}.${digits.slice(3)}`;
  if (digits.length <= 9)  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11)            return false;
  if (/^(\d)\1{10}$/.test(digits))     return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(digits[9]))     return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === parseInt(digits[10]);
}

// ============================================================
// 🟢 PRESENCE ENGINE — onboarding (mesmo do v2.0)
// ============================================================
const ONBOARDING_MESSAGES = [
  { text: "Pronto para criar sua conta. Seja bem-vindo.",       color: "#34d399" },
  { text: "Sua primeira emissão está a um clique de distância.", color: "#34d399" },
  { text: "Plataforma segura. Cadastro criptografado.",          color: "#60a5fa" },
  { text: "Junte-se a quem já certifica com autoridade.",        color: "#a78bfa" },
  { text: "Configuração em segundos. Emissão para sempre.",      color: "#34d399" },
  { text: "Sistema operacional. Aguardando seu cadastro.",        color: "#34d399" },
];

function PresenceEngineCompact() {
  const [text, setText] = useState("");
  const [idx, setIdx]   = useState(0);
  const [char, setChar] = useState(0);

  useEffect(() => {
    const msg = ONBOARDING_MESSAGES[idx].text;
    if (char < msg.length) {
      const t = setTimeout(() => { setText(msg.slice(0, char + 1)); setChar(c => c + 1); }, 38);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => { setIdx(i => (i + 1) % ONBOARDING_MESSAGES.length); setChar(0); setText(""); }, 2800);
      return () => clearTimeout(t);
    }
  }, [char, idx]);

  const color = ONBOARDING_MESSAGES[idx].color;
  return (
    <div style={{ borderRadius:12, border:`1px solid ${color}26`, background:"rgba(4,7,14,0.92)", backdropFilter:"blur(16px)", overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 13px", borderBottom:`1px solid ${color}10`, background:`${color}06` }}>
        {["#f87171","#fbbf24","#34d399"].map((c,i) => <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:c, opacity:0.75 }}/>)}
        <span style={{ fontSize:9, color:"rgba(255,255,255,0.15)", marginLeft:6, fontFamily:"monospace" }}>nexaspark — sistema</span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4 }}>
          <div style={{ width:4, height:4, borderRadius:"50%", background:"#10b981", animation:"blink 1s ease infinite" }}/>
          <span style={{ fontSize:8, color:"rgba(16,185,129,0.5)", fontFamily:"monospace" }}>ONLINE</span>
        </div>
      </div>
      <div style={{ padding:"11px 14px", display:"flex", gap:9, alignItems:"flex-start" }}>
        <span style={{ color, fontSize:10, fontFamily:"monospace", flexShrink:0, marginTop:1 }}>$</span>
        <span style={{ fontSize:10, fontFamily:"monospace", color, lineHeight:1.6, flex:1 }}>
          {text}
          <span style={{ display:"inline-block", width:5, height:10, background:color, borderRadius:1, marginLeft:2, verticalAlign:"middle", animation:"cursor-blink 1.05s ease infinite" }}/>
        </span>
      </div>
    </div>
  );
}

// ============================================================
// 🖼️  CANVAS + CLOCK (idênticos ao v2.0)
// ============================================================
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let id: number, W = 0, H = 0;
    type P = { x:number;y:number;vx:number;vy:number;r:number;alpha:number;pulse:number;speed:number };
    let pts: P[] = [];
    const resize = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
    const spawn = (): P => ({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*.28, vy:(Math.random()-.5)*.28, r:Math.random()*1.4+.4, alpha:Math.random()*.35+.04, pulse:Math.random()*Math.PI*2, speed:Math.random()*.012+.004 });
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      pts.forEach((p,i) => {
        p.x+=p.vx; p.y+=p.vy; p.pulse+=p.speed;
        if(p.x<-5)p.x=W+5; if(p.x>W+5)p.x=-5; if(p.y<-5)p.y=H+5; if(p.y>H+5)p.y=-5;
        const a=p.alpha*(0.6+0.4*Math.sin(p.pulse));
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=`rgba(16,185,129,${a})`; ctx.fill();
        for(let j=i+1;j<pts.length;j++){
          const q=pts[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);
          if(d<110){ ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.strokeStyle=`rgba(16,185,129,${.055*(1-d/110)})`; ctx.lineWidth=.5; ctx.stroke(); }
        }
      });
      id = requestAnimationFrame(draw);
    };
    resize(); pts = Array.from({length:45}, spawn); draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, opacity:.5 }}/>;
}

function useClock() {
  const [t,setT] = useState("");
  useEffect(() => {
    const f = () => new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    setT(f()); const id = setInterval(()=>setT(f()),1000); return()=>clearInterval(id);
  },[]);
  return t;
}

function getPwStrength(p: string) {
  if (!p)          return { level:0, label:"",      color:"transparent", segments:[0,0,0,0] };
  if (p.length<6)  return { level:1, label:"Fraca", color:"#f87171",     segments:[1,0,0,0] };
  if (p.length<10) return { level:2, label:"Média", color:"#fbbf24",     segments:[1,1,0,0] };
  if (p.length<14) return { level:3, label:"Boa",   color:"#34d399",     segments:[1,1,1,0] };
  return             { level:4, label:"Forte",      color:"#10b981",     segments:[1,1,1,1] };
}

function RegisterLoading() {
  return (
    <div style={{minHeight:"100vh",background:"#050810",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:36,height:36,position:"relative"}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"1.5px solid transparent",borderTopColor:"#10b981",animation:"spin .8s linear infinite"}}/>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ============================================================
// 📝 REGISTER INNER
// ============================================================
function RegisterInner() {
  const router   = useRouter();
  const clock    = useClock();
  const isMobile = useIsMobile(768);

  const [email,             setEmail]             = useState("");
  const [senha,             setSenha]             = useState("");
  const [cpf,               setCpf]               = useState("");
  const [nome_completo,     setNomeCompleto]       = useState("");
  const [showPass,          setShowPass]           = useState(false);
  const [loading,           setLoading]            = useState(false);
  const [loadGoogle,        setLoadGoogle]         = useState(false);
  const [errorMsg,          setErrorMsg]           = useState<string | null>(null);
  const [focused,           setFocused]            = useState<"email"|"senha"|"cpf"|"nome"|null>(null);
  const [mounted,           setMounted]            = useState(false);
  const [success,           setSuccess]            = useState(false);
  const [deviceFingerprint, setDeviceFingerprint]  = useState("");
  const [cpfError,          setCpfError]           = useState<string|null>(null);

  const t0  = useRef(0);
  const pw  = getPwStrength(senha);

  // Gera device fingerprint silenciosamente ao montar
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    getDeviceFingerprint().then(fp => {
      setDeviceFingerprint(fp);
      logger.fp("Fingerprint coletado silenciosamente", { hash_prefix: fp.substring(0, 8) + "..." });
    });
    logger.sep(); logger.mount("RegisterInner v2.1");
    logger.info("INIT", "Register v2.1 carregado", { apiUrl:API_URL, version:"2.1.0" });
    return () => { clearTimeout(t); logger.unmount("RegisterInner v2.1"); logger.sep(); };
  }, []);

  const fadeIn = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(18px)",
    transition: `opacity .6s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform .6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
  });

  const ClockBadge = () => (
    <div style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 11px",borderRadius:20,background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.12)" }}>
      <div style={{ width:5,height:5,borderRadius:"50%",background:"#10b981",animation:"blink 1.2s ease infinite" }}/>
      <span style={{ fontSize:10,color:"rgba(16,185,129,0.7)",fontFamily:"monospace",letterSpacing:"0.05em" }}>{clock}</span>
    </div>
  );

  // CPF — formata + valida ao sair do campo
  function handleCpfChange(v: string) {
    const formatted = formatCpf(v);
    setCpf(formatted);
    setCpfError(null);
    setErrorMsg(null);
    logger.event("FORM", "CPF digitado", { length: formatted.replace(/\D/g,"").length });
  }

  function handleCpfBlur() {
    setFocused(null);
    const digits = cpf.replace(/\D/g, "");
    if (digits.length === 0) return; // campo vazio — não valida ainda
    if (digits.length === 11) {
      const valid = validateCpf(digits);
      if (!valid) {
        setCpfError("CPF inválido. Verifique os dígitos.");
        logger.warn("FORM:CPF", "CPF inválido (dígitos verificadores)", { sufixo: digits.slice(-2) });
      } else {
        setCpfError(null);
        logger.success("FORM:CPF", "CPF válido ✅", { sufixo: digits.slice(-2) });
      }
    }
  }

  // ── Register ───────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setErrorMsg(null);

    if (!email.trim())               { setErrorMsg("E-mail é obrigatório."); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setErrorMsg("Formato de e-mail inválido."); return; }
    if (senha.length < 8)            { setErrorMsg("A senha deve ter no mínimo 8 caracteres."); return; }

    const cpfDigitos = cpf.replace(/\D/g, "");
    if (!cpfDigitos || cpfDigitos.length !== 11) {
      setErrorMsg("CPF é obrigatório e deve ter 11 dígitos.");
      logger.warn("REGISTER", "CPF inválido no submit", { length: cpfDigitos.length });
      return;
    }
    if (!validateCpf(cpfDigitos)) {
      setErrorMsg("CPF inválido. Verifique os dígitos.");
      return;
    }

    t0.current = performance.now();
    setLoading(true);

    logger.sep();
    logger.auth("Register v2.1 iniciado", {
      email:       email.trim().toLowerCase(),
      cpf_sufixo:  cpfDigitos.slice(-2),
      hasDevice:   !!deviceFingerprint,
      nome_length: nome_completo.length,
    });

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": `register_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        },
        body: JSON.stringify({
          email:             email.trim().toLowerCase(),
          password:          senha,
          cpf_emissor:       cpfDigitos,         // ← v2.1: lock primário
          nome_completo:     nome_completo || null,
          device_fingerprint: deviceFingerprint || null, // ← v2.1: silencioso
        }),
      });

      logger.perf("REGISTER", "HTTP response", performance.now() - t0.current);

      let data: any = {};
      try { data = await res.json(); }
      catch { throw new Error("Resposta inválida do servidor"); }

      if (!res.ok) {
        // ── Tratamento específico por código de erro ──────
        if (data?.code === "REGISTRATION_BLOCKED") {
          logger.abuse("Registro bloqueado pelo servidor", { code: data.code, email: email.trim() });
          setErrorMsg("Não foi possível criar a conta com os dados informados. Entre em contato com o suporte se precisar de ajuda.");
          return;
        }
        if (data?.code === "INVALID_CPF") {
          setCpfError("CPF inválido segundo nosso sistema. Verifique os dígitos.");
          setErrorMsg(null);
          return;
        }

        const msg = typeof data?.error==="string" ? data.error :
          Array.isArray(data?.errors) ? data.errors.map((e:any)=>e.message||e).join(" • ") :
          "Erro ao criar conta.";
        setErrorMsg(msg);
        return;
      }

      const token = data.token || data.data?.token;
      logger.success("REGISTER", "Conta criada ✅", {
        userId:      data.data?.id,
        plano:       data.data?.plano,
        plano_limite: data.data?.plano_limite,
      });
      logger.perf("REGISTER:FLOW", "Completo", performance.now() - t0.current);

      if (token) {
        localStorage.setItem("token", token);
        document.cookie = `token=${token}; path=/; SameSite=Lax`;
        logger.auth("Token armazenado ✅");
        setSuccess(true);
        setTimeout(() => { logger.event("NAV", "/dashboard"); router.push("/dashboard"); }, 900);
      } else {
        router.push("/login");
      }
    } catch(err: any) {
      logger.error("REGISTER:NETWORK", err.message);
      setErrorMsg(err.message || "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false); logger.sep();
    }
  }

  function handleGoogleRegister() {
    logger.sep();
    logger.oauth("OAuth Google iniciado via Register", { endpoint:`${API_URL}/api/auth/google` });
    setLoadGoogle(true);
    setTimeout(() => { window.location.href = `${API_URL}/api/auth/google`; }, 150);
  }

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes spin          { to{transform:rotate(360deg)} }
        @keyframes blink         { 0%,100%{opacity:1}50%{opacity:.25} }
        @keyframes float         { 0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)} }
        @keyframes cursor-blink  { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes shimmer-sweep { 0%{transform:translateX(-100%)}100%{transform:translateX(100%)} }
        @keyframes error-shake   { 0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)} }
        @keyframes fade-slide-up { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes success-pop   { 0%{transform:scale(.85);opacity:0}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:1} }
        *{box-sizing:border-box}
        ::-webkit-scrollbar{display:none}
        input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{
          -webkit-box-shadow:0 0 0 1000px rgba(6,10,18,.98) inset !important;
          -webkit-text-fill-color:rgba(255,255,255,.85) !important;
          transition:background-color 5000s;
        }
        .rf input::placeholder{color:transparent !important}
        .gbtn::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.05),transparent);transform:translateX(-100%);}
        .gbtn:hover::after{animation:shimmer-sweep .7s ease forwards}
      `}</style>

      <div style={{minHeight:"100vh",background:"#050810",display:"flex",position:"relative",overflow:"hidden",fontFamily:"'Syne',system-ui,sans-serif"}}>
        <ParticleCanvas/>

        <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",background:"radial-gradient(ellipse 65% 55% at 18% 55%,rgba(16,185,129,.055) 0%,transparent 60%)"}}/>
        <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(255,255,255,.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.016) 1px,transparent 1px)",backgroundSize:"56px 56px"}}/>

        <div style={{display:"flex",width:"100%",minHeight:"100vh",position:"relative",zIndex:1,flexDirection:isMobile?"column":"row"}}>

          {/* ── HERO DESKTOP ── */}
          {!isMobile && (
            <div style={{flex:"0 0 50%",height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column",padding:"32px 52px",borderRight:"1px solid rgba(16,185,129,0.06)",position:"relative"}}>
              <div style={{position:"absolute",bottom:-60,left:-60,width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,.08) 0%,transparent 70%)",filter:"blur(50px)",pointerEvents:"none"}}/>

              <div style={{...fadeIn(0),display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:11}}>
                  <div style={{width:36,height:36,borderRadius:11,background:"linear-gradient(135deg,rgba(16,185,129,.25),rgba(16,185,129,.06))",border:"1px solid rgba(16,185,129,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,animation:"float 3s ease-in-out infinite"}}>⚡</div>
                  <span style={{fontSize:16,fontWeight:700,color:"rgba(255,255,255,.9)",letterSpacing:"-0.02em"}}>NexaSpark</span>
                </div>
                <ClockBadge/>
              </div>

              <div style={{...fadeIn(120),flex:1,display:"flex",flexDirection:"column",justifyContent:"center",paddingTop:12,paddingBottom:12}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 13px",borderRadius:20,background:"rgba(16,185,129,.07)",border:"1px solid rgba(16,185,129,.2)",marginBottom:28,width:"fit-content"}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",animation:"blink 2s ease infinite"}}/>
                  <span style={{fontSize:9,color:"rgba(16,185,129,.8)",letterSpacing:"0.15em",textTransform:"uppercase",fontFamily:"monospace"}}>Cadastro gratuito · Sem cartão</span>
                </div>

                <h1 style={{fontSize:"clamp(28px,3vw,44px)",fontWeight:800,lineHeight:1.12,letterSpacing:"-0.035em",color:"rgba(255,255,255,.93)",margin:"0 0 18px"}}>
                  Comece a certificar<br/>
                  <span style={{color:"#34d399"}}>com autoridade.</span>
                </h1>

                <p style={{fontSize:13,color:"rgba(255,255,255,.3)",lineHeight:1.85,margin:"0 0 32px",maxWidth:340}}>
                  Crie sua conta em segundos e emita certificados digitais com validade jurídica e verificação pública instantânea.
                </p>

                {/* Steps */}
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  {[
                    { step:"01", title:"Crie sua conta",       desc:"Dados seguros · CPF protegido" },
                    { step:"02", title:"3 certificados free",  desc:"Sem cartão · Sem prazo de expiração" },
                    { step:"03", title:"Emita instantaneamente",desc:"PDF em < 3s · QR Code + SHA-256" },
                  ].map((item, i) => (
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:14}}>
                      <div style={{width:28,height:28,borderRadius:8,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <span style={{fontSize:9,color:"rgba(16,185,129,.7)",fontFamily:"monospace",fontWeight:700}}>{item.step}</span>
                      </div>
                      <div>
                        <p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,.65)",margin:"0 0 2px"}}>{item.title}</p>
                        <p style={{fontSize:11,color:"rgba(255,255,255,.25)",margin:0,lineHeight:1.5}}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* v2.1: Banner plano free */}
                <div style={{marginTop:28,display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,background:"rgba(16,185,129,0.04)",border:"1px solid rgba(16,185,129,0.12)"}}>
                  <div style={{fontSize:20,flexShrink:0}}>🎁</div>
                  <div>
                    <p style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.65)",margin:"0 0 2px"}}>3 certificados grátis</p>
                    <p style={{fontSize:11,color:"rgba(255,255,255,.25)",margin:0}}>Sem cartão de crédito. Cancele quando quiser.</p>
                  </div>
                </div>
              </div>

              <div style={{...fadeIn(250),flexShrink:0}}>
                {/* Terminal desktop usa o componente completo */}
                <div style={{borderRadius:14,border:"1px solid rgba(16,185,129,0.15)",background:"rgba(4,7,14,0.95)",backdropFilter:"blur(20px)",overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,padding:"9px 14px",borderBottom:"1px solid rgba(16,185,129,0.08)",background:"rgba(16,185,129,0.03)"}}>
                    {["#f87171","#fbbf24","#34d399"].map((c,i)=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:c,opacity:0.75}}/>)}
                    <span style={{fontSize:9,color:"rgba(255,255,255,0.18)",marginLeft:8,fontFamily:"monospace"}}>nexaspark — sistema</span>
                    <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",animation:"blink 1s ease infinite"}}/>
                      <span style={{fontSize:8,color:"rgba(16,185,129,0.6)",fontFamily:"monospace",letterSpacing:"0.12em"}}>ONLINE</span>
                    </div>
                  </div>
                  <PresenceEngineCompact/>
                </div>
              </div>
            </div>
          )}

          {/* ── FORM COLUMN ── */}
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:isMobile?"flex-start":"center",padding:isMobile?"20px 18px 36px":"32px 32px",overflowY:isMobile?"auto":"visible",minWidth:0}}>

            {isMobile && (
              <div style={{...fadeIn(0),width:"100%",maxWidth:420,marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:32,height:32,borderRadius:10,background:"rgba(16,185,129,.14)",border:"1px solid rgba(16,185,129,.28)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,animation:"float 3s ease-in-out infinite"}}>⚡</div>
                  <span style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,.88)",letterSpacing:"-0.02em"}}>NexaSpark</span>
                </div>
                <ClockBadge/>
              </div>
            )}

            {isMobile && (
              <div style={{...fadeIn(80),width:"100%",maxWidth:420,marginBottom:20}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 11px",borderRadius:20,background:"rgba(16,185,129,.07)",border:"1px solid rgba(16,185,129,.2)",marginBottom:10}}>
                  <div style={{width:4,height:4,borderRadius:"50%",background:"#10b981",animation:"blink 2s ease infinite"}}/>
                  <span style={{fontSize:8,color:"rgba(16,185,129,.8)",letterSpacing:"0.15em",textTransform:"uppercase",fontFamily:"monospace"}}>Cadastro gratuito</span>
                </div>
                <h1 style={{fontSize:24,fontWeight:800,lineHeight:1.15,letterSpacing:"-0.03em",color:"rgba(255,255,255,.93)",margin:"0 0 8px"}}>
                  Comece a certificar{" "}<span style={{color:"#34d399"}}>com autoridade.</span>
                </h1>
                {/* v2.1: Banner plano free mobile */}
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.12)"}}>
                  <span style={{fontSize:16}}>🎁</span>
                  <div>
                    <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.6)",margin:"0 0 1px"}}>3 certificados grátis</p>
                    <p style={{fontSize:10,color:"rgba(255,255,255,.25)",margin:0}}>Sem cartão · Sem expiração</p>
                  </div>
                </div>
              </div>
            )}

            {/* CARD */}
            <div style={{...fadeIn(isMobile?180:80),width:"100%",maxWidth:420}}>
              <div style={{borderRadius:22,border:"1px solid rgba(255,255,255,.08)",background:"rgba(8,12,22,.92)",backdropFilter:"blur(32px)",overflow:"hidden",boxShadow:"0 0 0 1px rgba(255,255,255,.03),0 40px 80px rgba(0,0,0,.8)"}}>

                <div style={{height:2,background:"linear-gradient(90deg,rgba(16,185,129,0) 0%,rgba(16,185,129,.7) 40%,rgba(16,185,129,.7) 60%,rgba(16,185,129,0) 100%)"}}/>

                <div style={{padding:isMobile?"24px 22px 20px":"28px 30px 22px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18}}>
                    <div style={{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,rgba(16,185,129,.18),rgba(16,185,129,.04))",border:"1px solid rgba(16,185,129,.22)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {success ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:"success-pop .5s ease"}}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                        </svg>
                      )}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:20,background:"rgba(96,165,250,.05)",border:"1px solid rgba(96,165,250,.14)"}}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span style={{fontSize:9,color:"rgba(96,165,250,.6)",fontFamily:"monospace",letterSpacing:"0.08em"}}>SSL 256-bit</span>
                    </div>
                  </div>
                  <h2 style={{fontSize:21,fontWeight:700,color:success?"#34d399":"rgba(255,255,255,.9)",margin:"0 0 5px",letterSpacing:"-0.025em",transition:"color .4s"}}>
                    {success ? "Conta criada com sucesso!" : "Criar sua conta"}
                  </h2>
                  <p style={{fontSize:12,color:"rgba(255,255,255,.2)",margin:0,lineHeight:1.6}}>
                    {success ? "Redirecionando para o dashboard..." : "Junte-se à plataforma de certificação digital."}
                  </p>
                </div>

                <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.055) 30%,rgba(255,255,255,.055) 70%,transparent)",margin:"0 20px"}}/>

                <div style={{padding:isMobile?"20px 22px 26px":"22px 30px 30px"}}>

                  {/* GOOGLE */}
                  <div style={{marginBottom:14}}>
                    <button type="button" onClick={handleGoogleRegister} disabled={loading||loadGoogle||success} className="gbtn"
                      style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"12px 0",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.72)",fontSize:13,fontWeight:500,cursor:loading||loadGoogle||success?"not-allowed":"pointer",opacity:loading||loadGoogle?.5:1,transition:"all .2s",fontFamily:"'Syne',system-ui,sans-serif",position:"relative",overflow:"hidden"}}
                      onMouseEnter={e=>{if(loading||loadGoogle||success)return;const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="rgba(255,255,255,.2)";b.style.color="rgba(255,255,255,.9)";b.style.background="rgba(255,255,255,.07)";}}
                      onMouseLeave={e=>{const b=e.currentTarget as HTMLButtonElement;b.style.borderColor="rgba(255,255,255,.1)";b.style.color="rgba(255,255,255,.72)";b.style.background="rgba(255,255,255,.04)";}}
                    >
                      {loadGoogle?(<><div style={{width:15,height:15,borderRadius:"50%",border:"1.5px solid rgba(255,255,255,.2)",borderTopColor:"rgba(255,255,255,.7)",animation:"spin .7s linear infinite"}}/><span style={{color:"rgba(255,255,255,.4)"}}>Redirecionando...</span></>):(
                        <><svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        <span>Cadastrar com Google</span></>
                      )}
                    </button>
                  </div>

                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                    <div style={{flex:1,height:1,background:"rgba(255,255,255,.055)"}}/>
                    <span style={{fontSize:10,color:"rgba(255,255,255,.18)",fontFamily:"monospace",letterSpacing:"0.12em"}}>OU</span>
                    <div style={{flex:1,height:1,background:"rgba(255,255,255,.055)"}}/>
                  </div>

                  <form onSubmit={handleRegister} noValidate style={{display:"flex",flexDirection:"column",gap:10}}>

                    {/* EMAIL */}
                    <div className="rf">
                      <div style={{position:"relative"}}>
                        <label htmlFor="reg-email" style={{position:"absolute",left:14,top:focused==="email"||email?7:15,fontSize:focused==="email"||email?9:13,letterSpacing:focused==="email"||email?"0.08em":"0",textTransform:focused==="email"||email?"uppercase":"none",color:focused==="email"?"#34d399":email?"rgba(255,255,255,.3)":"rgba(255,255,255,.22)",transition:"all .2s ease",pointerEvents:"none",fontFamily:"monospace",zIndex:1}}>E-mail</label>
                        <input id="reg-email" type="email" value={email}
                          onChange={e=>{setEmail(e.target.value);setErrorMsg(null);}}
                          onFocus={()=>{setFocused("email");logger.event("FORM","email focado");}}
                          onBlur={()=>setFocused(null)}
                          autoComplete="email" disabled={loading||loadGoogle||success}
                          style={{width:"100%",background:"rgba(6,10,18,.95)",border:`1px solid ${focused==="email"?"rgba(16,185,129,.5)":"rgba(255,255,255,.07)"}`,borderRadius:12,padding:"22px 14px 8px",fontSize:13,color:"rgba(255,255,255,.88)",outline:"none",transition:"border-color .2s,box-shadow .2s",boxShadow:focused==="email"?"0 0 0 3px rgba(16,185,129,.09)":"none",fontFamily:"'Syne',system-ui,sans-serif",opacity:loading||loadGoogle||success?.5:1}}
                        />
                      </div>
                    </div>

                    {/* CPF — v2.1 NOVO */}
                    <div className="rf">
                      <div style={{position:"relative"}}>
                        <label htmlFor="reg-cpf" style={{position:"absolute",left:14,top:focused==="cpf"||cpf?7:15,fontSize:focused==="cpf"||cpf?9:13,letterSpacing:focused==="cpf"||cpf?"0.08em":"0",textTransform:focused==="cpf"||cpf?"uppercase":"none",color:cpfError?"#f87171":focused==="cpf"?"#34d399":cpf?"rgba(255,255,255,.3)":"rgba(255,255,255,.22)",transition:"all .2s ease",pointerEvents:"none",fontFamily:"monospace",zIndex:1}}>CPF</label>
                        <input id="reg-cpf" type="text" value={cpf} inputMode="numeric"
                          onChange={e=>handleCpfChange(e.target.value)}
                          onFocus={()=>{setFocused("cpf");logger.event("FORM","cpf focado");}}
                          onBlur={handleCpfBlur}
                          autoComplete="off" disabled={loading||loadGoogle||success}
                          maxLength={14}
                          style={{width:"100%",background:"rgba(6,10,18,.95)",border:`1px solid ${cpfError?"rgba(239,68,68,.5)":focused==="cpf"?"rgba(16,185,129,.5)":"rgba(255,255,255,.07)"}`,borderRadius:12,padding:"22px 14px 8px",fontSize:13,color:"rgba(255,255,255,.88)",outline:"none",transition:"border-color .2s,box-shadow .2s",boxShadow:cpfError?"0 0 0 3px rgba(239,68,68,.08)":focused==="cpf"?"0 0 0 3px rgba(16,185,129,.09)":"none",fontFamily:"monospace",letterSpacing:"0.05em",opacity:loading||loadGoogle||success?.5:1}}
                        />
                        {/* Indicador de validade do CPF */}
                        {cpf.replace(/\D/g,"").length === 11 && !cpfError && (
                          <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#34d399",fontSize:12}}>✓</div>
                        )}
                      </div>
                      {cpfError && (
                        <p style={{fontSize:10,color:"#f87171",margin:"4px 0 0",fontFamily:"monospace"}}>{cpfError}</p>
                      )}
                      {!cpfError && (
                        <p style={{fontSize:10,color:"rgba(255,255,255,.15)",margin:"4px 0 0",fontFamily:"monospace"}}>
                          Seu CPF é armazenado com criptografia — LGPD Art. 46
                        </p>
                      )}
                    </div>

                    {/* SENHA */}
                    <div className="rf">
                      <div style={{position:"relative"}}>
                        <label htmlFor="reg-senha" style={{position:"absolute",left:14,top:focused==="senha"||senha?7:15,fontSize:focused==="senha"||senha?9:13,letterSpacing:focused==="senha"||senha?"0.08em":"0",textTransform:focused==="senha"||senha?"uppercase":"none",color:focused==="senha"?"#34d399":senha?"rgba(255,255,255,.3)":"rgba(255,255,255,.22)",transition:"all .2s ease",pointerEvents:"none",fontFamily:"monospace",zIndex:1}}>Senha</label>
                        <input id="reg-senha" type={showPass?"text":"password"} value={senha}
                          onChange={e=>{setSenha(e.target.value);setErrorMsg(null);}}
                          onFocus={()=>{setFocused("senha");logger.event("FORM","senha focada");}}
                          onBlur={()=>setFocused(null)}
                          autoComplete="new-password" disabled={loading||loadGoogle||success}
                          style={{width:"100%",background:"rgba(6,10,18,.95)",border:`1px solid ${focused==="senha"?"rgba(16,185,129,.5)":"rgba(255,255,255,.07)"}`,borderRadius:12,padding:"22px 42px 8px 14px",fontSize:13,color:"rgba(255,255,255,.88)",outline:"none",transition:"border-color .2s,box-shadow .2s",boxShadow:focused==="senha"?"0 0 0 3px rgba(16,185,129,.09)":"none",fontFamily:showPass?"monospace":"'Syne',system-ui,sans-serif",opacity:loading||loadGoogle||success?.5:1}}
                        />
                        <button type="button" tabIndex={-1} onClick={()=>{setShowPass(v=>!v);logger.event("UX",`Senha ${showPass?"ocultada":"exibida"}`);}}
                          style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4,transition:"color .2s"}}
                          onMouseEnter={e=>(e.currentTarget.style.color="rgba(255,255,255,.6)")}
                          onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,.2)")}
                        >
                          {showPass?(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>):(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>)}
                        </button>
                      </div>
                      {senha.length>0&&(
                        <div style={{marginTop:5,display:"flex",alignItems:"center",gap:6}}>
                          {pw.segments.map((active,i)=>(
                            <div key={i} style={{flex:1,height:2,borderRadius:1,background:active?pw.color:"rgba(255,255,255,.07)",transition:"background .35s ease",boxShadow:active?`0 0 6px ${pw.color}55`:"none"}}/>
                          ))}
                          <span style={{fontSize:9,color:pw.color,fontFamily:"monospace",minWidth:34,textAlign:"right",marginLeft:2}}>{pw.label}</span>
                        </div>
                      )}
                    </div>

                    {/* ERRO */}
                    {errorMsg&&(
                      <div style={{display:"flex",alignItems:"flex-start",gap:9,padding:"11px 13px",borderRadius:10,background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.2)",animation:"error-shake .4s ease,fade-slide-up .3s ease"}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p style={{color:"rgba(248,113,113,.85)",fontSize:12,margin:0,lineHeight:1.6}}>{errorMsg}</p>
                      </div>
                    )}

                    {/* SUBMIT */}
                    <button type="submit" disabled={loading||loadGoogle||success||!!cpfError}
                      onClick={()=>!loading&&logger.event("REGISTER","Submit clicado")}
                      style={{width:"100%",background:success?"linear-gradient(135deg,rgba(16,185,129,.28) 0%,rgba(16,185,129,.18) 100%)":loading?"rgba(16,185,129,.05)":"linear-gradient(135deg,rgba(16,185,129,.22) 0%,rgba(16,185,129,.12) 100%)",border:`1px solid ${success?"rgba(16,185,129,.55)":"rgba(16,185,129,.38)"}`,borderRadius:12,padding:"14px 0",color:loading?"rgba(52,211,153,.4)":"#34d399",fontSize:13,fontWeight:700,cursor:loading||loadGoogle||success||!!cpfError?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9,transition:"all .25s",opacity:loading||loadGoogle?.65:1,fontFamily:"'Syne',system-ui,sans-serif",letterSpacing:"0.04em",boxShadow:loading?"none":"0 0 32px rgba(16,185,129,.14),inset 0 1px 0 rgba(16,185,129,.15)",marginTop:4}}
                      onMouseEnter={e=>{if(loading||loadGoogle||success||cpfError)return;const b=e.currentTarget as HTMLButtonElement;b.style.boxShadow="0 0 48px rgba(16,185,129,.22),inset 0 1px 0 rgba(16,185,129,.2)";b.style.borderColor="rgba(16,185,129,.55)";b.style.transform="translateY(-1px)";}}
                      onMouseLeave={e=>{if(loading||loadGoogle||success||cpfError)return;const b=e.currentTarget as HTMLButtonElement;b.style.boxShadow="0 0 32px rgba(16,185,129,.14),inset 0 1px 0 rgba(16,185,129,.15)";b.style.borderColor="rgba(16,185,129,.38)";b.style.transform="translateY(0)";}}
                    >
                      {success?(<><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Conta criada — entrando...</span></>):
                       loading?(<><div style={{width:14,height:14,borderRadius:"50%",border:"1.5px solid rgba(52,211,153,.2)",borderTopColor:"#34d399",animation:"spin .7s linear infinite"}}/><span>Criando conta...</span></>):
                       (<><span style={{fontSize:13}}>→</span><span>Criar minha conta</span></>)}
                    </button>
                  </form>

                  <p style={{textAlign:"center",fontSize:12,color:"rgba(255,255,255,.2)",margin:"18px 0 0"}}>
                    Já tem uma conta?{" "}
                    <button onClick={()=>{logger.event("NAV","→ /login");router.push("/login");}}
                      style={{background:"none",border:"none",cursor:"pointer",color:"rgba(16,185,129,.7)",fontWeight:600,fontSize:12,transition:"color .2s",fontFamily:"'Syne',system-ui,sans-serif",padding:0}}
                      onMouseEnter={e=>(e.currentTarget.style.color="#34d399")}
                      onMouseLeave={e=>(e.currentTarget.style.color="rgba(16,185,129,.7)")}
                    >Entrar na plataforma</button>
                  </p>
                </div>
              </div>

              {isMobile && (
                <div style={{...fadeIn(300),marginTop:18}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(16,185,129,.12))"}}/>
                    <span style={{fontSize:8,color:"rgba(16,185,129,.35)",fontFamily:"monospace",letterSpacing:"0.15em",textTransform:"uppercase"}}>Status do sistema</span>
                    <div style={{flex:1,height:1,background:"linear-gradient(270deg,transparent,rgba(16,185,129,.12))"}}/>
                  </div>
                  <PresenceEngineCompact/>
                </div>
              )}

              <div style={{...fadeIn(isMobile?380:400),marginTop:18,display:"flex",flexDirection:"column",alignItems:"center",gap:9}}>
                <a href="https://wa.me/5519982714815?text=Preciso%20de%20ajuda%20para%20criar%20minha%20conta%20NexaSpark" target="_blank" rel="noopener noreferrer"
                  onClick={()=>logger.event("REGISTER","Suporte WhatsApp clicado")}
                  style={{display:"inline-flex",alignItems:"center",gap:7,padding:"7px 16px",borderRadius:20,border:"1px solid rgba(255,255,255,.06)",background:"rgba(255,255,255,.02)",color:"rgba(255,255,255,.25)",fontSize:11,textDecoration:"none",transition:"all .2s",fontFamily:"'Syne',system-ui,sans-serif"}}
                  onMouseEnter={e=>{const a=e.currentTarget as HTMLAnchorElement;a.style.borderColor="rgba(37,211,102,.22)";a.style.background="rgba(37,211,102,.05)";a.style.color="rgba(37,211,102,.75)";}}
                  onMouseLeave={e=>{const a=e.currentTarget as HTMLAnchorElement;a.style.borderColor="rgba(255,255,255,.06)";a.style.background="rgba(255,255,255,.02)";a.style.color="rgba(255,255,255,.25)";}}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  <span>Precisa de ajuda? Falar com suporte</span>
                </a>
                <p style={{fontSize:10,color:"rgba(255,255,255,.08)",margin:0,fontFamily:"monospace"}}>
                  © {new Date().getFullYear()} NexaSpark · Certificação Digital
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterLoading/>}>
      <RegisterInner/>
    </Suspense>
  );
}