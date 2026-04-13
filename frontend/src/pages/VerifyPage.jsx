import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function VerifyPage() {
  const { codigo } = useParams();
  const [certificado, setCertificado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function fetchCertificado() {
      try {
        const response = await fetch(
          `https://api-certificados-digitais-production.up.railway.app/api/certificates/verify/${codigo}`
        );

        if (!response.ok) {
          throw new Error("Certificado não encontrado");
        }

        const data = await response.json();
        setCertificado(data);
      } catch (err) {
        setErro(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCertificado();
  }, [codigo]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-10 h-10 border-4 border-white border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="h-screen flex items-center justify-center text-red-500">
        {erro}
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-black to-slate-900 text-white">
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white/5 backdrop-blur-xl p-10 rounded-2xl shadow-2xl text-center"
      >
        <h1 className="text-green-400 text-2xl mb-4">
          Certificado válido
        </h1>

        <p><strong>Nome:</strong> {certificado.nome_participante}</p>
        <p><strong>Curso:</strong> {certificado.nome_curso}</p>
        <p><strong>Carga:</strong> {certificado.carga_horaria}h</p>
        <p>
          <strong>Data:</strong>{" "}
          {new Date(certificado.data_emissao).toLocaleDateString("pt-BR")}
        </p>

        <a
          href={certificado.pdf_url}
          target="_blank"
          className="mt-6 inline-block px-6 py-2 bg-green-500 rounded-lg hover:bg-green-600 transition"
        >
          Ver PDF
        </a>
      </motion.div>

    </div>
  );
}

export default VerifyPage;