// -*- coding: utf-8 -*-
/**
 * GestionCatalogo.jsx — Alta, edición y borrado de productos y categorías
 * ---------------------------------------------------------------------------
 * Pantalla admin con dos pestañas:
 *   · Productos   — crear/editar/desactivar/reactivar, cambiar de categoría,
 *                    subir imagen.
 *   · Categorías  — crear/editar/borrar (solo si no tiene productos).
 *
 * No reemplaza "Asignaciones" (esa sigue siendo para decidir qué relevador
 * cubre cada categoría) ni el flujo de "Relevamiento" (carga de precios) —
 * esta pantalla es específicamente para mantener el catálogo en sí.
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

const FUENTE_OPCIONES = [
  { val: "PROESA",      label: "🏢 PROESA" },
  { val: "COMPETENCIA", label: "⚡ Competencia" },
  { val: "SEGUIDOR",    label: "◎ Seguidor" },
];

const RESPONSIVE_CSS = `
  .catalogo-cards-list { display: block; }
  .catalogo-table-wrap { display: none; }
  @media (min-width: 860px) {
    .catalogo-cards-list { display: none; }
    .catalogo-table-wrap { display: block; }
  }
`;

const S = {
  page: {
    minHeight: "100vh",
    background: C.gray50,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: "2rem",
  },
  header: {
    background: C.white, borderBottom: `1px solid ${C.border}`,
    padding: "16px 1rem",
  },
  titulo: { fontSize: "16px", fontWeight: 700, color: C.navy },
  subtitulo: { fontSize: "12.5px", color: C.gray400, marginTop: "3px" },

  tabsBar: {
    display: "flex", gap: "0", background: C.white,
    borderBottom: `1px solid ${C.border}`, padding: "0 1rem",
  },
  tab: (activo) => ({
    padding: "11px 16px", fontSize: "13.5px",
    fontWeight: activo ? 700 : 500,
    color: activo ? C.navy : C.gray400,
    borderBottom: activo ? `3px solid ${C.red}` : "3px solid transparent",
    background: "none", border: "none", cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  }),

  toolbar: {
    display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center",
    padding: "12px 1rem",
  },
  searchWrap: { position: "relative", flex: "1 1 180px", minWidth: "160px" },
  searchIcon: {
    position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)",
    fontSize: "13px", color: C.gray400, pointerEvents: "none",
  },
  searchInput: {
    width: "100%", height: "38px", boxSizing: "border-box",
    padding: "0 10px 0 30px", border: `1px solid ${C.border}`, borderRadius: "8px",
    fontSize: "13.5px", color: C.navy, background: C.white, outline: "none",
    fontFamily: "inherit",
  },
  select: (activo) => ({
    height: "38px", padding: "0 26px 0 10px",
    border: `1px solid ${activo ? C.red : C.border}`, borderRadius: "8px",
    fontSize: "13px", color: activo ? C.navy : C.gray600,
    background: activo ? C.redLight : C.white, outline: "none", cursor: "pointer",
    fontFamily: "inherit", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 9px center",
    minWidth: "0", flex: "1 1 120px", WebkitAppearance: "none",
  }),
  btnNuevo: {
    height: "38px", padding: "0 16px", background: C.red, color: C.white,
    border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700,
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
  },

  // ── Categorías: agrupado por rubro ────────────────────────────────────────
  rubroWrap: {
    margin: "0 1rem 14px", background: C.white, borderRadius: "12px",
    border: `1px solid ${C.border}`, overflow: "hidden",
  },
  rubroHeader: {
    padding: "11px 14px", background: C.gray50, borderBottom: `1px solid ${C.border}`,
    fontSize: "13px", fontWeight: 700, color: C.navy,
  },
  catFila: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "11px 14px", borderBottom: `1px solid ${C.gray100}`,
  },
  catNombre: { fontSize: "13.5px", color: C.navy, fontWeight: 600, flex: 1, minWidth: 0 },
  catMeta: { fontSize: "11.5px", color: C.gray400 },
  iconBtn: (color) => ({
    width: "30px", height: "30px", borderRadius: "8px",
    border: `1px solid ${C.gray200}`, background: C.white, color: color ?? C.gray600,
    fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent",
  }),

  // ── Productos: cards mobile ───────────────────────────────────────────────
  cardListWrap: { padding: "0 1rem", display: "flex", flexDirection: "column", gap: "8px" },
  prodCard: {
    border: `1px solid ${C.gray100}`, borderRadius: "10px", padding: "10px",
    background: C.white, display: "flex", gap: "10px",
    opacity: 1,
  },
  thumb: {
    width: "44px", height: "44px", flexShrink: 0, borderRadius: "8px",
    background: C.gray100, display: "flex", alignItems: "center",
    justifyContent: "center", overflow: "hidden",
  },
  prodInfo: { flex: 1, minWidth: 0 },
  prodNombre: { fontSize: "13px", fontWeight: 600, color: C.navy, lineHeight: 1.3 },
  prodMeta: { fontSize: "11px", color: C.gray400, marginTop: "2px" },
  chip: (bg, fg) => ({
    display: "inline-block", background: bg, color: fg,
    fontSize: "9.5px", fontWeight: 700, padding: "1px 7px",
    borderRadius: "20px", marginTop: "4px", marginRight: "4px",
  }),
  prodAcciones: { display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 },

  // ── Productos: tabla desktop ──────────────────────────────────────────────
  tableWrap: { margin: "0 1rem", background: C.white, borderRadius: "12px",
    border: `1px solid ${C.border}`, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12.5px" },
  th: {
    padding: "9px 12px", textAlign: "left", fontSize: "10.5px", fontWeight: 600,
    color: C.gray400, letterSpacing: "0.4px", textTransform: "uppercase",
    borderBottom: `1px solid ${C.border}`, background: C.gray50, whiteSpace: "nowrap",
  },
  td: (i, inactivo) => ({
    padding: "8px 12px", borderBottom: `1px solid ${C.gray100}`,
    color: inactivo ? C.gray400 : C.navy,
    background: i % 2 === 0 ? C.white : C.gray50, verticalAlign: "middle",
  }),

  estadoCenter: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "2.5rem 1rem", gap: "8px", color: C.gray400, textAlign: "center",
  },

  // ── Modal genérico ────────────────────────────────────────────────────────
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(26,26,46,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "1rem", zIndex: 300, overflowY: "auto",
  },
  modalBox: {
    width: "100%", maxWidth: "420px", background: C.white,
    borderRadius: "14px", padding: "20px",
    boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
    maxHeight: "90vh", overflowY: "auto",
  },
  modalTitulo: { fontSize: "15px", fontWeight: 700, color: C.navy, marginBottom: "14px" },
  campo: { marginBottom: "12px" },
  label: {
    display: "block", fontSize: "10.5px", fontWeight: 600, color: C.gray600,
    letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: "5px",
  },
  input: {
    width: "100%", height: "40px", boxSizing: "border-box", padding: "0 11px",
    border: `1px solid ${C.gray200}`, borderRadius: "8px", fontSize: "14px",
    color: C.navy, background: C.gray50, outline: "none", fontFamily: "inherit",
  },
  inputDisabled: {
    width: "100%", height: "40px", boxSizing: "border-box", padding: "0 11px",
    border: `1px solid ${C.gray200}`, borderRadius: "8px", fontSize: "14px",
    color: C.gray400, background: C.gray100, outline: "none", fontFamily: "inherit",
  },
  gridDos: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  modalError: {
    margin: "4px 0 12px", padding: "8px 10px", background: "#FFF5F5",
    borderLeft: `3px solid ${C.red}`, borderRadius: "0 6px 6px 0",
    fontSize: "12px", color: "#C0303B",
  },
  modalBotones: { display: "flex", gap: "8px", marginTop: "16px" },
  btnCancelar: {
    flex: 1, height: "42px", background: C.gray100, color: C.gray600,
    border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
    cursor: "pointer", WebkitTapHighlightColor: "transparent",
  },
  btnConfirmar: {
    flex: 1, height: "42px", background: C.red, color: C.white,
    border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700,
    cursor: "pointer", WebkitTapHighlightColor: "transparent",
  },
  imagenPreview: {
    width: "100%", height: "120px", borderRadius: "8px", background: C.gray100,
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden", marginBottom: "8px",
  },
  btnImagen: {
    width: "100%", height: "38px", background: C.white,
    border: `1px dashed ${C.gray200}`, borderRadius: "8px",
    fontSize: "12px", color: C.gray400, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
    WebkitTapHighlightColor: "transparent",
  },

  toast: (tipo) => ({
    position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
    background: tipo === "ok" ? C.green : C.red, color: C.white,
    fontSize: "13px", fontWeight: 600, padding: "9px 18px", borderRadius: "8px",
    boxShadow: "0 3px 12px rgba(0,0,0,0.18)", zIndex: 400, maxWidth: "90vw",
    textAlign: "center",
  }),
};

// ─── Campo de texto reutilizable ──────────────────────────────────────────────
function Campo({ label, children }) {
  return (
    <div style={S.campo}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

export default function GestionCatalogo({ empleado }) {
  const token   = localStorage.getItem("token") ?? "";
  const esAdmin = empleado?.rol?.toLowerCase() === "admin";

  const [vista, setVista] = useState("productos"); // "productos" | "categorias"
  const [toast, setToast] = useState(null);

  function mostrarToast(msg, tipo) {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2600);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORÍAS
  // ══════════════════════════════════════════════════════════════════════════
  const [categorias,    setCategorias]    = useState([]);
  const [rubros,        setRubros]        = useState([]);
  const [loadingCats,   setLoadingCats]   = useState(true);
  const [catForm,       setCatForm]       = useState(null); // null | {id?, nombre, rubro_id}
  const [catGuardando,  setCatGuardando]  = useState(false);
  const [catError,      setCatError]      = useState(null);

  const cargarCategorias = useCallback(async () => {
    setLoadingCats(true);
    try {
      const [respCats, respRubros] = await Promise.all([
        fetch(`${API}/api/categorias`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/rubros`,     { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (respCats.ok)   setCategorias(await respCats.json());
      if (respRubros.ok) setRubros(await respRubros.json());
    } catch (_) {
    } finally {
      setLoadingCats(false);
    }
  }, [token]);

  useEffect(() => { if (esAdmin) cargarCategorias(); }, [esAdmin, cargarCategorias]);

  const categoriasPorRubro = useMemo(() => {
    const acc = {};
    categorias.forEach(cat => {
      const rubro = cat.rubro_nombre || "Sin rubro";
      if (!acc[rubro]) acc[rubro] = [];
      acc[rubro].push(cat);
    });
    return acc;
  }, [categorias]);
  const rubrosOrdenados = Object.keys(categoriasPorRubro).sort();

  function abrirNuevaCategoria() {
    setCatForm({ nombre: "", rubro_id: rubros[0]?.id ?? "" });
    setCatError(null);
  }
  function abrirEditarCategoria(cat) {
    setCatForm({ id: cat.id, nombre: cat.nombre, rubro_id: cat.rubro_id });
    setCatError(null);
  }
  function cerrarFormCategoria() {
    if (catGuardando) return;
    setCatForm(null);
    setCatError(null);
  }

  async function guardarCategoria() {
    if (!catForm.nombre.trim() || !catForm.rubro_id) {
      setCatError("Completá nombre y rubro.");
      return;
    }
    setCatGuardando(true);
    setCatError(null);
    try {
      const esNueva = !catForm.id;
      const url = esNueva
        ? `${API}/api/categorias`
        : `${API}/api/categorias/${catForm.id}`;
      const resp = await fetch(url, {
        method: esNueva ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre:   catForm.nombre.trim(),
          rubro_id: parseInt(catForm.rubro_id, 10),
        }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail ?? "Error al guardar la categoría.");
      }
      await cargarCategorias();
      mostrarToast(esNueva ? "✓ Categoría creada" : "✓ Categoría actualizada", "ok");
      setCatForm(null);
    } catch (e) {
      setCatError(e.message);
    } finally {
      setCatGuardando(false);
    }
  }

  async function borrarCategoria(cat) {
    if (!confirm(`¿Borrar la categoría "${cat.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const resp = await fetch(`${API}/api/categorias/${cat.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail ?? "Error al borrar la categoría.");
      }
      await cargarCategorias();
      mostrarToast("✓ Categoría eliminada", "ok");
    } catch (e) {
      mostrarToast(e.message, "error");
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUCTOS
  // ══════════════════════════════════════════════════════════════════════════
  const [productos,        setProductos]        = useState([]);
  const [loadingProds,     setLoadingProds]      = useState(true);
  const [busquedaProd,     setBusquedaProd]      = useState("");
  const [categoriaFiltro,  setCategoriaFiltro]   = useState("");
  const [fuenteFiltro,     setFuenteFiltro]      = useState("");
  const [estadoFiltro,     setEstadoFiltro]      = useState("activos"); // activos | inactivos | todos
  const [prodForm,         setProdForm]          = useState(null);
  const [prodGuardando,    setProdGuardando]     = useState(false);
  const [prodError,        setProdError]         = useState(null);
  const [subiendoImagen,   setSubiendoImagen]    = useState(false);

  const cargarProductos = useCallback(async () => {
    setLoadingProds(true);
    try {
      const base = new URLSearchParams();
      if (busquedaProd.trim()) base.set("busqueda", busquedaProd.trim());
      if (categoriaFiltro)     base.set("categoria", categoriaFiltro);
      if (fuenteFiltro)        base.set("fuente", fuenteFiltro);

      let filas = [];
      if (estadoFiltro === "todos") {
        const [rAct, rInact] = await Promise.all([
          fetch(`${API}/api/productos?${base}&activo=true`,  { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/api/productos?${base}&activo=false`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const a = rAct.ok   ? await rAct.json()   : [];
        const b = rInact.ok ? await rInact.json() : [];
        filas = [...a, ...b];
      } else {
        const activo = estadoFiltro === "activos" ? "true" : "false";
        const resp = await fetch(`${API}/api/productos?${base}&activo=${activo}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        filas = resp.ok ? await resp.json() : [];
      }
      filas.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
      setProductos(filas);
    } catch (_) {
      setProductos([]);
    } finally {
      setLoadingProds(false);
    }
  }, [token, busquedaProd, categoriaFiltro, fuenteFiltro, estadoFiltro]);

  useEffect(() => { if (esAdmin) cargarProductos(); }, [esAdmin, cargarProductos]);

  function camposVacios() {
    return {
      categoria_id: categorias[0]?.id ?? "",
      fuente: "PROESA",
      marca: "", codigo: "", descripcion: "",
      grameaje_ml: "", unidades_caja: "", grupo: "",
    };
  }
  function abrirNuevoProducto() {
    setProdForm(camposVacios());
    setProdError(null);
  }
  function abrirEditarProducto(prod) {
    setProdForm({
      id: prod.id,
      categoria_id: prod.categoria_id,
      fuente: prod.fuente,
      marca: prod.marca ?? "",
      codigo: prod.codigo ?? "",
      descripcion: prod.descripcion ?? "",
      grameaje_ml: prod.grameaje_ml ?? "",
      unidades_caja: prod.unidades_caja ?? "",
      grupo: prod.grupo ?? "",
      imagen_url: prod.imagen_url ?? null,
    });
    setProdError(null);
  }
  function cerrarFormProducto() {
    if (prodGuardando || subiendoImagen) return;
    setProdForm(null);
    setProdError(null);
  }

  async function guardarProducto() {
    if (!prodForm.categoria_id || !prodForm.marca.trim() || !prodForm.descripcion.trim()) {
      setProdError("Completá al menos categoría, marca y descripción.");
      return;
    }
    setProdGuardando(true);
    setProdError(null);
    try {
      const esNuevo = !prodForm.id;
      const body = {
        categoria_id:   parseInt(prodForm.categoria_id, 10),
        marca:          prodForm.marca.trim(),
        codigo:         prodForm.codigo.trim() || null,
        descripcion:    prodForm.descripcion.trim(),
        grameaje_ml:    prodForm.grameaje_ml   !== "" ? parseFloat(prodForm.grameaje_ml)   : null,
        unidades_caja:  prodForm.unidades_caja !== "" ? parseFloat(prodForm.unidades_caja) : null,
        grupo:          prodForm.grupo.trim() || null,
      };
      if (esNuevo) body.fuente = prodForm.fuente;

      const url = esNuevo ? `${API}/api/productos` : `${API}/api/productos/${prodForm.id}`;
      const resp = await fetch(url, {
        method: esNuevo ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail ?? "Error al guardar el producto.");
      }
      const guardado = await resp.json();
      await cargarProductos();
      mostrarToast(esNuevo ? "✓ Producto creado" : "✓ Producto actualizado", "ok");

      if (esNuevo) {
        // Pasar a modo edición del que se acaba de crear, para poder
        // subirle una imagen sin tener que reabrir el formulario.
        setProdForm({
          id: guardado.id,
          categoria_id: guardado.categoria_id,
          fuente: guardado.fuente,
          marca: guardado.marca ?? "",
          codigo: guardado.codigo ?? "",
          descripcion: guardado.descripcion ?? "",
          grameaje_ml: guardado.grameaje_ml ?? "",
          unidades_caja: guardado.unidades_caja ?? "",
          grupo: guardado.grupo ?? "",
          imagen_url: guardado.imagen_url ?? null,
        });
      } else {
        setProdForm(null);
      }
    } catch (e) {
      setProdError(e.message);
    } finally {
      setProdGuardando(false);
    }
  }

  async function handleImagenProducto(e) {
    const archivo = e.target.files?.[0];
    if (!archivo || !prodForm?.id) return;
    setSubiendoImagen(true);
    const formData = new FormData();
    formData.append("imagen", archivo);
    try {
      const resp = await fetch(`${API}/api/productos/${prodForm.id}/imagen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!resp.ok) throw new Error("Error al subir la imagen.");
      const data = await resp.json();
      setProdForm(f => f ? { ...f, imagen_url: data.imagen_url } : f);
      mostrarToast("✓ Imagen actualizada", "ok");
    } catch (err) {
      mostrarToast(err.message, "error");
    } finally {
      setSubiendoImagen(false);
    }
  }

  async function toggleActivoProducto(prod) {
    const activar = !prod.activo;
    const verbo   = activar ? "reactivar" : "desactivar";
    if (!confirm(`¿Seguro que querés ${verbo} "${prod.descripcion}"?`)) return;
    try {
      const url = activar
        ? `${API}/api/productos/${prod.id}/reactivar`
        : `${API}/api/productos/${prod.id}`;
      const resp = await fetch(url, {
        method: activar ? "PUT" : "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail ?? "Error al actualizar el estado.");
      }
      await cargarProductos();
      mostrarToast(activar ? "✓ Producto reactivado" : "✓ Producto desactivado", "ok");
    } catch (e) {
      mostrarToast(e.message, "error");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (!esAdmin) {
    return (
      <div style={S.page}>
        <div style={S.estadoCenter}>
          <span style={{ fontSize: "28px" }}>🔒</span>
          <span style={{ fontSize: "13.5px", fontWeight: 600, color: C.navy }}>Acceso restringido</span>
          <span style={{ fontSize: "13px" }}>Solo los administradores pueden gestionar el catálogo.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <style>{RESPONSIVE_CSS}</style>

      <div style={S.header}>
        <div style={S.titulo}>Catálogo</div>
        <div style={S.subtitulo}>Crear, editar o borrar productos y categorías.</div>
      </div>

      <div style={S.tabsBar}>
        <button type="button" style={S.tab(vista === "productos")} onClick={() => setVista("productos")}>
          📦 Productos
        </button>
        <button type="button" style={S.tab(vista === "categorias")} onClick={() => setVista("categorias")}>
          🗂️ Categorías
        </button>
      </div>

      {/* ══════════════════════════ CATEGORÍAS ══════════════════════════ */}
      {vista === "categorias" && (
        <>
          <div style={S.toolbar}>
            <span style={{ fontSize: "12px", color: C.gray400, flex: 1 }}>
              {loadingCats ? "…" : `${categorias.length} categorías`}
            </span>
            <button type="button" style={S.btnNuevo} onClick={abrirNuevaCategoria}>
              + Nueva categoría
            </button>
          </div>

          {loadingCats ? (
            <div style={S.estadoCenter}><span>⏳ Cargando…</span></div>
          ) : rubrosOrdenados.length === 0 ? (
            <div style={S.estadoCenter}>
              <span style={{ fontSize: "28px" }}>🗂️</span>
              <span style={{ fontSize: "13px" }}>Todavía no hay categorías.</span>
            </div>
          ) : (
            rubrosOrdenados.map(rubro => (
              <div key={rubro} style={S.rubroWrap}>
                <div style={S.rubroHeader}>{rubro}</div>
                {categoriasPorRubro[rubro].map(cat => (
                  <div key={cat.id} style={S.catFila}>
                    <span style={S.catNombre}>{cat.nombre}</span>
                    <span style={S.catMeta}>
                      {(cat.empleados || []).length} relevador{(cat.empleados || []).length === 1 ? "" : "es"}
                    </span>
                    <button type="button" style={S.iconBtn()} title="Editar"
                      onClick={() => abrirEditarCategoria(cat)}>✎</button>
                    <button type="button" style={S.iconBtn(C.red)} title="Borrar"
                      onClick={() => borrarCategoria(cat)}>🗑</button>
                  </div>
                ))}
              </div>
            ))
          )}
        </>
      )}

      {/* ══════════════════════════ PRODUCTOS ═══════════════════════════ */}
      {vista === "productos" && (
        <>
          <div style={S.toolbar}>
            <div style={S.searchWrap}>
              <span style={S.searchIcon}>🔍</span>
              <input
                type="text" placeholder="Buscar producto o marca…"
                value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)}
                style={S.searchInput}
              />
            </div>
            <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}
              style={S.select(!!categoriaFiltro)}>
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
            <select value={fuenteFiltro} onChange={e => setFuenteFiltro(e.target.value)}
              style={S.select(!!fuenteFiltro)}>
              <option value="">Todas las fuentes</option>
              {FUENTE_OPCIONES.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
            </select>
            <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}
              style={S.select(estadoFiltro !== "activos")}>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
            <button type="button" style={S.btnNuevo} onClick={abrirNuevoProducto}>
              + Nuevo producto
            </button>
          </div>

          <div style={{ padding: "0 1rem 8px" }}>
            <span style={{ fontSize: "12px", color: C.gray400 }}>
              {loadingProds ? "…" : `${productos.length} productos`}
            </span>
          </div>

          {loadingProds ? (
            <div style={S.estadoCenter}><span>⏳ Cargando…</span></div>
          ) : productos.length === 0 ? (
            <div style={S.estadoCenter}>
              <span style={{ fontSize: "28px" }}>🔍</span>
              <span style={{ fontSize: "13px" }}>Sin resultados con esos filtros.</span>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="catalogo-cards-list" style={S.cardListWrap}>
                {productos.map(prod => (
                  <div key={prod.id} style={{ ...S.prodCard, opacity: prod.activo ? 1 : 0.55 }}>
                    <div style={S.thumb}>
                      {prod.imagen_url
                        ? <img src={prod.imagen_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        : <span style={{ fontSize: "16px" }}>🖼️</span>}
                    </div>
                    <div style={S.prodInfo}>
                      <div style={S.prodNombre}>{prod.descripcion}</div>
                      <div style={S.prodMeta}>{prod.marca} · {prod.categoria_nombre}</div>
                      <div>
                        <span style={S.chip(
                          prod.fuente === "PROESA" ? C.navy : prod.fuente === "COMPETENCIA" ? C.red : C.amber,
                          C.white,
                        )}>{prod.fuente}</span>
                        {!prod.activo && (
                          <span style={S.chip(C.gray200, C.gray600)}>INACTIVO</span>
                        )}
                      </div>
                    </div>
                    <div style={S.prodAcciones}>
                      <button type="button" style={S.iconBtn()} title="Editar"
                        onClick={() => abrirEditarProducto(prod)}>✎</button>
                      <button type="button" style={S.iconBtn(prod.activo ? C.red : C.green)}
                        title={prod.activo ? "Desactivar" : "Reactivar"}
                        onClick={() => toggleActivoProducto(prod)}>
                        {prod.activo ? "🗑" : "↺"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: tabla */}
              <div className="catalogo-table-wrap" style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {["", "Producto", "Marca", "Categoría", "Fuente", "Estado", "Acciones"].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((prod, i) => (
                      <tr key={prod.id}>
                        <td style={S.td(i, !prod.activo)}>
                          <div style={{ ...S.thumb, width: "34px", height: "34px" }}>
                            {prod.imagen_url
                              ? <img src={prod.imagen_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                              : <span style={{ fontSize: "13px" }}>🖼️</span>}
                          </div>
                        </td>
                        <td style={S.td(i, !prod.activo)}>{prod.descripcion}</td>
                        <td style={S.td(i, !prod.activo)}>{prod.marca}</td>
                        <td style={S.td(i, !prod.activo)}>{prod.categoria_nombre}</td>
                        <td style={S.td(i, !prod.activo)}>
                          <span style={S.chip(
                            prod.fuente === "PROESA" ? C.navy : prod.fuente === "COMPETENCIA" ? C.red : C.amber,
                            C.white,
                          )}>{prod.fuente}</span>
                        </td>
                        <td style={S.td(i, !prod.activo)}>
                          {prod.activo
                            ? <span style={S.chip(C.greenLight, C.green)}>Activo</span>
                            : <span style={S.chip(C.gray200, C.gray600)}>Inactivo</span>}
                        </td>
                        <td style={S.td(i, !prod.activo)}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button type="button" style={S.iconBtn()} title="Editar"
                              onClick={() => abrirEditarProducto(prod)}>✎</button>
                            <button type="button" style={S.iconBtn(prod.activo ? C.red : C.green)}
                              title={prod.activo ? "Desactivar" : "Reactivar"}
                              onClick={() => toggleActivoProducto(prod)}>
                              {prod.activo ? "🗑" : "↺"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════════ MODAL: categoría ═══════════════════════ */}
      {catForm && (
        <div style={S.modalOverlay} onClick={cerrarFormCategoria}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitulo}>{catForm.id ? "Editar categoría" : "Nueva categoría"}</div>

            <Campo label="Nombre">
              <input
                type="text" value={catForm.nombre}
                onChange={e => setCatForm(f => ({ ...f, nombre: e.target.value }))}
                style={S.input} placeholder="Ej: Bizcochito"
              />
            </Campo>

            <Campo label="Rubro">
              <select
                value={catForm.rubro_id}
                onChange={e => setCatForm(f => ({ ...f, rubro_id: e.target.value }))}
                style={{ ...S.input, appearance: "auto" }}
              >
                {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </Campo>

            {catError && <div style={S.modalError}>⚠ {catError}</div>}

            <div style={S.modalBotones}>
              <button type="button" style={S.btnCancelar} disabled={catGuardando} onClick={cerrarFormCategoria}>
                Cancelar
              </button>
              <button type="button" style={S.btnConfirmar} disabled={catGuardando} onClick={guardarCategoria}>
                {catGuardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ MODAL: producto ═════════════════════════ */}
      {prodForm && (
        <div style={S.modalOverlay} onClick={cerrarFormProducto}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitulo}>{prodForm.id ? "Editar producto" : "Nuevo producto"}</div>

            {prodForm.id && (
              <Campo label="Imagen">
                <div style={S.imagenPreview}>
                  {prodForm.imagen_url
                    ? <img src={prodForm.imagen_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <span style={{ fontSize: "24px" }}>🖼️</span>}
                </div>
                <label style={S.btnImagen}>
                  {subiendoImagen ? "Subiendo…" : "📷 Cambiar imagen"}
                  <input type="file" accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }} onChange={handleImagenProducto} disabled={subiendoImagen} />
                </label>
              </Campo>
            )}

            <Campo label="Categoría">
              <select
                value={prodForm.categoria_id}
                onChange={e => setProdForm(f => ({ ...f, categoria_id: e.target.value }))}
                style={{ ...S.input, appearance: "auto" }}
              >
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.rubro_nombre} — {c.nombre}</option>
                ))}
              </select>
            </Campo>

            <Campo label="Fuente">
              {prodForm.id ? (
                <input value={prodForm.fuente} disabled style={S.inputDisabled} />
              ) : (
                <select
                  value={prodForm.fuente}
                  onChange={e => setProdForm(f => ({ ...f, fuente: e.target.value }))}
                  style={{ ...S.input, appearance: "auto" }}
                >
                  {FUENTE_OPCIONES.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
                </select>
              )}
              {prodForm.id && (
                <div style={{ fontSize: "11px", color: C.gray400, marginTop: "4px" }}>
                  La fuente no se puede cambiar después de creado.
                </div>
              )}
            </Campo>

            <div style={S.gridDos}>
              <Campo label="Marca">
                <input type="text" value={prodForm.marca}
                  onChange={e => setProdForm(f => ({ ...f, marca: e.target.value }))} style={S.input} />
              </Campo>
              <Campo label="Código">
                <input type="text" value={prodForm.codigo}
                  onChange={e => setProdForm(f => ({ ...f, codigo: e.target.value }))} style={S.input} />
              </Campo>
            </div>

            <Campo label="Descripción">
              <input type="text" value={prodForm.descripcion}
                onChange={e => setProdForm(f => ({ ...f, descripcion: e.target.value }))} style={S.input} />
            </Campo>

            <div style={S.gridDos}>
              <Campo label="Grameaje / ML">
                <input type="number" min="0" step="0.01" value={prodForm.grameaje_ml}
                  onChange={e => setProdForm(f => ({ ...f, grameaje_ml: e.target.value }))} style={S.input} />
              </Campo>
              <Campo label="Unidades x caja">
                <input type="number" min="0" step="1" value={prodForm.unidades_caja}
                  onChange={e => setProdForm(f => ({ ...f, unidades_caja: e.target.value }))} style={S.input} />
              </Campo>
            </div>

            <Campo label="Grupo (para Price Index)">
              <input type="text" value={prodForm.grupo}
                onChange={e => setProdForm(f => ({ ...f, grupo: e.target.value }))}
                style={S.input} placeholder="Ej: Bizcochito" />
            </Campo>

            {prodError && <div style={S.modalError}>⚠ {prodError}</div>}

            <div style={S.modalBotones}>
              <button type="button" style={S.btnCancelar} disabled={prodGuardando} onClick={cerrarFormProducto}>
                {prodForm.id ? "Cerrar" : "Cancelar"}
              </button>
              <button type="button" style={S.btnConfirmar} disabled={prodGuardando} onClick={guardarProducto}>
                {prodGuardando ? "Guardando…" : prodForm.id ? "Guardar cambios" : "Crear producto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={S.toast(toast.tipo)}>{toast.msg}</div>}
    </div>
  );
}