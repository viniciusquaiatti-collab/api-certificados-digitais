"use client";

// ============================================================
// 🔒 NexaSpark — /privacy/page.tsx
// Política de Privacidade — Enterprise SaaS Premium
//
// PADRÃO: Stripe / Linear / Vercel
// TOM: autoridade institucional + segurança enterprise
// ESTRUTURA: hero premium + cards + hierarquia tipográfica
// ============================================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion }    from "framer-motion";

const LOG_PREFIX = "[NexaSpark:Privacy]";
const logger = {
  mount:   (c: string) => console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}> renderizado`,   "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) => console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}> destruído`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
  info:    (scope: string, msg: string) => console.log(`%c${LOG_PREFIX} ℹ️  [${scope}]%c ${msg}`, "color:#60a5fa;font-weight:bold;", "color:inherit;"),
  event:   (scope: string, action: string) => console.log(`%c${LOG_PREFIX} 🎯 [${scope}]%c ${action}`, "color:#f472b6;font-weight:bold;", "color:inherit;"),
};

const COMPANY   = "NexaSpark";
const EMAIL     = "contato@nexaspark.com.br";
const WHATSAPP  = "+55 19 98271-4815";
const LAST_REV  = "02 de maio de 2025";

// ── Componente de seção com número e título premium ──────────
function PolicySection({
  n, title, children,
}: { n: string; title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ marginBottom: 56 }}
    >
      {/* Número + título */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 24 }}>
        <span style={{
          fontSize:      11,
          fontFamily:    "monospace",
          color:         "rgba(16,185,129,0.45)",
          letterSpacing: "0.15em",
          flexShrink:    0,
        }}>
          {n.padStart(2, "0")}
        </span>
        <h2 style={{
          fontSize:      "clamp(16px, 2vw, 20px)",
          fontWeight:    600,
          color:         "rgba(255,255,255,0.90)",
          letterSpacing: "-0.01em",
          lineHeight:    1.2,
          margin:        0,
          paddingBottom: 20,
          borderBottom:  "1px solid rgba(255,255,255,0.06)",
          width:         "100%",
        }}>
          {title}
        </h2>
      </div>
      <div style={{ paddingLeft: 28 }}>
        {children}
      </div>
    </motion.div>
  );
}

// ── Card de dado/feature ─────────────────────────────────────
function DataCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      display:      "flex",
      gap:          12,
      padding:      "14px 16px",
      borderRadius: 10,
      background:   accent ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)",
      border:       `1px solid ${accent ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)"}`,
    }}>
      <span style={{
        width:         6,
        height:        6,
        borderRadius:  "50%",
        background:    "rgba(16,185,129,0.6)",
        flexShrink:    0,
        marginTop:     5,
      }} />
      <div>
        <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.75)", marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.55 }}>{value}</p>
      </div>
    </div>
  );
}

// ── Item de lista premium ────────────────────────────────────
function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
      <span style={{
        fontSize:   9,
        color:      "rgba(16,185,129,0.7)",
        marginTop:  4,
        flexShrink: 0,
        fontFamily: "monospace",
      }}>◆</span>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

