"use client";

// ============================================================
// 🏢 NexaSpark — CompleteProfileModal.tsx
// web/src/app/dashboard/CompleteProfileModal.tsx
//
// Modal obrigatório para usuários que entraram via Google
// e ainda não vincularam CPF + data de nascimento.
//
// COMPORTAMENTO:
//   - Não tem botão de fechar — obrigatório
//   - Aparece sobre o dashboard (backdrop blur)
//   - CPF com máscara automática + validação matemática
//   - Data de nascimento com validação de idade mínima (16 anos)
//   - Após sucesso: fecha, atualiza token, libera o dashboard
//
// TEXTO: combinação das opções 6 + 11 + 17
// ============================================================

import { useState, useEffect } from "react";

const LOG_PREFIX = "[NexaSpark:CompleteProfile]";
const logger = {
  info:    (msg: string, data?: any) => console.log(`%c${LOG_PREFIX} ℹ️%c ${msg}`,    "color:#60a5fa;font-weight:bold;", "color:inherit;", data ?? ""),
  success: (msg: string, data?: any) => console.log(`%c${LOG_PREFIX} ✅%c ${msg}`,   "color:#34d399;font-weight:bold;", "color:inherit;", data ?? ""),
  warn:    (msg: string, data?: any) => console.warn(`%c${LOG_PREFIX} ⚠️%c ${msg}`,  "color:#fbbf24;font-weight:bold;", "color:inherit;", data ?? ""),
  error:   (msg: string, data?: any) => console.error(`%c${LOG_PREFIX} ❌%c ${msg}`, "color:#f87171;font-weight:bold;", "color:inherit;", data ?? ""),
  perf:    (label: string, ms: number) => console.log(`%c${LOG_PREFIX} ⏱️%c ${label} — ${ms.toFixed(0)}ms`, "color:#a78bfa;font-weight:bold;", "color:inherit;"),
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function validateCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let f = (s * 10) % 11; if (f === 10 || f === 11) f = 0;
  if (f !== parseInt(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  let sc = (s * 10) % 11; if (sc === 10 || sc === 11) sc = 0;
  return sc === parseInt(d[10]);
}

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

interface CompleteProfileModalProps {
  user:       { id: number; email: string; nome?: string };
  onComplete: () => void;
}

export default function CompleteProfileModal({ user, onComplete }: CompleteProfileModalProps) {
  const [cpf,            setCpf]            = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [step,           setStep]           = useState<"form" | "success">("form");
  const [mounted,        setMounted]        = useState(false);

  const cpfDigits  = cpf.replace(/\D/g, "");
  const cpfIsValid = cpfDigits.length === 11 && validateCpf(cpfDigits);
  const cpfTyping  = cpfDigits.length > 0 && cpfDigits.length < 11;
  const firstName  = (user.nome || user.email.split("@")[0]).split(" ")[0];
  const canSubmit  = cpfIsValid && !!dataNascimento && !loading;

  useEffect(() => {
    logger.info("Modal montado", { userId: user.id, email: user.email });
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!cpfIsValid)      { setError("CPF inválido. Verifique os números informados."); return; }
    if (!dataNascimento)  { setError("Informe sua data de nascimento."); return; }

    const t0    = performance.now();
    const token = localStorage.getItem("token");
    if (!token) { setError("Sessão expirada. Faça login novamente."); return; }

    logger.info("Submetendo completeProfile", { cpf_sufixo: cpfDigits.slice(-2), data_nascimento: dataNascimento });
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/complete-profile`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Request-ID":  `cp_${Date.now()}`,
        },
        body: JSON.stringify({ cpf: cpfDigits, data_nascimento: dataNascimento }),
      });

      logger.perf("POST /complete-profile", performance.now() - t0);
      let data: any = {};
      try { data = await response.json(); } catch { throw new Error("Resposta inválida do servidor."); }

      if (!response.ok) {
        logger.error("Erro do servidor", { status: response.status, code: data?.code });
        if (data?.code === "INVALID_CPF")            { setError("CPF inválido. Verifique os números informados."); return; }
        if (data?.code === "CPF_ALREADY_REGISTERED") { setError("Este CPF já está vinculado a outra conta. Em caso de dúvida, contate o suporte."); return; }
        if (data?.code === "UNDERAGE")               { setError("É necessário ter pelo menos 16 anos para usar a plataforma."); return; }
        throw new Error(data?.error || "Erro ao salvar os dados. Tente novamente.");
      }

      if (data?.data?.token) {
        localStorage.setItem("token", data.data.token);
        logger.success("Novo token salvo", { cpf_cadastrado: true });
      }

      logger.success("Perfil completado!", { userId: user.id, totalMs: (performance.now() - t0).toFixed(0) + "ms" });
      setStep("success");
      setTimeout(() => { logger.info("Fechando modal"); onComplete(); }, 2200);

    } catch (err: any) {
      logger.error("Falha", { message: err.message });
      setError(err.message || "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    mounted ? 1 : 0,
    transform:  mounted ? "translateY(0)" : "translateY(8px)",
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap');
        @keyframes modal-in  { from{opacity:0;transform:scale(0.96) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fade-in   { from{opacity:0}to{opacity:1} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes blink     { 0%,100%{opacity:1}50%{opacity:0.2} }
        @keyframes float     { 0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)} }
        * { box-sizing:border-box; }
      `}</style>

      {/* BACKDROP */}
      <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(2,4,10,0.88)", backdropFilter:"blur(18px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px", animation:"fade-in 0.3s ease" }}>

        {/* CARD */}
        <div style={{ width:"100%", maxWidth:460, borderRadius:20, border:"1px solid rgba(16,185,129,0.18)", background:"rgba(6,10,20,0.98)", backdropFilter:"blur(24px)", overflow:"hidden", animation:"modal-in 0.4s cubic-bezier(0.22,1,0.36,1)", boxShadow:"0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(16,185,129,0.06)" }}>

          {/* CABEÇALHO */}
          <div style={{ padding:"20px 28px 18px", background:"linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.03))", borderBottom:"1px solid rgba(16,185,129,0.1)", display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, animation:"float 3s ease-in-out infinite", boxShadow:"0 0 20px rgba(16,185,129,0.12)" }}>⚡</div>
            <div>
              <p style={{ fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.92)", margin:0, fontFamily:"'Syne',system-ui", letterSpacing:"-0.01em" }}>
                {step === "success" ? "Tudo pronto!" : `Bem-vindo${firstName ? `, ${firstName}` : ""}!`}
              </p>
              <p style={{ fontSize:11, color:"rgba(16,185,129,0.6)", margin:"2px 0 0", fontFamily:"monospace" }}>
                {step === "success" ? "Identidade verificada ✓" : "NexaSpark · Verificação de identidade"}
              </p>
            </div>
          </div>

          {/* CORPO */}
          <div style={{ padding:"24px 28px 28px" }}>

            {/* TELA SUCESSO */}
            {step === "success" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", padding:"16px 0", gap:16 }}>
                <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(16,185,129,0.1)", border:"2px solid rgba(16,185,129,0.4)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 40px rgba(16,185,129,0.2)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize:16, fontWeight:700, color:"rgba(255,255,255,0.9)", margin:"0 0 8px", fontFamily:"'Syne',system-ui" }}>Identidade confirmada</p>
                  <p style={{ fontSize:13, color:"rgba(255,255,255,0.4)", margin:0, lineHeight:1.7 }}>Seu certificado agora tem uma identidade real.<br/>Redirecionando para o dashboard...</p>
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#10b981", animation:`blink 1.2s ease ${i*0.2}s infinite` }} />)}
                </div>
              </div>
            )}

            {/* FORMULÁRIO */}
            {step === "form" && (
              <>
                {/* TEXTO */}
                <div style={{ ...fade(80), padding:"14px 16px", borderRadius:12, background:"rgba(16,185,129,0.04)", border:"1px solid rgba(16,185,129,0.1)", marginBottom:20 }}>
                  <p style={{ fontSize:13, color:"rgba(255,255,255,0.55)", margin:0, lineHeight:1.75, fontFamily:"'Syne',system-ui" }}>
                    Não queremos apenas mais um usuário.{" "}
                    <span style={{ color:"rgba(255,255,255,0.82)", fontWeight:600 }}>Queremos saber com quem estamos trabalhando.</span>
                    {" "}Pessoas agem de má-fé — nós agimos diferente. Ao vincular seu CPF, você entra num sistema onde cada emissão tem{" "}
                    <span style={{ color:"#34d399" }}>identidade, rastreamento e responsabilidade.</span>
                    {" "}O certificado da sua empresa será único e impossível de ser falsificado.
                  </p>
                </div>

                {/* BADGES */}
                <div style={{ ...fade(130), display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
                  {[["🔐","CPF criptografado"],["🛡️","LGPD Art. 37"],["🔒","Anti-fraude"]].map(([icon,text],i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:20, background:"rgba(16,185,129,0.05)", border:"1px solid rgba(16,185,129,0.12)" }}>
                      <span style={{ fontSize:11 }}>{icon}</span>
                      <span style={{ fontSize:10, color:"rgba(16,185,129,0.7)", fontFamily:"monospace" }}>{text}</span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:12 }}>

                  {/* CPF */}
                  <div style={fade(170)}>
                    <label style={{ display:"block", fontSize:11, color:"rgba(255,255,255,0.35)", marginBottom:6, fontFamily:"monospace", letterSpacing:"0.06em" }}>CPF DO RESPONSÁVEL</label>
                    <div style={{ position:"relative" }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={e => { setCpf(maskCpf(e.target.value)); setError(""); }}
                        maxLength={14}
                        required
                        style={{
                          width:"100%", background:"rgba(10,15,24,0.8)",
                          border:`1px solid ${cpfIsValid ? "rgba(16,185,129,0.5)" : cpfTyping ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.07)"}`,
                          borderRadius:10, padding:"12px 44px 12px 16px", fontSize:14,
                          color:"rgba(255,255,255,0.85)", outline:"none",
                          fontFamily:"'Syne',system-ui", letterSpacing:"0.04em",
                          transition:"border-color 0.2s, box-shadow 0.2s",
                          boxShadow: cpfIsValid ? "0 0 0 3px rgba(16,185,129,0.08)" : "none",
                        }}
                        onFocus={e => { if (!cpfIsValid) { e.currentTarget.style.borderColor="rgba(16,185,129,0.4)"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(16,185,129,0.06)"; }}}
                        onBlur={e  => { if (!cpfIsValid) { e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow="none"; }}}
                      />
                      <div style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", fontSize:14 }}>
                        {cpfIsValid ? <span style={{ color:"#34d399" }}>✓</span> : cpfTyping ? <span style={{ color:"#fbbf24", fontSize:10 }}>...</span> : null}
                      </div>
                    </div>
                    <p style={{ fontSize:10, color:"rgba(255,255,255,0.18)", margin:"5px 0 0", fontFamily:"monospace" }}>Armazenado criptografado — apenas os 2 últimos dígitos são exibidos publicamente</p>
                  </div>

                  {/* DATA NASCIMENTO */}
                  <div style={fade(210)}>
                    <label style={{ display:"block", fontSize:11, color:"rgba(255,255,255,0.35)", marginBottom:6, fontFamily:"monospace", letterSpacing:"0.06em" }}>DATA DE NASCIMENTO</label>
                    <input
                      type="date"
                      value={dataNascimento}
                      onChange={e => { setDataNascimento(e.target.value); setError(""); }}
                      required
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 16)).toISOString().split("T")[0]}
                      min="1900-01-01"
                      style={{
                        width:"100%", background:"rgba(10,15,24,0.8)",
                        border:`1px solid ${dataNascimento ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.07)"}`,
                        borderRadius:10, padding:"12px 16px", fontSize:13,
                        color: dataNascimento ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)",
                        outline:"none", fontFamily:"'Syne',system-ui", colorScheme:"dark",
                        transition:"border-color 0.2s",
                        boxShadow: dataNascimento ? "0 0 0 3px rgba(16,185,129,0.06)" : "none",
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor="rgba(16,185,129,0.4)"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(16,185,129,0.06)"; }}
                      onBlur={e  => { if (!dataNascimento) { e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow="none"; }}}
                    />
                  </div>

                  {/* ERRO */}
                  {error && (
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"10px 14px", borderRadius:10, background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.2)" }}>
                      <span style={{ color:"#f87171", fontSize:12, flexShrink:0 }}>✕</span>
                      <p style={{ color:"rgba(248,113,113,0.85)", fontSize:12, margin:0, lineHeight:1.6 }}>{error}</p>
                    </div>
                  )}

                  {/* BOTÃO */}
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    style={{
                      ...fade(260),
                      width:"100%", marginTop:4, padding:"13px 0", borderRadius:10,
                      border:"1px solid rgba(16,185,129,0.35)",
                      background: canSubmit ? "linear-gradient(135deg,rgba(16,185,129,0.18),rgba(16,185,129,0.08))" : "rgba(16,185,129,0.03)",
                      color:      canSubmit ? "#34d399" : "rgba(52,211,153,0.3)",
                      fontSize:13, fontWeight:700, cursor: canSubmit ? "pointer" : "not-allowed",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                      transition:"all 0.2s", fontFamily:"'Syne',system-ui", letterSpacing:"0.03em",
                      boxShadow: canSubmit ? "0 0 24px rgba(16,185,129,0.1)" : "none",
                    }}
                    onMouseEnter={e => { if (canSubmit) { (e.currentTarget as HTMLButtonElement).style.boxShadow="0 0 36px rgba(16,185,129,0.2)"; (e.currentTarget as HTMLButtonElement).style.borderColor="rgba(16,185,129,0.6)"; }}}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow="0 0 24px rgba(16,185,129,0.1)"; (e.currentTarget as HTMLButtonElement).style.borderColor="rgba(16,185,129,0.35)"; }}
                  >
                    {loading
                      ? <><div style={{ width:14, height:14, borderRadius:"50%", border:"1.5px solid rgba(52,211,153,0.3)", borderTopColor:"#34d399", animation:"spin 0.7s linear infinite" }} /><span>Verificando...</span></>
                      : <><span style={{ fontSize:12 }}>✦</span><span>Confirmar identidade</span></>
                    }
                  </button>

                  <p style={{ ...fade(300), fontSize:10, color:"rgba(255,255,255,0.14)", textAlign:"center", margin:"4px 0 0", lineHeight:1.6, fontFamily:"monospace" }}>
                    Dados protegidos pela LGPD · Apenas os 2 últimos dígitos do CPF são exibidos publicamente · NexaSpark © {new Date().getFullYear()}
                  </p>

                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}