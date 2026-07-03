"use client";

import { useEffect, useState } from "react";

/**
 * Login del taller. Ruta pública (el candado la exceptúa) para que un usuario
 * sin sesión pueda autenticarse. Al éxito, la cookie httpOnly queda seteada por
 * /api/login y redirigimos a `next` (o /admin).
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [next, setNext] = useState("/admin");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const n = params.get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        // Recarga dura para que el middleware relea la cookie recién puesta.
        window.location.assign(next);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "No se pudo iniciar sesión.");
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #fff)",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--fg-subtle, #8a8a8a)",
              marginBottom: 10,
            }}
          >
            El Taller · Acceso
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 30,
              lineHeight: 1.1,
              fontWeight: 400,
              color: "var(--fg, #111)",
              margin: 0,
            }}
          >
            Historia Colombiana
          </h1>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={labelStyle}>Correo</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={labelStyle}>Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                fontSize: 13,
                color: "#b3261e",
                background: "rgba(179,38,30,0.06)",
                border: "1px solid rgba(179,38,30,0.2)",
                padding: "8px 11px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              appearance: "none",
              background: "var(--fg, #111)",
              color: "var(--bg, #fff)",
              border: "none",
              padding: "11px 16px",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--fg-muted, #666)",
};

const inputStyle: React.CSSProperties = {
  appearance: "none",
  background: "var(--bg, #fff)",
  border: "1px solid var(--line-strong, #d4d4d4)",
  padding: "10px 12px",
  fontSize: 15,
  fontFamily: "var(--font-sans)",
  color: "var(--fg, #111)",
  outline: "none",
};
