import { motion } from "framer-motion";

function App() {
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white/5 backdrop-blur-xl p-10 rounded-2xl shadow-2xl text-center"
      >
        <h1 className="text-3xl font-semibold mb-3">
          Verificação de Certificado
        </h1>

        <p className="text-slate-400">
          Escaneie o QR Code para validar a autenticidade
        </p>
      </motion.div>

    </div>
  );
}

export default App;