// -*- coding: utf-8 -*-
/**
 * AsignacionCategorias.jsx — Asignar categorías a relevadores
 * ---------------------------------------------------------------
 * Pantalla admin: cada categoría se asigna a un único relevador.
 * Los productos de esa categoría solo serán visibles y editables
 * para ese relevador (el admin siempre ve todo).
 *
 * Props:
 *   empleado  { id, nombre, rol, codigo_empleado }
 */

import { useState, useEffect, useCallback, useMemo } from "react";

const C = {
  navy: "#1A1A2E", red: "#E63946", redLight: "rgba(230,57,70,0.10)",
  green: "#2A9D5C", greenLight: "rgba(42,157,92,0.10)",
  white: "#FFFFFF", gray50: "#F8F9FF", gray100: "#F0F0F0",
  gray200: "#E6E6E6", gray400: "#AAAAAA", border: "#E6E6E6",
};

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

const S = {
  page: { minHeight: "100vh", background: C.gray50,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: "2rem" },
  header: { background: C.white, borderBottom: `1px solid ${C.border}`, padding: "16px 1rem" },
  titulo: { fontSize: "16px", fontWeight: 700, color: C.navy },
  subtitulo: { fontSize: "12.5px", color: C.gray400, marginTop: "3px" },
  rubroWrap: { margin: "14px 1rem 0", background: C.white, borderRadius: "12px",
    border: `1px solid ${C.border}`, overflow: "hidden" },
  rubroHeader: { padding: "11px 14px", background: C.gray50,
    borderBottom: `1px solid ${C.border}`, fontSize: "13px", fontWeight: 700, color: C.navy },
  fila: { display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "10px", padding: "11px 14px", borderBottom: `1px solid ${C.gray100}` },
  catNombre: { fontSize: "13.5px", color: C.navy, fontWeight: 500 },
  select: (asignado) => ({
    height: "36px", padding: "0 26px 0 10px",
    border: `1px solid ${asignado ? C.green : C.border}`,
    borderRadius: "8px", fontSize: "13px",
    color: asignado ? C.navy : C.gray400,
    background: asignado ? C.greenLight : C.gray50,
    outline: "none", cursor: "pointer", fontFamily: "inherit",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
    minWidth: "160px", WebkitAppearance: "none",
  }),
  estadoCenter: { display: "flex", flexDirection: "column", alignItems: "center",
    padding: "3rem 1rem", gap: "8px", color: C.gray400, textAlign: "center" },
  toast: (tipo) => ({
    position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
    background: tipo === "ok" ? C.green : C.red, color: C.white,
    fontSize: "13px", fontWeight: 600, padding: "9px 18px", borderRadius: "8px",
    boxShadow: "0 3px 12px rgba(0,0,0,0.18)", zIndex: 100,
  }),
};

export default function AsignacionCategorias({ empleado }) {
  const token = localStorage.getItem("token") ?? "";
  const esAdmin = empleado?.rol?.toLowerCase() === "admin";

  const [categorias, setCategorias]   = useState([]);
  const [relevadores, setRelevadores] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [guardando, setGuardando]     = useState({});
  const [toast, setToast]             = useState(null);

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

  async function handleAsignar(categoriaId, empleadoId) {
    setGuardando(g => ({ ...g, [categoriaId]: true }));
    try {
      const resp = await fetch(`${API}/api/categorias/${categoriaId}/asignar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ empleado_id: empleadoId || null }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail ?? "Error al asignar.");
      }
      const actualizado = await resp.json();
      setCategorias(prev => prev.map(c => c.id === actualizado.id ? actualizado : c));
      mostrarToast("✓ Asignación guardada", "ok");
    } catch (e) {
      mostrarToast(e.message, "error");
    } finally {
      setGuardando(g => ({ ...g, [categoriaId]: false }));
    }
  }

  function mostrarToast(msg, tipo) {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2500);
  }

  const porRubro = useMemo(() => {
    const acc = {};
    categorias.forEach(cat => {
      const rubro = cat.rubro_nombre || "Sin rubro";
      if (!acc[rubro]) acc[rubro] = [];
      acc[rubro].push(cat);
    });
    return acc;
  }, [categorias]);

  const rubrosOrdenados = Object.keys(porRubro).sort();

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
          Cada categoría le pertenece a un solo relevador. Los productos de esa
          categoría solo serán visibles y editables para él.
        </div>
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
      ) : rubrosOrdenados.length === 0 ? (
        <div style={S.estadoCenter}>
          <span style={{ fontSize: "28px" }}>🗂️</span>
          <span style={{ fontSize: "13px" }}>No hay categorías registradas.</span>
        </div>
      ) : (
        rubrosOrdenados.map(rubro => (
          <div key={rubro} style={S.rubroWrap}>
            <div style={S.rubroHeader}>{rubro}</div>
            {porRubro[rubro].map(cat => (
              <div key={cat.id} style={S.fila}>
                <span style={S.catNombre}>{cat.nombre}</span>
                <select
                  value={cat.empleado_id ?? ""}
                  disabled={!!guardando[cat.id]}
                  onChange={e => handleAsignar(cat.id, e.target.value)}
                  style={S.select(!!cat.empleado_id)}
                >
                  <option value="">— Sin asignar —</option>
                  {relevadores.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ))
      )}

      {toast && <div style={S.toast(toast.tipo)}>{toast.msg}</div>}
    </div>
  );
}