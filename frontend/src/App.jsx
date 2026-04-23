import { motion } from "framer-motion";

function App() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">

      {/* Glow background */}
      <div className="absolute w-[500px] h-[500px] bg-green-500/10 blur-[120px] rounded-full top-10 left-10"></div>
      <div className="absolute w-[400px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full bottom-10 right-10"></div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass glow-green relative p-10 rounded-2xl shadow-2xl w-full max-w-md text-center"
      >
        {/* Badge */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-400 font-medium tracking-wide">
            Sistema ativo
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-semibold mb-3">
          Verificação de Certificado
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 text-sm mb-6">
          Escaneie o QR Code ou insira o código para validar a autenticidade
        </p>

        {/* Divider */}
        <div className="divider mb-6"></div>

        {/* Input (já pronto pra próxima etapa) */}
        <input
          type="text"
          placeholder="Digite o código de verificação"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-green-400 transition"
        />

        {/* Button */}
        <button className="mt-4 w-full bg-green-500 hover:bg-green-400 text-black font-medium py-3 rounded-lg transition">
          Verificar Certificado
        </button>

        {/* Footer */}
        <p className="text-xs text-slate-500 mt-6">
          Sistema seguro • API certificada
        </p>
      </motion.div>
    </div>
  );
}

export default App;