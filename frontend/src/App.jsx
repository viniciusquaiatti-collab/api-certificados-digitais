import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import VerifyPages from "./pages/VerifyPages";

function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card-premium text-center max-w-md p-8">
        <h1 className="text-xl font-semibold text-white mb-2">
          Sistema de Verificação
        </h1>

        <p className="text-sm text-slate-400">
          Utilize o QR Code ou link do certificado para validar a autenticidade.
        </p>

        <div className="mt-6 text-xs text-slate-500">
          Ambiente seguro • API ativa
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* HOME LIMPA E COERENTE */}
        <Route path="/" element={<Home />} />

        {/* CORE DO SISTEMA */}
        <Route path="/verify/:codigo" element={<VerifyPages />} />

        {/* REDIRECIONAMENTO INTELIGENTE */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;