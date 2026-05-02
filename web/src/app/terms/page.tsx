"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark
// ============================================================
const LOG_PREFIX = "[NexaSpark]";
const logger = {
  info:    (scope: string, msg: string) => console.log(`%c${LOG_PREFIX} ℹ️  [${scope}]%c ${msg}`, "color:#60a5fa;font-weight:bold;", "color:inherit;"),
  mount:   (c: string) => console.log(`%c${LOG_PREFIX} 🔧 [MOUNT]%c <${c}> renderizado`, "color:#38bdf8;font-weight:bold;", "color:inherit;"),
  unmount: (c: string) => console.log(`%c${LOG_PREFIX} 🗑️  [UNMOUNT]%c <${c}> destruído`, "color:#94a3b8;font-weight:bold;", "color:inherit;"),
  event:   (scope: string, action: string) => console.log(`%c${LOG_PREFIX} 🎯 [${scope}]%c ACTION → ${action}`, "color:#f472b6;font-weight:bold;", "color:inherit;"),
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
// 📋 TERMOS DE USO
// ============================================================
export default function Terms() {
  const router = useRouter();

  useEffect(() => {
    logger.mount("Terms");
    logger.info("PAGE", "Termos de Uso carregados");
    logger.info("LEGAL", "Página de termos acessada — log jurídico registrado");
    return () => logger.unmount("Terms");
  }, []);

  function goBack() {
    logger.event("NAV", "Usuário voltou da página de Termos");
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
            <h1 className="text-3xl md:text-4xl font-semibold mb-4">Termos de Uso</h1>
            <p className="text-gray-500 text-sm">Última atualização: {lastUpdate}</p>
            <p className="text-gray-400 text-sm mt-4 leading-relaxed max-w-xl">
              Ao acessar ou utilizar a plataforma <strong className="text-white">{company}</strong>, você concorda
              integralmente com estes Termos de Uso. Leia com atenção antes de utilizar nossos serviços.
              Se não concordar com qualquer disposição, não utilize a plataforma.
            </p>
          </div>

          {/* 1 */}
          <Section title="1. Definições">
            <p>Para fins destes Termos, considera-se:</p>
            <div className="mt-3 space-y-2">
              {[
                { termo: "Plataforma",      def: "O sistema web NexaSpark, acessível via navegador, destinado à emissão e validação de certificados digitais." },
                { termo: "Instituição",     def: "A escola, plataforma EAD ou empresa contratante que utiliza os serviços da NexaSpark." },
                { termo: "Usuário",         def: "Qualquer pessoa que acesse a plataforma, seja como administrador da instituição ou como aluno verificador." },
                { termo: "Certificado",     def: "Documento digital emitido pela plataforma, com hash criptográfico e QR code, atestando a conclusão de um curso ou atividade." },
                { termo: "Painel",          def: "Área administrativa da plataforma, acessível exclusivamente pela instituição contratante." },
                { termo: "Hash SHA-256",    def: "Assinatura criptográfica única gerada para cada certificado, garantindo sua autenticidade e imutabilidade." },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-emerald-400 font-medium text-xs mt-0.5 flex-shrink-0 min-w-[100px]">{item.termo}</span>
                  <p className="text-gray-400 text-xs">{item.def}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* 2 */}
          <Section title="2. Aceitação dos Termos">
            <p>
              O uso da plataforma implica aceitação plena e irrevogável destes Termos de Uso,
              da Política de Privacidade e de quaisquer políticas complementares publicadas pela {company}.
            </p>
            <p>
              Estes Termos se aplicam a todos os usuários, incluindo administradores de
              instituições, alunos que acessam certificados e visitantes da plataforma.
            </p>
            <p className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/30 text-xs text-emerald-300">
              Para instituições contratantes, estes Termos complementam o contrato comercial
              firmado diretamente com a {company}.
            </p>
          </Section>

          {/* 3 */}
          <Section title="3. Descrição dos serviços">
            <p>A {company} oferece os seguintes serviços:</p>
            <ul className="space-y-2 mt-2">
              {[
                "Emissão de certificados digitais com identidade visual exclusiva da instituição contratante",
                "Geração automática de hash SHA-256 para cada certificado emitido",
                "Criação de QR code rastreável e link público de validação",
                "Painel web para gestão de cursos, alunos e certificados",
                "Emissão individual ou em lote",
                "Validação pública de certificados por terceiros (sem necessidade de cadastro)",
                "Relatórios e auditoria de emissões",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-emerald-400 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* 4 */}
          <Section title="4. Cadastro e acesso">
            <p>
              O acesso ao painel administrativo é restrito às instituições que firmaram contrato
              com a {company}. O cadastro é realizado mediante solicitação direta ao fundador
              da plataforma.
            </p>
            <p>
              Ao criar uma conta, a instituição responsabiliza-se por:
            </p>
            <ul className="space-y-2 mt-2">
              {[
                "Manter as credenciais de acesso em sigilo",
                "Não compartilhar o acesso ao painel com pessoas não autorizadas",
                "Notificar imediatamente a NexaSpark em caso de suspeita de acesso indevido",
                "Garantir a veracidade de todas as informações fornecidas no cadastro",
                "Manter seus dados cadastrais atualizados",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-emerald-400 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* 5 */}
          <Section title="5. Responsabilidades da instituição contratante">
            <p>
              A instituição contratante é integralmente responsável por:
            </p>
            <ul className="space-y-2 mt-2">
              {[
                "A veracidade das informações inseridas nos certificados (nome do aluno, curso, carga horária, data)",
                "A conformidade dos certificados emitidos com a legislação educacional aplicável",
                "O uso ético e legal da plataforma",
                "A obtenção de consentimento dos alunos para o tratamento de seus dados conforme a LGPD",
                "Não emitir certificados falsos, fraudulentos ou para atividades inexistentes",
                "O conteúdo da identidade visual configurada no painel (logo, cores, informações)",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-emerald-400 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 p-3 rounded-lg bg-red-950/30 border border-red-900/30 text-xs text-red-300">
              A {company} não se responsabiliza por certificados emitidos com informações incorretas,
              fraudulentas ou em desacordo com a legislação, sendo esta responsabilidade
              exclusiva da instituição contratante.
            </p>
          </Section>

          {/* 6 */}
          <Section title="6. Propriedade intelectual">
            <p>
              Todo o conteúdo da plataforma {company} — incluindo código-fonte, design, marca,
              logotipo, algoritmos, banco de dados e documentação — é de propriedade exclusiva
              da {company} e protegido pela legislação de propriedade intelectual brasileira
              (Lei nº 9.279/1996 e Lei nº 9.610/1998).
            </p>
            <p>
              É <strong className="text-white">expressamente proibido</strong>:
            </p>
            <ul className="space-y-2 mt-2">
              {[
                "Copiar, reproduzir ou distribuir qualquer parte da plataforma sem autorização",
                "Fazer engenharia reversa do sistema",
                "Usar a marca NexaSpark sem autorização expressa",
                "Criar sistemas concorrentes baseados nos serviços da plataforma",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-red-400 flex-shrink-0">✕</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3">
              A identidade visual configurada pela instituição (logo, nome) permanece de
              propriedade da própria instituição.
            </p>
          </Section>

          {/* 7 */}
          <Section title="7. Uso proibido">
            <p>
              É vedado utilizar a plataforma para:
            </p>
            <ul className="space-y-2 mt-2">
              {[
                "Emitir certificados falsos ou fraudulentos",
                "Violar direitos de terceiros",
                "Praticar qualquer ato ilegal conforme a legislação brasileira",
                "Tentar comprometer a segurança ou integridade da plataforma",
                "Realizar ataques de força bruta, injeção de código ou qualquer forma de hacking",
                "Usar a plataforma para fins não relacionados à certificação educacional",
                "Revender ou sublicenciar o acesso à plataforma sem autorização",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-red-400 flex-shrink-0">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* 8 */}
          <Section title="8. Disponibilidade e SLA">
            <p>
              A {company} se compromete a manter a plataforma disponível com{" "}
              <strong className="text-white">99.9% de uptime mensal</strong>, exceto em casos de:
            </p>
            <ul className="space-y-2 mt-2">
              {[
                "Manutenções programadas (comunicadas com antecedência mínima de 48 horas)",
                "Eventos de força maior (desastres naturais, falhas de infraestrutura de terceiros)",
                "Ataques cibernéticos que exijam intervenção imediata",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-gray-500 flex-shrink-0">–</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3">
              Incidentes de disponibilidade serão comunicados por e-mail e/ou WhatsApp.
              O histórico de uptime pode ser solicitado ao suporte.
            </p>
          </Section>

          {/* 9 */}
          <Section title="9. Limitação de responsabilidade">
            <p>
              A {company} não se responsabiliza por:
            </p>
            <ul className="space-y-2 mt-2">
              {[
                "Danos causados pelo uso indevido da plataforma pela instituição ou seus usuários",
                "Perda de dados causada por ação ou omissão da própria instituição",
                "Decisões tomadas por terceiros com base nos certificados emitidos",
                "Interrupções decorrentes de fatores externos (provedores de internet, energia elétrica)",
                "Danos indiretos, lucros cessantes ou perdas consequentes",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-gray-500 flex-shrink-0">–</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3">
              A responsabilidade máxima da {company} em qualquer circunstância fica limitada
              ao valor pago pela instituição no mês em que ocorreu o incidente.
            </p>
          </Section>

          {/* 10 */}
          <Section title="10. Cancelamento e rescisão">
            <p>
              O contrato pode ser encerrado:
            </p>
            <div className="mt-3 space-y-2">
              {[
                { tipo: "Pela instituição", desc: "A qualquer momento, mediante comunicação com 30 dias de antecedência via e-mail ou WhatsApp." },
                { tipo: "Pela NexaSpark",   desc: "Imediatamente, em caso de violação dos Termos de Uso, uso fraudulento ou inadimplência." },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-white text-xs font-medium mb-1">{item.tipo}</p>
                  <p className="text-gray-400 text-xs">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-3">
              Após o cancelamento, os certificados já emitidos e publicados permanecerão
              acessíveis para validação pelo prazo acordado em contrato.
              Os dados da instituição serão eliminados conforme a Política de Privacidade.
            </p>
          </Section>

          {/* 11 */}
          <Section title="11. Alterações nos Termos">
            <p>
              A {company} reserva-se o direito de alterar estes Termos a qualquer momento.
              Alterações relevantes serão comunicadas com{" "}
              <strong className="text-white">15 dias de antecedência</strong> por e-mail.
            </p>
            <p>
              O uso continuado da plataforma após as alterações constitui aceitação
              dos novos Termos.
            </p>
          </Section>

          {/* 12 */}
          <Section title="12. Lei aplicável e foro">
            <p>
              Estes Termos são regidos pela legislação da <strong className="text-white">República Federativa do Brasil</strong>.
            </p>
            <p>
              Para a resolução de eventuais conflitos, fica eleito o foro da comarca de{" "}
              <strong className="text-white">Hortolândia, São Paulo</strong>, com renúncia a qualquer outro,
              por mais privilegiado que seja.
            </p>
          </Section>

          {/* 13 */}
          <Section title="13. Contato">
            <p>
              Para dúvidas, solicitações ou comunicações relacionadas a estes Termos:
            </p>
            <ul className="space-y-2 mt-2">
              <li className="flex gap-2 items-center text-sm">
                <span className="text-emerald-400">📧</span>
                <strong className="text-white">{email}</strong>
              </li>
              <li className="flex gap-2 items-center text-sm">
                <span className="text-emerald-400">📱</span>
                <a
                  href="https://wa.me/5519982714815"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-emerald-400 transition-colors"
                >
                  {whatsapp}
                </a>
              </li>
            </ul>
          </Section>

          {/* FOOTER DA PÁGINA */}
          <div className="mt-16 pt-8 border-t border-white/[0.06]">
            <p className="text-gray-600 text-xs text-center">
              © {new Date().getFullYear()} {company} — Estes Termos são regidos pela legislação brasileira.
              Versão vigente desde {lastUpdate}.
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
