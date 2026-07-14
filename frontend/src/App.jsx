// -*- coding: utf-8 -*-
/**
 * App.jsx — Punto de entrada de la aplicación
 * ---------------------------------------------
 * Maneja el estado global de sesión y el routing
 * entre las pantallas principales:
 *   · Login
 *   · Productos (relevamiento)
 *   · Panel de control (históricos)
 *   · Asignación de categorías (solo admin)
 *
 * No usa react-router — el routing es por estado
 * simple dado que son pocas páginas post-login.
 *
 * Para levantar el proyecto:
 *   npm create vite@latest frontend -- --template react
 *   cd frontend
 *   npm install
 *   # Crear .env con VITE_API_URL=http://localhost:8000
 *   npm run dev
 */

import { useState, useEffect } from "react";

import Login                 from "./pages/Login";
import Productos             from "./pages/Productos";
import PanelControl          from "./pages/PanelControl";
import AsignacionCategorias  from "./pages/AsignacionCategorias";
import Navbar                from "./components/Navbar";

const API = import.meta.env.VITE_API_URL ?? "";

export default function App() {
  // ── Estado global de sesión ──────────────────────────────────────────────
  const [empleado,      setEmpleado]      = useState(null);
  const [paginaActual,  setPaginaActual]  = useState("relevamiento");
  const [verificando,   setVerificando]   = useState(true);

  // ── Al montar: verificar si hay token guardado en localStorage ───────────
  // Si el token es válido, restaurar la sesión sin pedir login de nuevo.
  useEffect(() => {
    async function restaurarSesion() {
      const token = localStorage.getItem("token");

      if (!token) {
        setVerificando(false);
        return;
      }

      try {
        const resp = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (resp.ok) {
          const data = await resp.json();
          setEmpleado(data.empleado);
        } else {
          // Token expirado o inválido → limpiar
          limpiarSesion();
        }
      } catch (_) {
        // Sin conexión → mantener sesión local por ahora
        const nombre  = localStorage.getItem("empleado_nombre");
        const id      = localStorage.getItem("empleado_id");
        const rol     = localStorage.getItem("empleado_rol");
        const codigo  = localStorage.getItem("empleado_codigo");

        if (nombre && id && rol) {
          setEmpleado({ id, nombre, rol, codigo_empleado: codigo });
        }
      } finally {
        setVerificando(false);
      }
    }

    restaurarSesion();
  }, []);

  // ── Limpiar sesión ────────────────────────────────────────────────────────
  function limpiarSesion() {
    localStorage.removeItem("token");
    localStorage.removeItem("empleado_id");
    localStorage.removeItem("empleado_nombre");
    localStorage.removeItem("empleado_rol");
    localStorage.removeItem("empleado_codigo");
    setEmpleado(null);
    setPaginaActual("relevamiento");
  }

  // ── Callback de login exitoso ─────────────────────────────────────────────
  function handleLoginSuccess(emp) {
    setEmpleado(emp);
    setPaginaActual("relevamiento");
  }

  // ── Pantalla de verificación inicial ─────────────────────────────────────
  if (verificando) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F8F9FF",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        flexDirection: "column",
        gap: "14px",
      }}>
        {/* Logo */}
        <div style={{
          width: "44px",
          height: "44px",
          background: "#E63946",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: "17px",
          color: "#fff",
        }}>
          RP
        </div>

        {/* Spinner */}
        <svg width="22" height="22" viewBox="0 0 22 22"
          style={{ animation: "spin 0.75s linear infinite" }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <circle cx="11" cy="11" r="9"
            fill="none" stroke="#E6E6E6" strokeWidth="2.5"/>
          <path d="M11 2 A9 9 0 0 1 20 11"
            fill="none" stroke="#E63946" strokeWidth="2.5"
            strokeLinecap="round"/>
        </svg>

        <span style={{ fontSize: "13px", color: "#AAAAAA" }}>
          Verificando sesión…
        </span>
      </div>
    );
  }

  // ── Pantalla de login ─────────────────────────────────────────────────────
  if (!empleado) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // ── App principal (post-login) ────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FF" }}>

      <Navbar
        empleado={empleado}
        paginaActual={paginaActual}
        onNavegar={setPaginaActual}
        onLogout={limpiarSesion}
      />

      {paginaActual === "relevamiento" && (
        <Productos empleado={empleado} />
      )}

      {paginaActual === "panel" && (
        <PanelControl empleado={empleado} />
      )}

      {paginaActual === "asignaciones" && empleado?.rol === "admin" && (
        <AsignacionCategorias empleado={empleado} />
      )}

    </div>
  );
}