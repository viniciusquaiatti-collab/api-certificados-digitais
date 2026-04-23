import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function VerifyCertificate() {
  const { codigo } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showScan, setShowScan] = useState(true);

  useEffect(() => {
    fetch(`https://api-certificados-digitais-production.up.railway.app/api/certificates/verify/${codigo}`)
      .then(res => res.json())
      .then(res => setData(res.data))
      .finally(() => setLoading(false));

    setTimeout(() => setShowScan(false), 2000);
  }, [codigo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">
          Validando certificado...
        </p>
      </div>
    );
  }

  const participante = data?.participante;
  const curso = data?.curso;
  const verificacao = data?.verificacao;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">

      {/* FUNDO */}
      <div className="absolute w-[600px] h-[600px] bg-green-500/10 blur-[120px] top-[-100px] left-[-100px] animate-pulse"></div>
      <div className="absolute w-[500px] h-[500px] bg-blue-500/10 blur-[120px] bottom-[-100px] right-[-100px] animate-pulse"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="
          relative
          w-full max-w-md p-8
          rounded-3xl
          bg-white/5
          border border-white/10
          shadow-[0_20px_100px_-20px_rgba(0,0,0,0.8)]
        "
        style={{ backdropFilter: "blur(20px)" }} // 🔥 solução correta
      >

        {/* SCAN EFFECT */}
        {showScan && (
          <motion.div
            initial={{ y: "-100%" }}
            animate={{ y: "200%" }}
            transition={{ duration: 1.5 }}
            className="absolute left-0 w-full h-[2px] bg-green-400/40 blur-sm"
          />
        )}

        {/* HEADER */}
        <div className="text-center mb-8 relative">

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 180 }}
            className="text-7xl mb-3 relative"
          >
            <span className="drop-shadow-[0_0_25px_rgba(34,197,94,0.9)]">
              ✅
            </span>

            <div className="absolute inset-0 bg-green-400/20 blur-xl rounded-full animate-ping"></div>
          </motion.div>

          <h1 className="text-2xl font-semibold text-white">
            Certificado verificado
          </h1>

          <p className="text-slate-400 text-sm mt-1">
            Autenticidade confirmada com sucesso
          </p>

        </div>

        {/* NOME */}
        <div className="text-center mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest">
            Titular do certificado
          </p>
          <h2 className="text-xl text-white font-semibold mt-1">
            {participante?.nome}
          </h2>
        </div>

        {/* INFOS MAIS COMPACTAS */}
        <div className="bg-white/5 rounded-2xl p-5 space-y-3">

          <Info label="CPF" value={participante?.cpf} />
          <Info label="Curso" value={curso?.nome} />

          <div className="grid grid-cols-2 gap-4">
            <InfoSmall label="Carga horária" value={`${curso?.carga_horaria}h`} />

            <InfoSmall
              label="Verificação"
              value={
                verificacao?.hora_verificacao
                  ? new Date(verificacao.hora_verificacao).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit"
                    })
                  : "-"
              }
            />
          </div>

        </div>

        {/* BOTÃO */}
        <div className="mt-6 flex justify-center">
          <a
            href={verificacao?.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="
              flex items-center gap-2
              px-6 py-3
              rounded-full
              bg-green-400/10
              border border-green-400/30
              text-green-300
              hover:bg-green-400/20
              transition-all
              shadow-[0_0_20px_rgba(34,197,94,0.3)]
            "
            style={{ backdropFilter: "blur(10px)" }}
          >
            <span>✅</span>
            <span className="text-sm font-medium">
              Ver certificado
            </span>
          </a>
        </div>

      </motion.div>
    </div>
  );
}

/* COMPONENTES */
function Info({ label, value }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}

function InfoSmall({ label, value }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}

export default VerifyCertificate;