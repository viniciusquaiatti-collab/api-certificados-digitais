"use client";

import { useEffect, useState } from "react";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    console.log("🔍 [AUTH HOOK] Validando sessão...");

    async function validate() {
      try {
        const token = localStorage.getItem("token");

        console.log("🔑 [AUTH HOOK] Token:", token);

        if (!token) {
          console.warn("❌ [AUTH HOOK] Sem token");
          setLoading(false);
          return;
        }

        const response = await fetch("http://localhost:8080/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("📡 [AUTH HOOK] Status:", response.status);

        const data = await response.json();

        console.log("📦 [AUTH HOOK] Response:", data);

        if (!response.ok) {
          throw new Error("Token inválido");
        }

        console.log("✅ [AUTH HOOK] Usuário válido:", data.data.email);

        setUser(data.data);
      } catch (error: any) {
        console.error("🔥 [AUTH HOOK ERROR]", error.message);

        // 🚨 HARD LOGOUT
        localStorage.removeItem("token");
        document.cookie = "token=; Max-Age=0";

      } finally {
        setLoading(false);
      }
    }

    validate();
  }, []);

  return { user, loading };
}