// ── Highlight box ────────────────────────────────────────────
function HighlightBox({ children, variant = "green" }: { children: React.ReactNode; variant?: "green" | "neutral" }) {
  const isGreen = variant === "green";
  return (
    <div style={{
      padding:      "14px 18px",
      borderRadius: 10,
      background:   isGreen ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.02)",
      border:       `1px solid ${isGreen ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)"}`,
      marginTop:    16,
    }}>
      <p style={{ fontSize: 13, color: isGreen ? "rgba(16,185,129,0.8)" : "rgba(255,255,255,0.35)", lineHeight: 1.65, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

// ── Body text ────────────────────────────────────────────────
const T = {
  body: (text: React.ReactNode) => (
    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.75, marginBottom: 14 }}>
      {text}
    </p>
  ),
  strong: (text: string) => (
    <strong style={{ color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{text}</strong>
  ),
};

// ============================================================
// 🔒 PÁGINA PRINCIPAL
// ============================================================
export default function Privacy() {
  const router = useRouter();

  useEffect(() => {
    logger.mount("Privacy");
    logger.info("PAGE",  "Política de Privacidade — enterprise premium carregada");
    logger.info("LGPD",  "Conformidade LGPD — página de privacidade acessada");
    logger.info("TRUST", "Trust layer ativo — percepção de segurança institucional");
    return () => logger.unmount("Privacy");
  }, []);

  function goBack() {
    logger.event("NAV", "Usuário retornou da Política de Privacidade → Home");
    router.push("/");
  }

  return (
    <div style={{
      minHeight:  "100vh",
      background: "#030508",
      color:      "white",
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}>

      {/* ── CSS Global ── */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.2); border-radius: 2px; }
        ::selection { background: rgba(16,185,129,0.25); }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position:       "fixed",
        top:            0,
        left:           0,
        right:          0,
        zIndex:         50,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "16px 40px",
        borderBottom:   "1px solid rgba(255,255,255,0.05)",
        background:     "rgba(3,5,8,0.85)",
        backdropFilter: "blur(20px)",
      }}>
        <button
          onClick={goBack}
          style={{
            display:     "flex",
            alignItems:  "center",
            gap:         8,
            fontSize:    13,
            color:       "rgba(255,255,255,0.4)",
            background:  "none",
            border:      "none",
            cursor:      "pointer",
            transition:  "color 0.2s",
            fontFamily:  "inherit",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Voltar
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width:      7, height: 7, borderRadius: "50%",
            background: "#10b981",
            boxShadow:  "0 0 8px rgba(16,185,129,0.6)",
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.01em" }}>
            {COMPANY}
          </span>
        </div>

        <div style={{ width: 80 }} />
      </nav>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "120px 40px 96px" }}>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >

          {/* ══════════════════════════════════════════════════
              HERO — Posicionamento enterprise premium
          ══════════════════════════════════════════════════ */}
          <div style={{ marginBottom: 80 }}>

            <p style={{
              fontSize:      10,
              letterSpacing: "0.25em",
              color:         "rgba(16,185,129,0.6)",
              fontFamily:    "monospace",
              textTransform: "uppercase",
              marginBottom:  20,
            }}>
              Privacidade e Segurança de Dados
            </p>

            <h1 style={{
              fontSize:      "clamp(28px, 4vw, 42px)",
              fontWeight:    700,
              lineHeight:    1.08,
              letterSpacing: "-0.025em",
              marginBottom:  20,
              color:         "rgba(255,255,255,0.95)",
            }}>
              Proteção institucional com autenticação digital de{" "}
              <span style={{ color: "#10b981" }}>padrão enterprise.</span>
            </h1>

            <p style={{
              fontSize:   15,
              color:      "rgba(255,255,255,0.38)",
              lineHeight: 1.75,
              maxWidth:   580,
              marginBottom: 28,
            }}>
              A {COMPANY} foi desenvolvida com foco em segurança institucional,
              proteção criptográfica e conformidade com a LGPD —
              para instituições que levam credibilidade acadêmica a sério.
            </p>

            {/* Meta info */}
            <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
                Última revisão de segurança e conformidade: {LAST_REV}
              </span>
              <span style={{
                fontSize:      10,
                letterSpacing: "0.15em",
                color:         "rgba(16,185,129,0.5)",
                fontFamily:    "monospace",
                textTransform: "uppercase",
              }}>
                LGPD — Lei nº 13.709/2018
              </span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              BLOCO DE COMPROMISSO — Antes das seções
          ══════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{
              padding:      "28px 32px",
              borderRadius: 16,
              background:   "rgba(16,185,129,0.04)",
              border:       "1px solid rgba(16,185,129,0.12)",
              marginBottom: 72,
            }}
          >
            <p style={{
              fontSize:      10,
              letterSpacing: "0.2em",
              color:         "rgba(16,185,129,0.5)",
              fontFamily:    "monospace",
              textTransform: "uppercase",
              marginBottom:  16,
            }}>
              Nosso compromisso com segurança
            </p>
            <p style={{
              fontSize:   14,
              color:      "rgba(255,255,255,0.55)",
              lineHeight: 1.75,
              marginBottom: 24,
            }}>
              Segurança e autenticidade não são recursos opcionais. São a base da {COMPANY}.
              Nossa infraestrutura adota práticas modernas de proteção para garantir
              a integridade das emissões digitais e a confiança institucional de nossos clientes.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {[
                "Criptografia TLS ponta a ponta",
                "Hash SHA-256 por certificado",
                "Controle de acesso RBAC",
                "Tokens JWT autenticados",
                "Logs auditáveis em tempo real",
                "Monitoramento contínuo 24/7",
                "Backups redundantes",
                "Proteção antifraude ativa",
              ].map((item, i) => (
                <div key={i} style={{
                  display:     "flex",
                  alignItems:  "center",
                  gap:         8,
                  padding:     "8px 10px",
                  borderRadius: 8,
                  background:  "rgba(255,255,255,0.02)",
                  border:      "1px solid rgba(255,255,255,0.05)",
                }}>
                  <span style={{ color: "#10b981", fontSize: 9 }}>✓</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════════
              SEÇÕES DA POLÍTICA
          ══════════════════════════════════════════════════ */}

          <PolicySection n="1" title="Quem somos">
            {T.body(
              <>{T.strong(COMPANY)} é uma plataforma SaaS de certificação digital desenvolvida
              para instituições de ensino, universidades e operações EAD que exigem
              segurança, autenticidade e rastreabilidade em suas emissões acadêmicas.
              Somos o controlador dos dados pessoais tratados por meio de nossa plataforma.</>
            )}
            <HighlightBox variant="neutral">
              Para dúvidas sobre esta política ou sobre o tratamento dos seus dados:{" "}
              <span style={{ color: "rgba(16,185,129,0.8)" }}>{EMAIL}</span>
              {" "}·{" "}
              <span style={{ color: "rgba(16,185,129,0.8)" }}>{WHATSAPP}</span>
            </HighlightBox>
          </PolicySection>

          <PolicySection n="2" title="Dados que coletamos">
            {T.body("Coletamos apenas os dados estritamente necessários para operação segura da plataforma, autenticação das emissões digitais e proteção da integridade institucional dos certificados emitidos.")}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              <DataCard label="Dados de cadastro" value="Nome completo, e-mail institucional, nome da instituição e telefone de contato." />
              <DataCard label="Dados de acesso" value="Endereço IP, tipo de navegador, sistema operacional, data e hora de acesso (logs de segurança)." />
              <DataCard label="Dados dos certificados" value="Nome do destinatário, título do curso, data de conclusão, identificador único (ID) e hash criptográfico." />
              <DataCard label="Dados de comunicação" value="Mensagens enviadas por WhatsApp ou e-mail para atendimento e suporte." />
            </div>
            <HighlightBox>
              Coletamos apenas os dados necessários. Informações sensíveis como documentos de identidade,
              dados bancários ou biometria não fazem parte do escopo da plataforma.
            </HighlightBox>
          </PolicySection>

          <PolicySection n="3" title="Como utilizamos seus dados">
            {T.body("Utilizamos os dados exclusivamente para operação segura da plataforma, autenticação das emissões digitais e proteção da integridade institucional dos certificados emitidos.")}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Criar e gerenciar sua conta institucional na plataforma",
                "Emitir, armazenar e validar certificados digitais com rastreabilidade completa",
                "Garantir a segurança, integridade e autenticidade das operações",
                "Enviar comunicações sobre sua conta, certificados ou atualizações da plataforma",
                "Cumprir obrigações legais, regulatórias e contratuais",
                "Prevenir fraudes, uso indevido e acesso não autorizado à plataforma",
              ].map((item, i) => <ListItem key={i}>{item}</ListItem>)}
            </div>
            <HighlightBox>
              Não vendemos, alugamos nem compartilhamos seus dados com terceiros para fins
              comerciais ou publicitários. Nunca.
            </HighlightBox>
          </PolicySection>

          <PolicySection n="4" title="Base legal para tratamento (LGPD — Art. 7º)">
            {T.body("O tratamento dos seus dados é fundamentado nas seguintes bases legais:")}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <DataCard label="Execução de contrato — Art. 7º, V" value="Para prestação dos serviços contratados pela instituição." />
              <DataCard label="Legítimo interesse — Art. 7º, IX"  value="Para segurança da plataforma e prevenção de fraudes." />
              <DataCard label="Obrigação legal — Art. 7º, II"     value="Para atendimento de exigências regulatórias e fiscais." />
              <DataCard label="Consentimento — Art. 7º, I"        value="Para comunicações de marketing e novidades, quando aplicável." />
            </div>
          </PolicySection>

          <PolicySection n="5" title="Compartilhamento de dados">
            {T.body("Seus dados são compartilhados apenas nas situações estritamente necessárias para operação da plataforma:")}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Com provedores de infraestrutura (hospedagem, banco de dados) sob contrato de confidencialidade e cláusulas de proteção de dados",
                "Com autoridades competentes quando exigido por lei, ordem judicial ou regulamentação aplicável",
                "Com a instituição contratante, no que se refere exclusivamente aos dados dos certificados por ela emitidos",
              ].map((item, i) => <ListItem key={i}>{item}</ListItem>)}
            </div>
          </PolicySection>

          <PolicySection n="6" title="Armazenamento e segurança">
            {T.body("Toda comunicação com a plataforma é protegida por criptografia TLS de ponta a ponta, autenticação segura de sessão e mecanismos avançados de integridade digital. Nossa infraestrutura opera com:")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
              {[
                { label: "Criptografia em trânsito",   value: "TLS/HTTPS em todas as requisições" },
                { label: "Integridade dos certificados", value: "Hash SHA-256 por emissão" },
                { label: "Autenticação de sessão",     value: "JWT com expiração controlada" },
                { label: "Controle de acesso",         value: "RBAC por função e permissão" },
                { label: "Auditoria e logs",           value: "Monitoramento 24/7 com alertas" },
                { label: "Continuidade de dados",      value: "Backups regulares com retenção controlada" },
              ].map((item, i) => (
                <DataCard key={i} label={item.label} value={item.value} />
              ))}
            </div>
          </PolicySection>

          <PolicySection n="7" title="Retenção de dados">
            {T.body("Os dados são retidos pelos prazos mínimos necessários à operação segura e ao cumprimento de obrigações legais:")}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { tipo: "Dados de cadastro",      prazo: "Período do contrato + 5 anos (obrigação fiscal)" },
                { tipo: "Dados dos certificados", prazo: "Indefinido — necessário para validação histórica e integridade" },
                { tipo: "Logs de acesso",         prazo: "12 meses" },
                { tipo: "Dados de comunicação",   prazo: "24 meses a partir do último contato" },
              ].map((item, i) => (
                <div key={i} style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  gap:            16,
                  padding:        "12px 16px",
                  borderRadius:   10,
                  background:     "rgba(255,255,255,0.02)",
                  border:         "1px solid rgba(255,255,255,0.05)",
                  flexWrap:       "wrap",
                }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.65)" }}>{item.tipo}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: "monospace", textAlign: "right" }}>{item.prazo}</p>
                </div>
              ))}
            </div>
          </PolicySection>

          <PolicySection n="8" title="Seus direitos como titular — LGPD Art. 18">
            {T.body("Como titular dos dados, você possui os seguintes direitos garantidos pela LGPD, exercíveis a qualquer momento:")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
              {[
                { dir: "Acesso",         desc: "Confirmar quais dados tratamos sobre você" },
                { dir: "Correção",       desc: "Corrigir dados incompletos ou desatualizados" },
                { dir: "Eliminação",     desc: "Solicitar exclusão de dados desnecessários" },
                { dir: "Portabilidade",  desc: "Receber seus dados em formato estruturado" },
                { dir: "Anonimização",   desc: "Solicitar anonimização quando possível" },
                { dir: "Revogação",      desc: "Retirar consentimento a qualquer momento" },
                { dir: "Oposição",       desc: "Opor-se a tratamento irregular" },
                { dir: "Informação",     desc: "Saber com quem seus dados foram compartilhados" },
              ].map((item, i) => (
                <div key={i} style={{
                  padding:      "12px 14px",
                  borderRadius: 10,
                  background:   "rgba(255,255,255,0.02)",
                  border:       "1px solid rgba(255,255,255,0.05)",
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(16,185,129,0.75)", marginBottom: 4 }}>{item.dir}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
            </div>
            <HighlightBox>
              Para exercer qualquer direito, entre em contato por{" "}
              <span style={{ color: "rgba(16,185,129,0.8)" }}>{EMAIL}</span> ou{" "}
              <span style={{ color: "rgba(16,185,129,0.8)" }}>{WHATSAPP}</span>.
              Respondemos em até <strong style={{ color: "rgba(255,255,255,0.7)" }}>15 dias úteis</strong>.
            </HighlightBox>
          </PolicySection>

          <PolicySection n="9" title="Cookies e rastreamento">
            {T.body("Utilizamos apenas cookies essenciais para funcionamento da plataforma — autenticação de sessão e preferências de acesso. Não utilizamos cookies de rastreamento, publicidade ou analytics de terceiros.")}
            {T.body("Você pode configurar seu navegador para recusar cookies, porém isso pode impactar o funcionamento do painel institucional.")}
          </PolicySection>

          <PolicySection n="10" title="Transferência internacional de dados">
            {T.body("Alguns de nossos provedores de infraestrutura podem estar localizados fora do Brasil. Nestes casos, garantimos que as transferências ocorrem exclusivamente para países com nível adequado de proteção ou mediante cláusulas contratuais específicas, conforme Art. 33 da LGPD.")}
          </PolicySection>

          <PolicySection n="11" title="Alterações nesta política">
            {T.body(`Esta política é revisada periodicamente para refletir melhorias de segurança, conformidade e operação da plataforma. Notificaremos os usuários sobre mudanças significativas por e-mail ou aviso na plataforma com pelo menos 15 dias de antecedência.`)}
            <HighlightBox variant="neutral">
              O uso continuado da plataforma após as alterações implica ciência e aceitação da política atualizada.
            </HighlightBox>
          </PolicySection>

          <PolicySection n="12" title="Encarregado de Dados — DPO">
            {T.body(<>Nos termos do Art. 41 da LGPD, o encarregado pelo tratamento de dados pessoais da {T.strong(COMPANY)} pode ser contatado pelos canais abaixo. Todas as solicitações são tratadas com confidencialidade e respondidas dentro do prazo legal.</>)}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "E-mail institucional", value: EMAIL },
                { label: "WhatsApp",             value: WHATSAPP },
              ].map((item, i) => (
                <div key={i} style={{
                  padding:      "12px 20px",
                  borderRadius: 10,
                  background:   "rgba(16,185,129,0.04)",
                  border:       "1px solid rgba(16,185,129,0.1)",
                  flex:         1,
                  minWidth:     200,
                }}>
                  <p style={{ fontSize: 10, color: "rgba(16,185,129,0.5)", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 6, textTransform: "uppercase" }}>{item.label}</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{item.value}</p>
                </div>
              ))}
            </div>
          </PolicySection>

          {/* ── FOOTER DA PÁGINA ── */}
          <div style={{
            marginTop:    64,
            paddingTop:   32,
            borderTop:    "1px solid rgba(255,255,255,0.05)",
            textAlign:    "center",
          }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", marginBottom: 24, lineHeight: 1.6 }}>
              © {new Date().getFullYear()} {COMPANY} — Esta política é regida pela legislação brasileira,
              em especial a LGPD (Lei nº 13.709/2018).
            </p>
            <button
              onClick={goBack}
              style={{
                fontSize:    13,
                color:       "rgba(16,185,129,0.6)",
                background:  "none",
                border:      "none",
                cursor:      "pointer",
                fontFamily:  "inherit",
                transition:  "color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(16,185,129,1)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(16,185,129,0.6)")}
            >
              ← Voltar para a página inicial
            </button>
          </div>

        </motion.div>
      </main>
    </div>
  );
}