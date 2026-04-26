import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function VerifyCertificate() {
  const { codigo } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showScan, setShowScan] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!codigo) return;

    let timer;

    fetch(`https://api-certificados-digitais-production.up.railway.app/api/certificates/verify/${codigo}`)
      .then(res => {
        if (!res.ok) throw new Error("Erro na API");
        return res.json();
      })
      .then(res => {
        setData(res.data);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });

    timer = setTimeout(() => setShowScan(false), 1800);

    return () => clearTimeout(timer);
  }, [codigo]);

  /* =========================
     LOADING STATE (UX PREMIUM)
  ========================== */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <p className="text-slate-400 animate-pulse text-sm tracking-wide">
          Validando autenticidade...
        </p>
      </div>
    );
  }

  /* =========================
     ERROR STATE
  ========================== */
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <p className="text-red-400 text-sm">
          Certificado não encontrado ou inválido
        </p>
      </div>
    );
  }

  /* =========================
     DATA EXTRACTION (SAFE)
  ========================== */
  const participante = data?.participante || {};
  const curso = data?.curso || {};
  const verificacao = data?.verificacao || {};

  /* =========================
     MASK CPF (SEGURANÇA)
  ========================== */
  const maskCpf = (cpf) => {
    if (!cpf) return "***.***.***-**";
    const digits = cpf.replace(/\D/g, "");
    return `***.***.***-${digits.slice(-2)}`;
  };

  /* =========================
     FORMAT DATE
  ========================== */
  const dataFormatada = verificacao?.hora_verificacao
    ? new Date(verificacao.hora_verificacao).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    : "-";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#020617]">

      {/* BACKGROUND GLOW */}
      <div className="absolute w-[600px] h-[600px] bg-green-500/10 blur-[140px] top-[-150px] left-[-150px]" />
      <div className="absolute w-[500px] h-[500px] bg-blue-500/10 blur-[140px] bottom-[-150px] right-[-150px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="
          relative
          w-full max-w-md p-8
          rounded-3xl
          bg-white/5
          border border-white/10
          shadow-[0_20px_80px_-20px_rgba(0,0,0,0.9)]
        "
        style={{ backdropFilter: "blur(20px)" }}
      >

        {/* SCAN LINE */}
        {showScan && (
          <motion.div
            initial={{ y: "-100%" }}
            animate={{ y: "200%" }}
            transition={{ duration: 1.4 }}
            className="absolute left-0 w-full h-[2px] bg-green-400/40 blur-sm"
          />
        )}

        {/* STATUS */}
        <div className="text-center mb-8 relative">

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 180 }}
            className="text-6xl mb-4 relative"
          >
            <span className="drop-shadow-[0_0_30px_rgba(34,197,94,0.9)]">
              ✅
            </span>

            <div className="absolute inset-0 bg-green-400/20 blur-xl rounded-full animate-ping" />
          </motion.div>

          <h1 className="text-xl font-semibold text-white tracking-wide">
            Certificado autêntico
          </h1>

          <p className="text-slate-400 text-sm mt-2">
            Validação confirmada com sucesso
          </p>
        </div>

        {/* TITULAR */}
        <div className="text-center mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest">
            Titular
          </p>
          <h2 className="text-xl text-white font-semibold mt-1">
            {participante?.nome || "-"}
          </h2>
        </div>

        {/* INFO BOX */}
        <div className="bg-white/5 rounded-2xl p-5 space-y-4">

          <Info label="CPF" value={maskCpf(participante?.cpf)} />
          <Info label="Curso" value={curso?.nome} />

          <div className="grid grid-cols-2 gap-4">
            <InfoSmall
              label="Carga horária"
              value={curso?.carga_horaria ? `${curso.carga_horaria}h` : "-"}
            />
            <InfoSmall label="Validação" value={dataFormatada} />
          </div>

        </div>

        {/* FOOTER TRUST */}
        <div className="mt-6 text-center">
          <p className="text-[11px] text-slate-500 tracking-wide">
            Verificação em tempo real • Brasil
          </p>
        </div>

      </motion.div>
    </div>
  );
}

/* COMPONENTES */
function Info({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-white text-sm font-medium">{value || "-"}</span>
    </div>
  );
}

function InfoSmall({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-white text-sm font-medium">{value || "-"}</span>
    </div>
  );
}

export default VerifyCertificate;