// -*- coding: utf-8 -*-
/**
 * Navbar.jsx — Barra de navegación principal
 * -------------------------------------------
 * Franja superior:
 *   Mobile (<640px):  logo (izq) | avatar (der, abre menú desplegable)
 *   Desktop (≥640px): logo (izq) | badge período + avatar + nombre/rol + logout (der)
 * Franja inferior:  tabs Relevamiento · Panel de control
 *
 * Props:
 *   empleado      { id, nombre, rol, codigo_empleado }
 *   paginaActual  "relevamiento" | "panel"
 *   onNavegar     (pagina) => void
 *   onLogout      () => void
 */

import { useState, useRef, useEffect } from "react";

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
// DESPUÉS
const TABS = [
  { id: "relevamiento", label: "Relevamiento",     icon: "📋" },
  { id: "panel",        label: "Panel de control",  icon: "📊" },
  { id: "asignaciones", label: "Asignaciones",      icon: "🗂️", adminOnly: true },
];
// ─── Iconos SVG simples (consistentes, sin depender del set de emojis) ───────
const Icon = {
  Calendario: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M3 9.5h18M7.5 3v4M16.5 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Salida: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 16l5-4-5-4M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

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
    // Evita que esta barra, o cualquier hijo suyo, empuje el ancho de la
    // página y dispare scroll horizontal en toda la app.
    maxWidth: "100vw",
    boxSizing: "border-box",
    overflow: "hidden",
  },

  // ── Franja superior ──────────────────────────────────────────────────────
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 1rem",
    height: "52px",
    borderBottom: `1px solid ${C.gray100}`,
    gap: "10px",
  },

  // Logo (izquierda)
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minWidth: 0,
    overflow: "hidden",
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
    whiteSpace: "nowrap",
  },
  logoSub: {
    fontSize: "11px",
    color: C.gray400,
    fontWeight: 400,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  // Derecha: en mobile, solo el avatar (ver navbar-right-full / navbar-avatar-only)
  rightGroupFull: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexShrink: 0,
  },

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

  avatarBtn: {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
    position: "relative",
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

  // ── Menú desplegable del avatar (mobile) ──────────────────────────────────
  dropdownWrap: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    background: C.white,
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    border: `1px solid ${C.border}`,
    minWidth: "200px",
    padding: "12px",
    zIndex: 200,
    textAlign: "left",
  },
  dropdownHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    paddingBottom: "10px",
    borderBottom: `1px solid ${C.gray100}`,
    marginBottom: "8px",
  },
  dropdownNombre: {
    fontSize: "13.5px",
    fontWeight: 600,
    color: C.navy,
    lineHeight: 1.2,
  },
  dropdownRol: {
    fontSize: "11.5px",
    color: C.gray400,
    textTransform: "capitalize",
    lineHeight: 1.2,
  },
  dropdownPeriodo: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11.5px",
    color: C.red,
    fontWeight: 600,
    background: C.redLight,
    padding: "5px 10px",
    borderRadius: "8px",
    marginBottom: "8px",
  },
  dropdownLogoutBtn: (hover) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    background: hover ? C.redLight : C.gray50,
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    color: hover ? C.red : C.navy,
    padding: "9px 10px",
    borderRadius: "8px",
    transition: "color 0.15s, background 0.15s",
    WebkitTapHighlightColor: "transparent",
  }),

  // ── Franja inferior: tabs ────────────────────────────────────────────────
  // overflowX está puesto a propósito: si hubiera más tabs de las que entran,
  // que se deslice solo ESTA franja angosta, nunca la página completa.
  tabsBar: {
    display: "flex",
    alignItems: "flex-end",
    padding: "0 1rem",
    height: "42px",
    gap: "0",
    overflowX: "auto",
    maxWidth: "100%",
    boxSizing: "border-box",
  },

  tab: (activo, hover) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "0 1rem",
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
    flexShrink: 0,
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

