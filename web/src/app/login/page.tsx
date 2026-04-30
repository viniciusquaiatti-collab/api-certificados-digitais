"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    console.log("🔐 Tentando login...");
    console.log("📧 Email:", email);
    console.log("🔑 Senha:", senha);

    setLoading(true);

    try {
      const response = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password :senha,
        }),
      });

      console.log("📡 Status resposta:", response.status);

      const data = await response.json();

      console.log("📦 Resposta API:", data);

      if (!response.ok) {
        console.error("❌ Erro no login:", data);
        alert(data.error || "Erro ao logar");
        setLoading(false);
        return;
      }

      console.log("✅ Login bem sucedido!");

      // salvar token
      localStorage.setItem("token", data.token);

      console.log("💾 Token salvo no localStorage");

      // redirecionar
      router.push("/dashboard");

    } catch (error) {
      console.error("🔥 Erro geral:", error);
      alert("Erro ao conectar com servidor");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">

      <div className="w-full max-w-md bg-[#0f172a] p-8 rounded-2xl shadow-2xl border border-slate-800">

        <h1 className="text-2xl font-bold mb-6 text-center">
          NexaSpark • Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">

          <input
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => {
              console.log("✏️ Digitando email:", e.target.value);
              setEmail(e.target.value);
            }}
            className="w-full p-3 rounded bg-slate-900 border border-slate-700"
          />

          <input
            type="password"
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => {
              console.log("✏️ Digitando senha:", e.target.value);
              setSenha(e.target.value);
            }}
            className="w-full p-3 rounded bg-slate-900 border border-slate-700"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 transition p-3 rounded font-semibold"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

        </form>

      </div>

    </div>
  );
}