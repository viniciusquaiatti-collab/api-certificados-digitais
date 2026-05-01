"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  // =============================
  // STATES
  // =============================
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [form, setForm] = useState({
    nome_participante: "",
    cpf: "",
    nome_curso: "",
    carga_horaria: "",
    data_emissao: "",
  });

  const [pdfUrl, setPdfUrl] = useState("");

  // =============================
  // LOGOUT
  // =============================
  function handleLogout() {
    console.log("🚪 [LOGOUT] Iniciando logout...");

    try {
      localStorage.removeItem("token");
      document.cookie = "token=; Max-Age=0; path=/;";

      console.log("🧹 [LOGOUT] Token removido");

      router.replace("/register");
    } catch (error) {
      console.error("🔥 [LOGOUT ERROR]", error);
    }
  }

  // =============================
  // AUTH VALIDATION (REAL BACKEND)
  // =============================
  useEffect(() => {
    console.log("🔍 [AUTH] Iniciando validação real de sessão...");

    async function validateAuth() {
      try {
        const token = localStorage.getItem("token");

        console.log("🔑 [AUTH] Token bruto:", token);

        if (!token) {
          console.warn("❌ [AUTH] Sem token → redirect login");
          router.replace("/login");
          return;
        }

        console.log("📏 [AUTH] Token length:", token.length);
        console.log("🧪 [AUTH] Token preview:", token.substring(0, 25));

        console.log("📡 [AUTH] Chamando /me para validação real...");

        const response = await fetch("http://localhost:8080/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("📡 [AUTH] Status:", response.status);

        const data = await response.json();

        console.log("📦 [AUTH] Response:", data);

        if (!response.ok) {
          throw new Error(data.error || "Token inválido");
        }

        console.log("✅ [AUTH] Usuário autenticado:", data.data.email);

        setUser(data.data);
      } catch (error: any) {
        console.error("🔥 [AUTH ERROR]", error.message);

        console.warn("🚨 [AUTH] Limpando sessão inválida...");

        localStorage.removeItem("token");
        document.cookie = "token=; Max-Age=0";

        router.replace("/login");
      } finally {
        console.log("🧹 [AUTH] Finalizando validação");
        setLoadingAuth(false);
      }
    }

    validateAuth();
  }, []);

  // =============================
  // INPUT CHANGE
  // =============================
  function handleChange(e: any) {
    const { name, value } = e.target;

    console.log("✏️ [INPUT]", { field: name, value });

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // =============================
  // SUBMIT CERTIFICATE
  // =============================
  async function handleSubmit(e: any) {
    e.preventDefault();

    console.log("🚀 [SUBMIT] Iniciando emissão...");
    console.log("📦 [FORM RAW]", form);

    setLoadingSubmit(true);
    setPdfUrl("");

    try {
      const token = localStorage.getItem("token");

      console.log("🔑 [TOKEN]", token);

      if (!token) {
        throw new Error("Usuário não autenticado");
      }

      const payload = {
        ...form,
        carga_horaria: Number(form.carga_horaria),
      };

      console.log("📤 [PAYLOAD]", payload);

      const response = await fetch("http://localhost:8080/api/certificates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log("📡 [API STATUS]", response.status);

      const data = await response.json();

      console.log("📥 [API RESPONSE]", data);

      if (!response.ok) {
        console.error("❌ [API ERROR]", data);

        if (data?.error?.includes("Token")) {
          console.error("🚨 [TOKEN INVALIDO DETECTADO]");
          console.error("🧪 TOKEN:", token);

          localStorage.removeItem("token");
          document.cookie = "token=; Max-Age=0";

          console.warn("⚠️ Redirecionando para login...");
          router.replace("/login");
        }

        throw new Error(data.error || "Erro ao emitir certificado");
      }

      const url = data.data?.pdf_url || data.pdf_url;

      console.log("📄 [PDF URL]", url);

      if (!url) {
        throw new Error("PDF não retornado");
      }

      console.log("✅ [SUCCESS] Certificado emitido!");

      setPdfUrl(url);
    } catch (error: any) {
      console.error("🔥 [SUBMIT ERROR]", error.message);
      alert(error.message);
    } finally {
      console.log("🧹 [SUBMIT FINALIZADO]");
      setLoadingSubmit(false);
    }
  }

  // =============================
  // LOADING AUTH
  // =============================
  if (loadingAuth) {
    console.log("⏳ [RENDER] Validando sessão...");
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        Validando sessão...
      </div>
    );
  }

  // =============================
  // BLOCK IF NO USER
  // =============================
  if (!user) {
    console.warn("❌ [RENDER] Sem usuário → bloqueado");
    return null;
  }

  // =============================
  // UI
  // =============================
  console.log("🎯 [RENDER] Dashboard OK");
  console.log("👤 [USER]", user);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="w-full max-w-xl bg-slate-900 p-8 rounded-2xl shadow-lg">

        <h1 className="text-2xl font-bold mb-2 text-center">
          🎓 Emissão de Certificado
        </h1>

        <p className="text-center text-sm text-gray-400 mb-4">
          Logado como: {user.email}
        </p>

        {/* BOTÃO LOGOUT */}
        <button
          onClick={handleLogout}
          className="w-full mb-6 bg-red-600 hover:bg-red-700 p-2 rounded font-bold"
        >
          Sair
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            name="nome_participante"
            placeholder="Nome do participante"
            className="w-full p-3 rounded bg-slate-800"
            onChange={handleChange}
            required
          />

          <input
            name="cpf"
            placeholder="CPF"
            className="w-full p-3 rounded bg-slate-800"
            onChange={handleChange}
            required
          />

          <input
            name="nome_curso"
            placeholder="Nome do curso"
            className="w-full p-3 rounded bg-slate-800"
            onChange={handleChange}
            required
          />

          <input
            name="carga_horaria"
            placeholder="Carga horária"
            type="number"
            className="w-full p-3 rounded bg-slate-800"
            onChange={handleChange}
            required
          />

          <input
            name="data_emissao"
            type="date"
            className="w-full p-3 rounded bg-slate-800"
            onChange={handleChange}
            required
          />

          <button
            type="submit"
            disabled={loadingSubmit}
            className="w-full bg-green-600 hover:bg-green-700 p-3 rounded font-bold"
          >
            {loadingSubmit ? "Emitindo..." : "Emitir Certificado"}
          </button>
        </form>

        {pdfUrl && (
          <div className="mt-6 text-center">
            <p className="mb-2">✅ Certificado gerado:</p>
            <a
              href={pdfUrl}
              target="_blank"
              className="text-green-400 underline"
            >
              Abrir PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}