// ─── CSS responsive ───────────────────────────────────────────────────────────
// Mobile-first: por defecto se muestra solo el avatar a la derecha.
// A partir de 640px, aparece el grupo completo (badge, nombre, logout)
// y se oculta el botón de avatar-con-menú.
const RESPONSIVE_CSS = `
  .navbar-right-full { display: none; }
  .navbar-avatar-only { display: flex; }

  @media (min-width: 640px) {
    .navbar-right-full { display: flex; }
    .navbar-avatar-only { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .navbar-dropdown { animation: none !important; }
  }
`;

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Navbar({ empleado, paginaActual, onNavegar, onLogout }) {
  const periodo = usePeriodo();

  const [hoverLogout,    setHoverLogout]    = useState(false);
  const [hoverDropLogout,setHoverDropLogout]= useState(false);
  const [hoverTabs,      setHoverTabs]      = useState({});
  const [menuAbierto,    setMenuAbierto]    = useState(false);
  const menuRef = useRef(null);

  // Cerrar el menú al tocar afuera
  useEffect(() => {
    if (!menuAbierto) return;
    function handleClickFuera(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    document.addEventListener("touchstart", handleClickFuera);
    return () => {
      document.removeEventListener("mousedown", handleClickFuera);
      document.removeEventListener("touchstart", handleClickFuera);
    };
  }, [menuAbierto]);

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
      <style>{RESPONSIVE_CSS}</style>

      {/* ── Franja superior ─────────────────────────────────────────── */}
      <div style={S.topBar}>

        {/* Izquierda: logo */}
        <div style={S.logoWrap}>
          <div style={S.logoMark}>RP</div>
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div style={S.logoText}>PROESA</div>
            <div style={S.logoSub}>Relevamiento de Precios</div>
          </div>
        </div>

        {/* ── Derecha en desktop (≥640px): grupo completo ──────────── */}
        <div className="navbar-right-full" style={S.rightGroupFull}>
          <div style={S.periodBadge}>
            <Icon.Calendario /> {periodo}
          </div>

          <div style={S.dividerV} />

          <div style={S.avatarCircle} title={empleado?.nombre}>
            {iniciales(empleado?.nombre)}
          </div>

          <div style={S.empleadoInfo}>
            <span style={S.empleadoNombre}>{empleado?.nombre ?? "—"}</span>
            <span style={S.empleadoRol}>{empleado?.rol ?? ""}</span>
          </div>

          <div style={S.dividerV} />

          <button
            style={S.btnLogout(hoverLogout)}
            onClick={handleLogout}
            onMouseEnter={() => setHoverLogout(true)}
            onMouseLeave={() => setHoverLogout(false)}
            title="Cerrar sesión"
          >
            <Icon.Salida /> Salir
          </button>
        </div>

        {/* ── Derecha en mobile (<640px): solo avatar + menú ───────── */}
        <div className="navbar-avatar-only" ref={menuRef} style={{ position: "relative" }}>
          <button
            style={S.avatarBtn}
            onClick={() => setMenuAbierto(v => !v)}
            aria-label="Abrir menú de cuenta"
            aria-expanded={menuAbierto}
            type="button"
          >
            <div style={S.avatarCircle} title={empleado?.nombre}>
              {iniciales(empleado?.nombre)}
            </div>
          </button>

          {menuAbierto && (
            <div className="navbar-dropdown" style={S.dropdownWrap}>
              <div style={S.dropdownHeader}>
                <div style={S.avatarCircle}>{iniciales(empleado?.nombre)}</div>
                <div>
                  <div style={S.dropdownNombre}>{empleado?.nombre ?? "—"}</div>
                  <div style={S.dropdownRol}>{empleado?.rol ?? ""}</div>
                </div>
              </div>

              <div style={S.dropdownPeriodo}>
                <Icon.Calendario /> {periodo}
              </div>

              <button
                style={S.dropdownLogoutBtn(hoverDropLogout)}
                onClick={handleLogout}
                onMouseEnter={() => setHoverDropLogout(true)}
                onMouseLeave={() => setHoverDropLogout(false)}
                type="button"
              >
                <Icon.Salida /> Cerrar sesión
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── Franja inferior: tabs ────────────────────────────────────── */}
      <div style={S.tabsBar} role="tablist">
        {TABS
          .filter(tab => !tab.adminOnly || empleado?.rol === "admin")
          .map((tab) => {
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
