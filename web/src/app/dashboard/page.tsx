"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  // =============================
  // STATE
  // =============================
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const [form, setForm] = useState({
    nome_participante: "",
    cpf: "",
    nome_curso: "",
    carga_horaria: "",
    data_emissao: "",
  });

  const [pdfUrl, setPdfUrl] = useState("");

  // =============================
  // AUTH CHECK
  // =============================
  useEffect(() => {
    console.log("🔍 [AUTH] Verificando autenticação...");

    try {
      const token = localStorage.getItem("token");

      console.log("🔑 [AUTH] Token encontrado:", token);

      if (!token) {
        console.warn("❌ [AUTH] Usuário não autenticado → redirect");
        router.push("/login");
        return;
      }

      // DEBUG EXTRA
      console.log("📏 [AUTH] Tamanho do token:", token.length);
      console.log("🧪 [AUTH] Primeiros 20 chars:", token.substring(0, 20));

      console.log("✅ [AUTH] Usuário autenticado");
    } catch (error) {
      console.error("❌ [AUTH ERROR]", error);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  // =============================
  // INPUT CHANGE
  // =============================
  function handleChange(e: any) {
    const { name, value } = e.target;

    console.log("✏️ [INPUT CHANGE]", { field: name, value });

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // =============================
  // SUBMIT
  // =============================
  async function handleSubmit(e: any) {
    e.preventDefault();

    console.log("🚀 [SUBMIT] Iniciando emissão de certificado...");
    console.log("📦 [FORM DATA RAW]", form);

    setLoadingSubmit(true);
    setPdfUrl("");

    try {
      const token = localStorage.getItem("token");

      console.log("🔑 [TOKEN RAW]", token);

      if (!token) {
        console.error("❌ [TOKEN] Token não encontrado no localStorage");
        throw new Error("Usuário não autenticado");
      }

      console.log("📏 [TOKEN LENGTH]", token.length);
      console.log("🧪 [TOKEN PREVIEW]", token.substring(0, 25));

      const payload = {
        ...form,
        carga_horaria: Number(form.carga_horaria),
      };

      console.log("📤 [PAYLOAD FINAL]", payload);

      const response = await fetch("http://localhost:8080/api/certificates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log("📡 [RESPONSE STATUS]", response.status);

      let data;
      try {
        data = await response.json();
        console.log("📥 [RESPONSE BODY]", data);
      } catch (jsonError) {
        console.error("❌ [JSON PARSE ERROR]", jsonError);
        throw new Error("Erro ao interpretar resposta do servidor");
      }

      if (!response.ok) {
        console.error("❌ [API ERROR]", data);

        // DEBUG CRÍTICO
        if (data?.error?.includes("Token")) {
          console.error("🚨 [TOKEN PROBLEM DETECTED]");
          console.error("🧪 TOKEN ENVIADO:", token);

          // força logout
          localStorage.removeItem("token");
          console.warn("⚠️ Token removido → forçando novo login");

          router.push("/login");
        }

        throw new Error(data.error || "Erro ao emitir certificado");
      }

      const url = data.data?.pdf_url || data.pdf_url;

      console.log("📄 [PDF URL]", url);

      if (!url) {
        throw new Error("PDF não retornado pela API");
      }

      console.log("✅ [SUCCESS] Certificado emitido com sucesso!");

      setPdfUrl(url);
    } catch (error: any) {
      console.error("❌ [SUBMIT ERROR]", error.message);
      alert(error.message);
    } finally {
      console.log("🧹 [SUBMIT FINALIZADO]");
      setLoadingSubmit(false);
    }
  }

  // =============================
  // LOADING SCREEN
  // =============================
  if (loadingAuth) {
    console.log("⏳ [RENDER] Aguardando autenticação...");
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        Carregando autenticação...
      </div>
    );
  }

  // =============================
  // UI
  // =============================
  console.log("🎯 [RENDER] Dashboard carregado");

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="w-full max-w-xl bg-slate-900 p-8 rounded-2xl shadow-lg">

        <h1 className="text-2xl font-bold mb-6 text-center">
          🎓 Emissão de Certificado
        </h1>

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