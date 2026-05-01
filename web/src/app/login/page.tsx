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

    console.log("🔐 [LOGIN] Tentando login...");
    console.log("📧 [LOGIN] Email:", email);
    console.log("🔑 [LOGIN] Senha:", senha);

    setLoading(true);

    try {
      const response = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password: senha,
        }),
      });

      console.log("📡 [LOGIN] Status resposta:", response.status);

      let data;

      try {
        data = await response.json();
        console.log("📦 [LOGIN] Resposta API completa:", data);
      } catch (err) {
        console.error("❌ [LOGIN] Erro ao parsear JSON:", err);
        throw new Error("Resposta inválida do servidor");
      }

     if (!response.ok) {
  console.error("❌ [LOGIN ERROR]", data);

  // 🔥 REMOVE TOKEN SUJO
  localStorage.removeItem("token");
  document.cookie = "token=; Max-Age=0; path=/;";

  throw new Error(data.error || "Erro no login");
}

      console.log("✅ [LOGIN] Login bem sucedido!");

      // =============================
      // EXTRAÇÃO SEGURA DO TOKEN
      // =============================
      const token = data.token || data.data?.token;

      console.log("🔍 [TOKEN] Tentando extrair token...");
      console.log("👉 data.token:", data.token);
      console.log("👉 data.data?.token:", data.data?.token);

      if (!token) {
        console.error("❌ [TOKEN] Token não encontrado!");
        console.error("📦 [DEBUG RESPONSE]", data);
        throw new Error("Token não recebido do backend");
      }

      // =============================
      // VALIDAÇÃO DO TOKEN
      // =============================
      if (typeof token !== "string") {
        console.error("❌ [TOKEN] Token não é string:", token);
        throw new Error("Token inválido (tipo incorreto)");
      }

      if (token.length < 20) {
        console.error("❌ [TOKEN] Token muito curto:", token);
        throw new Error("Token inválido (tamanho suspeito)");
      }

      console.log("🔑 [TOKEN OK]");
      console.log("📏 Tamanho:", token.length);
      console.log("🧪 Preview:", token.substring(0, 30));

      // =============================
      // SALVAR TOKEN (LOCAL + COOKIE)
      // =============================

      // 🔥 localStorage (client side)
      localStorage.setItem("token", token);
      console.log("💾 [TOKEN] Salvo no localStorage");

      // 🔥 cookie (middleware / server side)
      document.cookie = `token=${token}; path=/;`;

      console.log("🍪 [TOKEN] Salvo em cookie");

      // DEBUG EXTRA
      const savedToken = localStorage.getItem("token");
      console.log("🔁 [TOKEN] Recuperado do localStorage:", savedToken);

      console.log("📄 [COOKIE] document.cookie:", document.cookie);

      // =============================
      // REDIRECT
      // =============================
      console.log("➡️ [LOGIN] Redirecionando para dashboard...");
      router.push("/dashboard");

    } catch (error: any) {
      console.error("🔥 [LOGIN ERROR]", error.message);
      alert(error.message || "Erro ao conectar com servidor");
    } finally {
      console.log("🧹 [LOGIN FINALIZADO]");
      setLoading(false);
    }
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
              console.log("✏️ [INPUT] Email:", e.target.value);
              setEmail(e.target.value);
            }}
            className="w-full p-3 rounded bg-slate-900 border border-slate-700"
          />

          <input
            type="password"
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => {
              console.log("✏️ [INPUT] Senha:", e.target.value);
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