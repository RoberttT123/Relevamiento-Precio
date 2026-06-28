// -*- coding: utf-8 -*-
/**
 * Navbar.jsx — Barra de navegación principal
 * -------------------------------------------
 * Franja superior:  logo (izquierda) | badge período + empleado + logout (derecha)
 * Franja inferior:  tabs Relevamiento · Panel de control
 *
 * Props:
 *   empleado      { id, nombre, rol, codigo_empleado }
 *   paginaActual  "relevamiento" | "panel"
 *   onNavegar     (pagina) => void
 *   onLogout      () => void
 */

import { useState } from "react";

// ─── Tokens PROESA ────────────────────────────────────────────────────────────
const C = {
  navy:      "#1A1A2E",
  red:       "#E63946",
  redHover:  "#CC2F3B",
  redLight:  "rgba(230,57,70,0.12)",
  white:     "#FFFFFF",
  gray50:    "#F8F9FF",
  gray100:   "#F0F0F0",
  gray400:   "#AAAAAA",
  border:    "#E6E6E6",
};

// ─── Período dinámico ─────────────────────────────────────────────────────────
function usePeriodo() {
  const ahora = new Date();
  const MESES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ];
  return `${MESES[ahora.getMonth()]} ${ahora.getFullYear()}`;
}

// ─── Iniciales del empleado ───────────────────────────────────────────────────
function iniciales(nombre = "") {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "relevamiento", label: "Relevamiento",    icon: "📋" },
  { id: "panel",        label: "Panel de control", icon: "📊" },
];

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S = {
  wrapper: {
    width: "100%",
    background: C.white,
    borderBottom: `1px solid ${C.border}`,
    position: "sticky",
    top: 0,
    zIndex: 100,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  // ── Franja superior ──────────────────────────────────────────────────────
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",   // logo izq | derecha todo junto
    padding: "0 1.5rem",
    height: "52px",
    borderBottom: `1px solid ${C.gray100}`,
  },

  // Logo (izquierda)
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
  },
  logoMark: {
    width: "32px",
    height: "32px",
    background: C.red,
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "13px",
    color: C.white,
    flexShrink: 0,
  },
  logoText: {
    fontSize: "15px",
    fontWeight: 600,
    color: C.navy,
    letterSpacing: "0.2px",
  },
  logoSub: {
    fontSize: "11px",
    color: C.gray400,
    fontWeight: 400,
  },

  // Derecha: badge + divider + avatar + nombre/rol + divider + logout
  rightGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  // Badge período (derecha)
  periodBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: C.redLight,
    color: C.red,
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: "20px",
    whiteSpace: "nowrap",
  },

  dividerV: {
    width: "1px",
    height: "20px",
    background: C.gray100,
    flexShrink: 0,
  },

  avatarCircle: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: C.navy,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
    color: C.white,
    flexShrink: 0,
    letterSpacing: "0.5px",
  },

  empleadoInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  empleadoNombre: {
    fontSize: "13px",
    fontWeight: 600,
    color: C.navy,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },
  empleadoRol: {
    fontSize: "11px",
    color: C.gray400,
    lineHeight: 1.2,
    textTransform: "capitalize",
  },

  btnLogout: (hover) => ({
    display: "flex",
    alignItems: "center",
    gap: "5px",
    background: hover ? C.redLight : "none",
    border: "none",
    cursor: "pointer",
    fontSize: "12px",
    color: hover ? C.red : C.gray400,
    padding: "5px 8px",
    borderRadius: "6px",
    transition: "color 0.15s, background 0.15s",
    whiteSpace: "nowrap",
  }),

  // ── Franja inferior: tabs ────────────────────────────────────────────────
  tabsBar: {
    display: "flex",
    alignItems: "flex-end",
    padding: "0 1.5rem",
    height: "42px",
    gap: "0",
    overflowX: "auto",
  },

  tab: (activo, hover) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "0 1.1rem",
    height: "100%",
    fontSize: "13.5px",
    fontWeight: activo ? 600 : 500,
    color: activo ? C.navy : hover ? C.navy : C.gray400,
    borderBottom: activo ? `3px solid ${C.red}` : "3px solid transparent",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    background: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "color 0.15s, border-bottom-color 0.15s",
    outline: "none",
  }),

  adminChip: {
    display: "inline-block",
    background: C.redLight,
    color: C.red,
    fontSize: "10px",
    fontWeight: 700,
    padding: "1px 7px",
    borderRadius: "20px",
    marginLeft: "4px",
    letterSpacing: "0.3px",
    textTransform: "uppercase",
  },
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Navbar({ empleado, paginaActual, onNavegar, onLogout }) {
  const periodo = usePeriodo();

  const [hoverLogout, setHoverLogout] = useState(false);
  const [hoverTabs,   setHoverTabs]   = useState({});

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("empleado_id");
    localStorage.removeItem("empleado_nombre");
    localStorage.removeItem("empleado_rol");
    localStorage.removeItem("empleado_codigo");
    if (onLogout) onLogout();
  }

  return (
    <nav
      style={S.wrapper}
      role="navigation"
      aria-label="Navegación principal"
    >

      {/* ── Franja superior ─────────────────────────────────────────── */}
      <div style={S.topBar}>

        {/* Izquierda: logo */}
        <div style={S.logoWrap}>
          <div style={S.logoMark}>RP</div>
          <div>
            <div style={S.logoText}>PROESA</div>
            <div style={S.logoSub}>Relevamiento de Precios</div>
          </div>
        </div>

        {/* Derecha: badge período · divider · avatar · nombre/rol · divider · logout */}
        <div style={S.rightGroup}>

          {/* Badge período */}
          <div style={S.periodBadge}>
            📅 {periodo}
          </div>

          <div style={S.dividerV} />

          {/* Avatar */}
          <div style={S.avatarCircle} title={empleado?.nombre}>
            {iniciales(empleado?.nombre)}
          </div>

          {/* Nombre y rol */}
          <div style={S.empleadoInfo}>
            <span style={S.empleadoNombre}>{empleado?.nombre ?? "—"}</span>
            <span style={S.empleadoRol}>{empleado?.rol ?? ""}</span>
          </div>

          <div style={S.dividerV} />

          {/* Logout */}
          <button
            style={S.btnLogout(hoverLogout)}
            onClick={handleLogout}
            onMouseEnter={() => setHoverLogout(true)}
            onMouseLeave={() => setHoverLogout(false)}
            title="Cerrar sesión"
          >
            🚪 Salir
          </button>

        </div>
      </div>

      {/* ── Franja inferior: tabs ────────────────────────────────────── */}
      <div style={S.tabsBar} role="tablist">
        {TABS.map((tab) => {
          const activo = paginaActual === tab.id;
          const hover  = !!hoverTabs[tab.id];
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activo}
              style={S.tab(activo, hover)}
              onClick={() => onNavegar && onNavegar(tab.id)}
              onMouseEnter={() => setHoverTabs(h => ({ ...h, [tab.id]: true }))}
              onMouseLeave={() => setHoverTabs(h => ({ ...h, [tab.id]: false }))}
            >
              <span style={{ fontSize: "15px", lineHeight: 1 }}>{tab.icon}</span>
              {tab.label}
              {tab.id === "panel" && empleado?.rol === "admin" && (
                <span style={S.adminChip}>admin</span>
              )}
            </button>
          );
        })}
      </div>

    </nav>
  );
}