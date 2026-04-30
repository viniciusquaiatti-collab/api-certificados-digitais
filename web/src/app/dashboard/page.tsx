"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🔍 Verificando autenticação...");

    const token = localStorage.getItem("token");

    console.log("🔑 Token:", token);

    if (!token) {
      console.warn("❌ Sem token, redirecionando...");
      router.push("/login");
    } else {
      console.log("✅ Autenticado");
    }

    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
      <h1>Dashboard</h1>
    </div>
  );
}