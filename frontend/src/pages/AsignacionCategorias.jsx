// -*- coding: utf-8 -*-
/**
 * AsignacionCategorias.jsx — Asignar categorías a relevadores
 * ---------------------------------------------------------------
 * Pantalla admin: una categoría puede tener varios relevadores
 * asignados a la vez (ej. dos vendedores cubriendo la misma
 * categoría). Los productos de esa categoría son visibles y
 * editables — y su líder elegible — para cualquiera de sus
 * relevadores asignados.
 *
 * Interacción: cada categoría muestra un "chip" por relevador.
 * Tocar el chip lo agrega o lo quita del conjunto asignado a esa
 * categoría (PUT /api/categorias/:id/asignar con el conjunto
 * completo deseado).
 *
 * Props:
 *   empleado  { id, nombre, rol, codigo_empleado }
 */

import { useState, useEffect, useCallback, useMemo } from "react";

const C = {
  navy:       "#1A1A2E",
  red:        "#E63946",
  redLight:   "rgba(230,57,70,0.10)",
  green:      "#2A9D5C",
  greenLight: "rgba(42,157,92,0.10)",
  amber:      "#E9A825",
  amberLight: "rgba(233,168,37,0.14)",
  amberText:  "#8A5A00",
  white:      "#FFFFFF",
  gray50:     "#F8F9FF",
  gray100:    "#F0F0F0",
  gray200:    "#E6E6E6",
  gray400:    "#AAAAAA",
  gray600:    "#666666",
  border:     "#E6E6E6",
};

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

// ─── Paleta para diferenciar visualmente a cada relevador ────────────────────
// El mismo relevador conserva el mismo color en toda la pantalla
// (resumen de arriba + chips de cada categoría), para que sea fácil
// seguirlo con la vista.
const PALETA = [
  { bg: "#E8F0FE", fg: "#1A56DB", border: "#B4CCFB" },
  { bg: "#FCE8F3", fg: "#B4258A", border: "#F5B9DD" },
  { bg: "#E6F7EE", fg: "#0F7A47", border: "#A9E6C6" },
  { bg: "#FFF3E0", fg: "#B4650B", border: "#FCD9A6" },
  { bg: "#F1E8FE", fg: "#6B27C9", border: "#D6BFF7" },
  { bg: "#E0F7FA", fg: "#087F94", border: "#A6E7EF" },
];
function colorDe(empleadoId, relevadores) {
  const idx = relevadores.findIndex(r => r.id === empleadoId);
  return PALETA[idx >= 0 ? idx % PALETA.length : 0];
}

const S = {
  page: {
    minHeight: "100vh",
    background: C.gray50,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: "2rem",
  },
  header: {
    background: C.white,
    borderBottom: `1px solid ${C.border}`,
    padding: "16px 1rem",
  },
  titulo: { fontSize: "16px", fontWeight: 700, color: C.navy },
  subtitulo: { fontSize: "12.5px", color: C.gray400, marginTop: "3px", lineHeight: 1.4 },

  // ── Resumen por relevador ──────────────────────────────────────────────────
  resumenWrap: {
    display: "flex", flexWrap: "wrap", gap: "8px",
    padding: "12px 1rem 0",
  },
  resumenChip: (color, activo) => ({
    display: "flex", alignItems: "center", gap: "6px",
    padding: "7px 12px", borderRadius: "10px",
    background: color.bg, color: color.fg,
    border: `1.5px solid ${activo ? color.fg : color.border}`,
    boxShadow: activo ? `0 0 0 2px ${color.bg}` : "none",
    cursor: "pointer", fontSize: "12.5px", fontWeight: 600,
    transition: "all 0.15s", WebkitTapHighlightColor: "transparent",
  }),
  resumenCantidad: {
    fontSize: "11px", fontWeight: 700,
    background: "rgba(255,255,255,0.65)",
    padding: "1px 7px", borderRadius: "20px",
  },
  chipSinAsignarResumen: {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "7px 12px", borderRadius: "10px",
    background: C.amberLight, color: C.amberText,
    border: `1.5px solid ${C.amber}`,
    fontSize: "12.5px", fontWeight: 600,
  },
  limpiarFiltro: {
    fontSize: "12px", color: C.gray400, fontWeight: 600,
    background: "none", border: "none", cursor: "pointer",
    padding: "7px 4px", textDecoration: "underline",
    WebkitTapHighlightColor: "transparent",
  },

  // ── Buscador ───────────────────────────────────────────────────────────────
  buscadorWrap: { padding: "10px 1rem 0" },
  buscadorInput: {
    width: "100%", height: "38px", boxSizing: "border-box",
    padding: "0 12px", border: `1px solid ${C.border}`, borderRadius: "8px",
    fontSize: "13.5px", color: C.navy, background: C.white,
    outline: "none", fontFamily: "inherit",
  },

  // ── Grupo por rubro ────────────────────────────────────────────────────────
  rubroWrap: {
    margin: "14px 1rem 0", background: C.white, borderRadius: "12px",
    border: `1px solid ${C.border}`, overflow: "hidden",
  },
  rubroHeader: {
    padding: "11px 14px", background: C.gray50,
    borderBottom: `1px solid ${C.border}`,
    fontSize: "13px", fontWeight: 700, color: C.navy,
  },
  fila: {
    padding: "11px 14px", borderBottom: `1px solid ${C.gray100}`,
    display: "flex", flexDirection: "column", gap: "8px",
  },
  filaTop: {
    display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
  },
  catNombre: { fontSize: "13.5px", color: C.navy, fontWeight: 600, flex: 1, minWidth: "120px" },
  badgeSinAsignar: {
    fontSize: "10.5px", fontWeight: 700, color: C.amberText,
    background: C.amberLight, border: `1px solid ${C.amber}`,
    padding: "2px 8px", borderRadius: "20px", whiteSpace: "nowrap",
  },
  chipsWrap: { display: "flex", flexWrap: "wrap", gap: "6px" },
  chipRelevador: (asignado, color, cargando) => ({
    display: "inline-flex", alignItems: "center", gap: "5px",
    padding: "5px 11px", borderRadius: "20px",
    fontSize: "12px", fontWeight: 600,
    background: asignado ? color.bg : C.white,
    color: asignado ? color.fg : C.gray400,
    border: `1.5px solid ${asignado ? color.border : C.gray200}`,
    cursor: cargando ? "wait" : "pointer",
    opacity: cargando ? 0.6 : 1,
    transition: "all 0.15s",
    WebkitTapHighlightColor: "transparent",
  }),

  estadoCenter: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "3rem 1rem", gap: "8px", color: C.gray400, textAlign: "center",
  },
  linkReset: {
    fontSize: "12.5px", color: C.red, fontWeight: 600,
    background: "none", border: "none", cursor: "pointer",
    textDecoration: "underline", WebkitTapHighlightColor: "transparent",
  },
  toast: (tipo) => ({
    position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
    background: tipo === "ok" ? C.green : C.red, color: C.white,
    fontSize: "13px", fontWeight: 600, padding: "9px 18px", borderRadius: "8px",
    boxShadow: "0 3px 12px rgba(0,0,0,0.18)", zIndex: 100,
  }),
};

