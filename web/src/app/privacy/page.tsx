"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark
// ============================================================
const LOG_PREFIX = "[NexaSpark]";
const logger = {
  info:  (scope: string, msg: string) => console.log(`%c${LOG_PREFIX} ℹ️  [${scope}]%c ${msg}`, "color:#60a5fa;font-weight:bold;", "color:inherit;"),
  mount: (c: string) => console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}> renderizado`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) => console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}> destruído`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
  event: (scope: string, action: string) => console.log(`%c${LOG_PREFIX} 🎯 [${scope}]%c ACTION → ${action}`, "color:#f472b6;font-weight:bold;", "color:inherit;"),
};

// ============================================================
// 📄 SEÇÃO REUTILIZÁVEL
// ============================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-12">
      <h2 className="text-xl font-semibold text-white mb-4 pb-3 border-b border-white/[0.06]">
        {title}
      </h2>
      <div className="text-gray-400 text-sm leading-relaxed space-y-3">
        {children}
      </div>
    </div>
  );
}

// ============================================================
// 🔒 POLÍTICA DE PRIVACIDADE
// ============================================================
export default function Privacy() {
  const router = useRouter();

  useEffect(() => {
    logger.mount("Privacy");
    logger.info("PAGE", "Política de Privacidade carregada");
    logger.info("LGPD", "Página de privacidade acessada — conformidade LGPD registrada");
    return () => logger.unmount("Privacy");
  }, []);

  function goBack() {
    logger.event("NAV", "Usuário voltou da página de Privacidade");
    router.push("/");
  }

  const lastUpdate = "02 de maio de 2025";
  const company    = "NexaSpark";
  const email      = "contato@nexaspark.com.br";
  const whatsapp   = "+55 19 98271-4815";

  return (
    <div className="min-h-screen bg-black text-white">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-4 border-b border-white/[0.06] bg-black/80 backdrop-blur-md">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Voltar
        </button>
        <p className="text-sm font-semibold text-white tracking-tight">{company}</p>
        <div className="w-16" />
      </nav>

      {/* CONTEÚDO */}
      <main className="max-w-3xl mx-auto px-6 md:px-8 pt-28 pb-24">

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* HEADER */}
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-medium mb-4">Legal</p>
            <h1 className="text-3xl md:text-4xl font-semibold mb-4">Política de Privacidade</h1>
            <p className="text-gray-500 text-sm">Última atualização: {lastUpdate}</p>
            <p className="text-gray-400 text-sm mt-4 leading-relaxed max-w-xl">
              Esta Política de Privacidade descreve como a <strong className="text-white">{company}</strong> coleta,
              usa, armazena e protege os dados pessoais dos usuários, em conformidade com a
              <strong className="text-white"> Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>.
            </p>
          </div>

          {/* 1 */}
          <Section title="1. Quem somos">
            <p>
              A <strong className="text-white">{company}</strong> é uma plataforma de certificação digital voltada para
              instituições de ensino e plataformas EAD. Somos responsáveis pelo tratamento dos dados
              pessoais coletados por meio de nosso sistema.
            </p>
            <p>
              Para dúvidas sobre esta política ou sobre o tratamento dos seus dados, entre em contato:
            </p>
            <ul className="list-none pl-0 space-y-1 mt-2">
              <li>📧 <strong className="text-white">E-mail:</strong> {email}</li>
              <li>📱 <strong className="text-white">WhatsApp:</strong> {whatsapp}</li>
            </ul>
          </Section>

          {/* 2 */}
          <Section title="2. Quais dados coletamos">
            <p>Coletamos apenas os dados estritamente necessários para o funcionamento da plataforma:</p>
            <div className="mt-3 space-y-2">
              {[
                { cat: "Dados de cadastro", desc: "Nome completo, e-mail institucional, nome da instituição e telefone de contato." },
                { cat: "Dados de acesso", desc: "Endereço IP, tipo de navegador, sistema operacional, data e hora de acesso (logs de segurança)." },
                { cat: "Dados dos certificados", desc: "Nome do aluno, título do curso, data de conclusão, identificador único (ID) e hash criptográfico." },
                { cat: "Dados de comunicação", desc: "Mensagens enviadas por WhatsApp ou e-mail para atendimento." },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-emerald-400 text-xs mt-0.5 flex-shrink-0">●</span>
                  <div>
                    <p className="text-white text-xs font-medium mb-0.5">{item.cat}</p>
                    <p className="text-gray-400 text-xs">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-gray-500 text-xs">
              Não coletamos dados sensíveis como CPF, dados bancários, biometria ou informações de saúde.
            </p>
          </Section>

          {/* 3 */}
          <Section title="3. Como usamos seus dados">
            <p>Seus dados são utilizados exclusivamente para:</p>
            <ul className="space-y-2 mt-2">
              {[
                "Criar e gerenciar sua conta na plataforma",
                "Emitir, armazenar e validar certificados digitais",
                "Garantir a segurança e integridade das operações",
                "Enviar comunicações sobre sua conta ou certificados",
                "Cumprir obrigações legais e regulatórias",
                "Prevenir fraudes e uso indevido da plataforma",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-emerald-400 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/30 text-xs text-emerald-300">
              Não vendemos, alugamos nem compartilhamos seus dados com terceiros para fins comerciais.
            </p>
          </Section>

          {/* 4 */}
          <Section title="4. Base legal para tratamento (LGPD)">
            <p>
              O tratamento dos seus dados é fundamentado nas seguintes bases legais previstas
              no Art. 7º da LGPD:
            </p>
            <div className="mt-3 space-y-2">
              {[
                { base: "Execução de contrato (Art. 7º, V)", desc: "Para prestação dos serviços contratados pela instituição." },
                { base: "Legítimo interesse (Art. 7º, IX)", desc: "Para segurança da plataforma e prevenção de fraudes." },
                { base: "Cumprimento de obrigação legal (Art. 7º, II)", desc: "Para atendimento de exigências regulatórias e fiscais." },
                { base: "Consentimento (Art. 7º, I)", desc: "Para comunicações de marketing e novidades (quando aplicável)." },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-white text-xs font-medium mb-0.5">{item.base}</p>
                  <p className="text-gray-400 text-xs">{item.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* 5 */}
          <Section title="5. Compartilhamento de dados">
            <p>
              Seus dados podem ser compartilhados apenas nas seguintes situações:
            </p>
            <ul className="space-y-2 mt-2">
              {[
                "Com prestadores de serviços de infraestrutura (hospedagem, banco de dados) sob contrato de confidencialidade",
                "Com autoridades competentes quando exigido por lei ou ordem judicial",
                "Com a própria instituição contratante, no que se refere aos dados dos certificados emitidos por ela",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-emerald-400 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* 6 */}
          <Section title="6. Armazenamento e segurança">
            <p>
              Os dados são armazenados em servidores com as seguintes proteções:
            </p>
            <ul className="space-y-2 mt-2">
              {[
                "Criptografia em trânsito via TLS/HTTPS",
                "Hash SHA-256 para integridade dos certificados",
                "Autenticação JWT com expiração de sessão",
                "Backups regulares com retenção controlada",
                "Acesso restrito por funções (RBAC)",
                "Monitoramento de logs e alertas de segurança 24/7",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-emerald-400 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* 7 */}
          <Section title="7. Por quanto tempo guardamos seus dados">
            <p>
              Os dados são retidos pelos seguintes prazos:
            </p>
            <div className="mt-3 space-y-2">
              {[
                { tipo: "Dados de cadastro",     prazo: "Pelo período do contrato + 5 anos (obrigação fiscal)" },
                { tipo: "Dados dos certificados", prazo: "Indefinidamente (necessário para validação histórica)" },
                { tipo: "Logs de acesso",         prazo: "12 meses" },
                { tipo: "Dados de comunicação",   prazo: "24 meses a partir do último contato" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-white text-xs font-medium">{item.tipo}</p>
                  <p className="text-gray-400 text-xs text-right max-w-[200px]">{item.prazo}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* 8 */}
          <Section title="8. Seus direitos como titular (LGPD Art. 18)">
            <p>
              De acordo com a LGPD, você tem os seguintes direitos sobre seus dados:
            </p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { dir: "Acesso", desc: "Solicitar confirmação de quais dados temos sobre você" },
                { dir: "Correção", desc: "Corrigir dados incompletos, inexatos ou desatualizados" },
                { dir: "Anonimização", desc: "Solicitar anonimização de dados desnecessários" },
                { dir: "Portabilidade", desc: "Receber seus dados em formato estruturado" },
                { dir: "Eliminação", desc: "Solicitar exclusão de dados tratados com consentimento" },
                { dir: "Revogação", desc: "Retirar consentimento a qualquer momento" },
                { dir: "Oposição", desc: "Opor-se a tratamento em desacordo com a lei" },
                { dir: "Informação", desc: "Saber com quem seus dados foram compartilhados" },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-emerald-400 text-xs font-medium mb-0.5">{item.dir}</p>
                  <p className="text-gray-400 text-xs">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm">
              Para exercer qualquer direito, entre em contato por <strong className="text-white">{email}</strong> ou{" "}
              <strong className="text-white">{whatsapp}</strong>. Respondemos em até <strong className="text-white">15 dias úteis</strong>.
            </p>
          </Section>

          {/* 9 */}
          <Section title="9. Cookies e rastreamento">
            <p>
              Utilizamos cookies essenciais para o funcionamento da plataforma (autenticação de sessão).
              Não utilizamos cookies de rastreamento, publicidade ou analytics de terceiros.
            </p>
            <p>
              Você pode configurar seu navegador para recusar cookies, porém isso pode impactar
              o funcionamento do painel da plataforma.
            </p>
          </Section>

          {/* 10 */}
          <Section title="10. Transferência internacional de dados">
            <p>
              Alguns de nossos provedores de infraestrutura podem estar localizados fora do Brasil.
              Nestes casos, garantimos que as transferências ocorrem apenas para países com
              nível adequado de proteção ou mediante cláusulas contratuais específicas,
              conforme Art. 33 da LGPD.
            </p>
          </Section>

          {/* 11 */}
          <Section title="11. Alterações nesta política">
            <p>
              Esta política pode ser atualizada periodicamente. Notificaremos os usuários sobre
              mudanças significativas por e-mail ou aviso na plataforma com pelo menos{" "}
              <strong className="text-white">15 dias de antecedência</strong>.
            </p>
            <p>
              O uso continuado da plataforma após as alterações implica aceitação da nova política.
            </p>
          </Section>

          {/* 12 */}
          <Section title="12. Encarregado de Dados (DPO)">
            <p>
              Nos termos do Art. 41 da LGPD, o encarregado pelo tratamento de dados pessoais
              da <strong className="text-white">{company}</strong> pode ser contatado por:
            </p>
            <ul className="space-y-1 mt-2">
              <li>📧 {email}</li>
              <li>📱 {whatsapp}</li>
            </ul>
          </Section>

          {/* FOOTER DA PÁGINA */}
          <div className="mt-16 pt-8 border-t border-white/[0.06]">
            <p className="text-gray-600 text-xs text-center">
              © {new Date().getFullYear()} {company} — Esta política é regida pela legislação brasileira,
              em especial a LGPD (Lei nº 13.709/2018).
            </p>
            <div className="flex justify-center mt-6">
              <button
                onClick={goBack}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                ← Voltar para a página inicial
              </button>
            </div>
          </div>

        </motion.div>
      </main>
    </div>
  );
}
