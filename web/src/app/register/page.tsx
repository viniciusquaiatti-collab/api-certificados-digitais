"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    console.log("📝 [REGISTER] Iniciando cadastro...");
    console.log("📧 Email:", email);
    console.log("🔑 Senha:", senha);

    setLoading(true);

    try {
      const response = await fetch("http://localhost:8080/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password: senha,
        }),
      });

      console.log("📡 [REGISTER] Status:", response.status);

      let data;

      try {
        data = await response.json();
        console.log("📦 [REGISTER] Resposta:", data);
      } catch (err) {
        console.error("❌ [REGISTER] JSON inválido:", err);
        throw new Error("Erro ao interpretar resposta do servidor");
      }

      if (!response.ok) {
        console.error("❌ [REGISTER ERROR]", data);
        alert(data.error || "Erro ao registrar");
        return;
      }

      console.log("✅ [REGISTER] Usuário criado com sucesso!");

      // 🔥 OPCIONAL: já logar automaticamente
      const token = data.token || data.data?.token;

      console.log("🔍 [REGISTER] Token recebido:", token);

      if (token) {
        localStorage.setItem("token", token);
        document.cookie = `token=${token}; path=/;`;

        console.log("💾 [REGISTER] Token salvo");
        router.push("/dashboard");
      } else {
        console.warn("⚠️ [REGISTER] Sem token → indo para login");
        router.push("/login");
      }

    } catch (error: any) {
      console.error("🔥 [REGISTER ERROR]", error.message);
      alert(error.message);
    } finally {
      console.log("🧹 [REGISTER FINALIZADO]");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">

      <div className="w-full max-w-md bg-[#0f172a] p-8 rounded-2xl shadow-2xl border border-slate-800">

        <h1 className="text-2xl font-bold mb-6 text-center">
          Criar Conta • NexaSpark
        </h1>

        <form onSubmit={handleRegister} className="space-y-4">

          <input
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => {
              console.log("✏️ [INPUT REGISTER] Email:", e.target.value);
              setEmail(e.target.value);
            }}
            className="w-full p-3 rounded bg-slate-900 border border-slate-700"
          />

          <input
            type="password"
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => {
              console.log("✏️ [INPUT REGISTER] Senha:", e.target.value);
              setSenha(e.target.value);
            }}
            className="w-full p-3 rounded bg-slate-900 border border-slate-700"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 transition p-3 rounded font-semibold"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>

        </form>

      </div>

    </div>
  );
}