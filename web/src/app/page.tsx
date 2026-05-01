"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  console.log("🏠 [HOME] Renderizando landing page");

  function goLogin() {
    console.log("➡️ [HOME] Indo para login");
    router.push("/login");
  }

  function goRegister() {
    console.log("➡️ [HOME] Indo para register");
    router.push("/register");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex flex-col items-center justify-center px-6">

      {/* HERO */}
      <div className="text-center max-w-3xl">

        <h1 className="text-5xl font-bold mb-6 leading-tight">
          Emissão de Certificados
          <span className="text-green-500"> rápida</span>,
          <span className="text-green-500"> segura</span> e
          <span className="text-green-500"> profissional</span>
        </h1>

        <p className="text-gray-400 text-lg mb-10">
          Plataforma completa para emissão, validação e autenticação de certificados digitais com rastreabilidade e segurança de nível empresarial.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">

          <button
            onClick={goRegister}
            className="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-xl font-bold text-lg transition"
          >
            🚀 Criar conta
          </button>

          <button
            onClick={goLogin}
            className="bg-slate-800 hover:bg-slate-700 px-8 py-4 rounded-xl font-bold text-lg transition border border-slate-600"
          >
            🔐 Já tenho conta
          </button>

        </div>
      </div>

      {/* FEATURES */}
      <div className="mt-20 grid md:grid-cols-3 gap-6 max-w-5xl w-full">

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-lg mb-2">⚡ Emissão instantânea</h3>
          <p className="text-gray-400 text-sm">
            Gere certificados em segundos com alta performance e confiabilidade.
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-lg mb-2">🔒 Segurança avançada</h3>
          <p className="text-gray-400 text-sm">
            Proteção com autenticação JWT, rastreamento e validação criptográfica.
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-lg mb-2">📊 Rastreabilidade</h3>
          <p className="text-gray-400 text-sm">
            Histórico completo de verificações e auditoria de certificados.
          </p>
        </div>

      </div>

      {/* FOOTER */}
      <div className="mt-20 text-gray-500 text-sm">
        © {new Date().getFullYear()} NexaSpark — Todos os direitos reservados
      </div>

    </div>
  );
}