export default function AsignacionCategorias({ empleado }) {
  const token   = localStorage.getItem("token") ?? "";
  const esAdmin = empleado?.rol?.toLowerCase() === "admin";

  const [categorias, setCategorias]     = useState([]);
  const [relevadores, setRelevadores]   = useState([]);
  const [busqueda, setBusqueda]         = useState("");
  const [filtroRelevador, setFiltroRelevador] = useState(null); // id | null
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [guardando, setGuardando]       = useState({}); // key: `${catId}-${empId}`
  const [toast, setToast]               = useState(null);

  // ── Cargar categorías + relevadores ───────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [respCats, respEmps] = await Promise.all([
        fetch(`${API}/api/categorias`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/auth/empleados`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!respCats.ok || !respEmps.ok) throw new Error("Error al cargar los datos.");
      setCategorias(await respCats.json());
      setRelevadores((await respEmps.json()).filter(e => e.rol === "relevador"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (esAdmin) cargarDatos(); }, [esAdmin, cargarDatos]);

  // ── Toggle: agrega o quita a `relevadorId` del conjunto de la categoría ───
  async function handleToggle(categoria, relevadorId, yaAsignado) {
    const key = `${categoria.id}-${relevadorId}`;
    setGuardando(g => ({ ...g, [key]: true }));

    const idsActuales = (categoria.empleados || []).map(e => e.id);
    const nuevosIds = yaAsignado
      ? idsActuales.filter(id => id !== relevadorId)
      : [...idsActuales, relevadorId];

    try {
      const resp = await fetch(`${API}/api/categorias/${categoria.id}/asignar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ empleado_ids: nuevosIds }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail ?? "Error al actualizar la asignación.");
      }
      const actualizada = await resp.json();
      setCategorias(prev => prev.map(c => c.id === actualizada.id ? actualizada : c));
    } catch (e) {
      mostrarToast(e.message, "error");
    } finally {
      setGuardando(g => ({ ...g, [key]: false }));
    }
  }

  function mostrarToast(msg, tipo) {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2500);
  }

  function limpiarFiltros() {
    setBusqueda("");
    setFiltroRelevador(null);
  }

  // ── Filtrado (búsqueda + relevador seleccionado en el resumen) ────────────
  const categoriasFiltradas = useMemo(() => {
    let lista = categorias;
    if (filtroRelevador) {
      lista = lista.filter(c => (c.empleados || []).some(e => e.id === filtroRelevador));
    }
    if (busqueda.trim()) {
      const t = busqueda.trim().toLowerCase();
      lista = lista.filter(c => c.nombre.toLowerCase().includes(t));
    }
    return lista;
  }, [categorias, busqueda, filtroRelevador]);

  const porRubro = useMemo(() => {
    const acc = {};
    categoriasFiltradas.forEach(cat => {
      const rubro = cat.rubro_nombre || "Sin rubro";
      if (!acc[rubro]) acc[rubro] = [];
      acc[rubro].push(cat);
    });
    return acc;
  }, [categoriasFiltradas]);

  const rubrosOrdenados = Object.keys(porRubro).sort();

  // ── Resumen: cuántas categorías tiene cada relevador ──────────────────────
  const resumenPorRelevador = useMemo(() => (
    relevadores.map(r => ({
      ...r,
      cantidad: categorias.filter(c => (c.empleados || []).some(e => e.id === r.id)).length,
    }))
  ), [relevadores, categorias]);

  const sinAsignarCount = useMemo(
    () => categorias.filter(c => !(c.empleados || []).length).length,
    [categorias]
  );

  const hayFiltrosActivos = !!busqueda.trim() || !!filtroRelevador;

  // ─────────────────────────────────────────────────────────────────────────
  if (!esAdmin) {
    return (
      <div style={S.page}>
        <div style={S.estadoCenter}>
          <span style={{ fontSize: "28px" }}>🔒</span>
          <span style={{ fontSize: "13.5px", fontWeight: 600, color: C.navy }}>Acceso restringido</span>
          <span style={{ fontSize: "13px" }}>Solo los administradores pueden asignar categorías.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.titulo}>Asignación de categorías</div>
        <div style={S.subtitulo}>
          Una categoría puede tener más de un relevador a la vez. Tocá un
          nombre para agregarlo o quitarlo de esa categoría — cualquiera de
          los asignados podrá cargar precios y elegir el líder del grupo.
        </div>
      </div>

      {/* ── Resumen por relevador (tocar filtra la lista de abajo) ───────── */}
      {!loading && relevadores.length > 0 && (
        <div style={S.resumenWrap}>
          {resumenPorRelevador.map(r => {
            const color = colorDe(r.id, relevadores);
            const activo = filtroRelevador === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setFiltroRelevador(prev => prev === r.id ? null : r.id)}
                style={S.resumenChip(color, activo)}
              >
                <span>{r.nombre}</span>
                <span style={S.resumenCantidad}>
                  {r.cantidad} {r.cantidad === 1 ? "categoría" : "categorías"}
                </span>
              </button>
            );
          })}
          {sinAsignarCount > 0 && (
            <span style={S.chipSinAsignarResumen}>
              ⚠ {sinAsignarCount} {sinAsignarCount === 1 ? "categoría sin asignar" : "categorías sin asignar"}
            </span>
          )}
          {hayFiltrosActivos && (
            <button type="button" style={S.limpiarFiltro} onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Buscador ──────────────────────────────────────────────────────── */}
      <div style={S.buscadorWrap}>
        <input
          type="text"
          placeholder="Buscar categoría…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={S.buscadorInput}
        />
      </div>

      {error && (
        <div style={{ margin: "12px 1rem 0", padding: "10px 14px", background: "#FFF5F5",
          borderLeft: `4px solid ${C.red}`, borderRadius: "0 8px 8px 0",
          fontSize: "13px", color: "#C0303B" }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div style={S.estadoCenter}><span>⏳ Cargando…</span></div>
      ) : categorias.length === 0 ? (
        <div style={S.estadoCenter}>
          <span style={{ fontSize: "28px" }}>🗂️</span>
          <span style={{ fontSize: "13px" }}>No hay categorías registradas.</span>
        </div>
      ) : rubrosOrdenados.length === 0 ? (
        <div style={S.estadoCenter}>
          <span style={{ fontSize: "28px" }}>🔍</span>
          <span style={{ fontSize: "13px" }}>Ninguna categoría coincide con ese filtro.</span>
          <button type="button" style={S.linkReset} onClick={limpiarFiltros}>
            Quitar filtros
          </button>
        </div>
      ) : (
        rubrosOrdenados.map(rubro => (
          <div key={rubro} style={S.rubroWrap}>
            <div style={S.rubroHeader}>{rubro}</div>
            {porRubro[rubro].map(cat => {
              const asignadosIds = new Set((cat.empleados || []).map(e => e.id));
              return (
                <div key={cat.id} style={S.fila}>
                  <div style={S.filaTop}>
                    <span style={S.catNombre}>{cat.nombre}</span>
                    {asignadosIds.size === 0 && (
                      <span style={S.badgeSinAsignar}>Sin asignar</span>
                    )}
                  </div>
                  <div style={S.chipsWrap}>
                    {relevadores.map(rel => {
                      const asignado = asignadosIds.has(rel.id);
                      const key = `${cat.id}-${rel.id}`;
                      const color = colorDe(rel.id, relevadores);
                      const cargando = !!guardando[key];
                      return (
                        <button
                          key={rel.id}
                          type="button"
                          disabled={cargando}
                          aria-pressed={asignado}
                          onClick={() => handleToggle(cat, rel.id, asignado)}
                          style={S.chipRelevador(asignado, color, cargando)}
                        >
                          {asignado ? "✓ " : "+ "}{rel.nombre}
                        </button>
                      );
                    })}
                    {relevadores.length === 0 && (
                      <span style={{ fontSize: "12px", color: C.gray400 }}>
                        No hay relevadores activos para asignar.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {toast && <div style={S.toast(toast.tipo)}>{toast.msg}</div>}
    </div>
  );
}