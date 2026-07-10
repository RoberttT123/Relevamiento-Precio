// -*- coding: utf-8 -*-
/**
 * PanelControl.jsx — Panel de control e históricos
 * --------------------------------------------------
 * Cards de resumen del período
 * Gráfico de evolución de precios por mes
 * Tabla histórica filtrable por período / rubro / fuente / categoría
 *   → En mobile (<860px) se muestra como acordeones por categoría.
 *   → En desktop (≥860px) se muestra como tabla completa.
 * Exportar tabla a XLSX
 *
 * Props:
 *   empleado  { id, nombre, rol, codigo_empleado }
 */

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import * as XLSX from "xlsx";
import GraficoEvolucion from "../components/GraficoEvolucion";

// ─── Tokens PROESA ────────────────────────────────────────────────────────────
const C = {
  navy:       "#1A1A2E",
  red:        "#E63946",
  redHover:   "#CC2F3B",
  redLight:   "rgba(230,57,70,0.10)",
  green:      "#2A9D5C",
  greenLight: "rgba(42,157,92,0.10)",
  amber:      "#E9A825",
  amberLight: "rgba(233,168,37,0.10)",
  white:      "#FFFFFF",
  gray50:     "#F8F9FF",
  gray100:    "#F0F0F0",
  gray200:    "#E6E6E6",
  gray400:    "#AAAAAA",
  gray600:    "#666666",
  border:     "#E6E6E6",
};

// ─── Base de API, sin barra final ────────────────────────────────────────────
const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

// ─── Helpers ──────────────────────────────────────────────────────────────────
function periodoActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodoLabel(yyyymm) {
  if (!yyyymm) return "—";
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const [y, m] = yyyymm.split("-");
  return `${MESES[parseInt(m) - 1]} ${y}`;
}

function colorMargen(pct) {
  if (pct === null || pct === undefined) return C.gray400;
  if (pct >= 20) return C.green;
  if (pct >= 10) return C.amber;
  return C.red;
}

function bgMargen(pct) {
  if (pct === null || pct === undefined) return C.gray100;
  if (pct >= 20) return C.greenLight;
  if (pct >= 10) return C.amberLight;
  return C.redLight;
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: C.gray50,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  filterBar: {
    background: C.white,
    borderBottom: `1px solid ${C.border}`,
    padding: "12px 1rem",
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
  },
  select: (activo) => ({
    height: "40px",
    padding: "0 28px 0 10px",
    border: `1px solid ${activo ? C.red : C.border}`,
    borderRadius: "8px",
    fontSize: "13.5px",
    color: activo ? C.navy : C.gray600,
    background: activo ? C.redLight : C.gray50,
    outline: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    minWidth: "0",
    flex: "1 1 140px",
    transition: "all 0.15s",
    WebkitAppearance: "none",
  }),
  filterLabel: {
    fontSize: "12px",
    color: C.gray400,
    fontWeight: 500,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: "10px",
    padding: "1rem 1rem 0",
  },
  card: {
    background: C.white,
    borderRadius: "12px",
    border: `1px solid ${C.border}`,
    padding: "13px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  cardIcon:  { fontSize: "19px", marginBottom: "2px" },
  cardLabel: {
    fontSize: "10px", fontWeight: 600, color: C.gray400,
    letterSpacing: "0.5px", textTransform: "uppercase",
  },
  cardValor: (color = C.navy) => ({
    fontSize: "21px", fontWeight: 700, color, lineHeight: 1.1,
  }),
  cardSub: { fontSize: "10.5px", color: C.gray400, marginTop: "2px" },
  seccion: {
    margin: "1rem 1rem 0",
    background: C.white,
    borderRadius: "12px",
    border: `1px solid ${C.border}`,
    overflow: "hidden",
  },
  seccionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    borderBottom: `1px solid ${C.border}`,
    flexWrap: "wrap",
    gap: "8px",
  },
  seccionTitulo: {
    fontSize: "13.5px", fontWeight: 600, color: C.navy,
    display: "flex", alignItems: "center", gap: "7px",
  },
  tableWrap: { overflowX: "auto", padding: "0 0 4px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12.5px" },
  th: {
    padding: "9px 14px", textAlign: "left",
    fontSize: "10.5px", fontWeight: 600, color: C.gray400,
    letterSpacing: "0.5px", textTransform: "uppercase",
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: "nowrap", background: C.gray50,
  },
  td: (i) => ({
    padding: "9px 14px",
    borderBottom: `1px solid ${C.gray100}`,
    color: C.navy,
    background: i % 2 === 0 ? C.white : C.gray50,
    whiteSpace: "nowrap",
  }),
  chip: (color, bg) => ({
    display: "inline-block", background: bg, color,
    fontSize: "10px", fontWeight: 700,
    padding: "2px 8px", borderRadius: "20px", letterSpacing: "0.3px",
  }),
  margenCell: (pct) => ({ fontWeight: 700, color: colorMargen(pct) }),
  cardListWrap: { padding: "10px", display: "flex", flexDirection: "column", gap: "8px" },
  prodCard: {
    border: `1px solid ${C.gray100}`, borderRadius: "10px",
    padding: "11px 12px", background: C.white,
  },
  prodCardTop: {
    display: "flex", alignItems: "flex-start",
    justifyContent: "space-between", gap: "8px", marginBottom: "8px",
  },
  prodCardInfo: { flex: 1, minWidth: 0 },
  prodCardNombre: { fontSize: "13.5px", fontWeight: 600, color: C.navy, lineHeight: 1.3 },
  prodCardMeta:   { fontSize: "11.5px", color: C.gray400, marginTop: "2px" },
  prodCardPreciosGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px",
  },
  precioBlock: { background: C.gray50, borderRadius: "8px", padding: "7px 9px" },
  precioBlockLabel: {
    fontSize: "9.5px", fontWeight: 600, color: C.gray400,
    letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: "3px",
  },
  precioBlockRow: {
    display: "flex", justifyContent: "space-between",
    alignItems: "baseline", fontSize: "12.5px", color: C.navy,
  },
  prodCardFooter: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginTop: "8px", fontSize: "11px", color: C.gray400,
  },
  estadoCenter: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "2.5rem 1rem", gap: "8px", color: C.gray400, textAlign: "center",
  },
  skeletonLine: (w, h = "14px") => ({
    height: h, width: w, borderRadius: "4px",
    background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
    backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", display: "inline-block",
  }),
  catWrap: { borderBottom: `1px solid ${C.gray100}` },
  catHeader: (expandido) => ({
    display: "flex", alignItems: "center", gap: "10px",
    padding: "12px 14px", cursor: "pointer",
    background: expandido ? C.gray50 : C.white,
    WebkitTapHighlightColor: "transparent", minHeight: "48px",
  }),
  catNombre:   { fontSize: "13.5px", fontWeight: 700, color: C.navy, flex: 1 },
  catContador: {
    fontSize: "11px", fontWeight: 600, color: C.gray400,
    background: C.gray100, padding: "2px 9px", borderRadius: "20px", whiteSpace: "nowrap",
  },
  catFlecha: (expandido) => ({
    fontSize: "15px", color: C.gray400,
    transform: expandido ? "rotate(180deg)" : "rotate(0deg)",
    transition: "transform 0.2s", lineHeight: 1, flexShrink: 0,
  }),
};

// ─── CSS responsive ────────────────────────────────────────────────────────────
const RESPONSIVE_CSS = `
  .panel-cards-list { display: block; }
  .panel-table-wrap { display: none; }
  @media (min-width: 860px) {
    .panel-cards-list { display: none; }
    .panel-table-wrap { display: block; }
  }
  @media (min-width: 640px) {
    .panel-filter-bar { flex-wrap: nowrap !important; }
    .panel-select { flex: 0 1 170px !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    .panel-shimmer { animation: none !important; }
  }
`;

// ─── Períodos disponibles (últimos 12 meses) ──────────────────────────────────
function ultimosPeriodos(n = 12) {
  const result = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return result;
}

// ─── Acordeón de categoría (mobile) ──────────────────────────────────────────
function CategoriaAcordeonHistorial({ categoria, filas, defaultAbierto }) {
  const [expandido, setExpandido] = useState(defaultAbierto);
  return (
    <div style={S.catWrap}>
      <div style={S.catHeader(expandido)} onClick={() => setExpandido(e => !e)}>
        <span style={S.catNombre}>{categoria}</span>
        <span style={S.catContador}>{filas.length}</span>
        <span style={S.catFlecha(expandido)}>⌄</span>
      </div>
      {expandido && (
        <div style={S.cardListWrap}>
          {filas.map((row, i) => <ProductoCard key={i} row={row} />)}
        </div>
      )}
    </div>
  );
}

// ─── Card de producto (mobile) ────────────────────────────────────────────────
function ProductoCard({ row }) {
  return (
    <div style={S.prodCard}>
      <div style={S.prodCardTop}>
        <div style={S.prodCardInfo}>
          <div style={S.prodCardNombre}>{row.descripcion}</div>
          <div style={S.prodCardMeta}>
            {row.marca}{row.grameaje_ml != null ? ` · ${row.grameaje_ml} g/ml` : ""}
          </div>
        </div>
        <span style={S.chip(
          row.fuente === "LIDER" ? C.white : C.red,
          row.fuente === "LIDER" ? C.navy  : C.redLight,
        )}>
          {row.fuente === "LIDER" ? "⭐ LÍDER" : "⚡ Comp."}
        </span>
      </div>
      <div style={S.prodCardPreciosGrid}>
        {[
          { label: "Por caja",   compra: row.precio_compra_caja,   venta: row.precio_venta_caja,   margen: row.margen_caja_pct   },
          { label: "Por unidad", compra: row.precio_compra_unidad, venta: row.precio_venta_unidad, margen: row.margen_unidad_pct },
        ].map(({ label, compra, venta, margen }) => (
          <div key={label} style={{ ...S.precioBlock, background: bgMargen(margen) }}>
            <div style={S.precioBlockLabel}>{label}</div>
            <div style={S.precioBlockRow}>
              <span>
                {compra != null ? `Bs ${compra.toFixed(2)}` : "—"}
                {" → "}
                {venta  != null ? `Bs ${venta.toFixed(2)}`  : "—"}
              </span>
            </div>
            <div style={{ ...S.margenCell(margen), fontSize: "13px", marginTop: "2px" }}>
              {margen != null ? `${margen.toFixed(1)}%` : "—"}
            </div>
          </div>
        ))}
      </div>
      <div style={S.prodCardFooter}>
        <span>{row.rubro}</span>
        <span>{row.ultima_edicion ? new Date(row.ultima_edicion).toLocaleDateString("es-BO") : "—"}</span>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PanelControl({ empleado }) {
  const token    = localStorage.getItem("token") ?? "";
  const periodos = ultimosPeriodos();

  const [periodoSel,      setPeriodoSel]      = useState(periodoActual());
  const [rubroSel,        setRubroSel]        = useState("");
  const [fuenteSel,       setFuenteSel]       = useState("");
  const [categoriaSel,    setCategoriaSel]    = useState("");

  // ── Gráfico de evolución ──────────────────────────────────────────────────
  const [categoriaGrafico, setCategoriaGrafico] = useState("");
  const [tipoPrecio,       setTipoPrecio]       = useState("caja");
  const [tipoGrafico,      setTipoGrafico]      = useState("lineas");
  const [evolucion,        setEvolucion]        = useState([]);
  const [loadEvol,         setLoadEvol]         = useState(false);
  const [errorEvol,        setErrorEvol]        = useState(null);

  // ── Datos del panel ───────────────────────────────────────────────────────
  const [resumen,   setResumen]   = useState(null);
  const [panelData, setPanelData] = useState([]);
  const [loadRes,   setLoadRes]   = useState(true);
  const [loadPanel, setLoadPanel] = useState(true);

  // ── Cargar resumen ────────────────────────────────────────────────────────
  const cargarResumen = useCallback(async () => {
    setLoadRes(true);
    try {
      const resp = await fetch(
        `${API}/api/historial/resumen/${periodoSel}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) setResumen(await resp.json());
      else setResumen(null);
    } catch (_) { setResumen(null); }
    finally { setLoadRes(false); }
  }, [periodoSel, token]);

  // ── Cargar panel ──────────────────────────────────────────────────────────
  const cargarPanel = useCallback(async () => {
    setLoadPanel(true);
    try {
      const params = new URLSearchParams({ periodo: periodoSel });
      if (rubroSel)  params.set("rubro",  rubroSel);
      if (fuenteSel) params.set("fuente", fuenteSel);
      const resp = await fetch(
        `${API}/api/historial/panel?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) setPanelData(await resp.json());
      else setPanelData([]);
    } catch (_) { setPanelData([]); }
    finally { setLoadPanel(false); }
  }, [periodoSel, rubroSel, fuenteSel, token]);

  // ── Cargar evolución ──────────────────────────────────────────────────────
  async function cargarEvolucion() {
    if (!categoriaGrafico.trim()) return;
    setLoadEvol(true);
    setErrorEvol(null);
    try {
      const params = new URLSearchParams({ categoria: categoriaGrafico, meses: "12" });
      if (fuenteSel) params.set("fuente", fuenteSel);
      if (rubroSel)  params.set("rubro",  rubroSel);
      const resp = await fetch(
        `${API}/api/historial/evolucion?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) {
        setEvolucion(await resp.json());
      } else {
        const err = await resp.json();
        setErrorEvol(err.detail ?? "Sin datos para esa categoría.");
        setEvolucion([]);
      }
    } catch (_) {
      setErrorEvol("Error de conexión al cargar el gráfico.");
      setEvolucion([]);
    } finally { setLoadEvol(false); }
  }

  // Pre-llenar categoría del gráfico cuando se filtra la tabla por categoría
  useEffect(() => {
    if (categoriaSel && categoriaSel !== categoriaGrafico)
      setCategoriaGrafico(categoriaSel);
  }, [categoriaSel]);

  useEffect(() => { cargarResumen(); }, [cargarResumen]);
  useEffect(() => { cargarPanel();   }, [cargarPanel]);

  // ── Agrupación por categoría ──────────────────────────────────────────────
  const categoriasDisponibles = useMemo(() => {
    const set = new Set(panelData.map(r => r.categoria || "Sin categoría"));
    return Array.from(set).sort();
  }, [panelData]);

  const panelDataFiltrado = useMemo(() => {
    if (!categoriaSel) return panelData;
    return panelData.filter(r => (r.categoria || "Sin categoría") === categoriaSel);
  }, [panelData, categoriaSel]);

  const porCategoria = useMemo(() => {
    const acc = {};
    panelDataFiltrado.forEach(row => {
      const cat = row.categoria || "Sin categoría";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(row);
    });
    return acc;
  }, [panelDataFiltrado]);

  const categoriasOrdenadas = useMemo(
    () => Object.keys(porCategoria).sort(),
    [porCategoria]
  );

  // ── Exportar a XLSX ───────────────────────────────────────────────────────
  function exportarXLSX(filas, periodo) {
    const HEADERS = [
      "Rubro", "Categoría", "Fuente", "Marca", "Producto",
      "Gr/ML", "P.Compra Caja", "P.Venta Caja", "Margen Caja %",
      "P.Compra Ud.", "P.Venta Ud.", "Margen Ud. %",
      "Index Real", "Index Marca", "Última edición",
    ];

    const rows = filas.map(r => ({
      "Rubro":           r.rubro,
      "Categoría":       r.categoria,
      "Fuente":          r.fuente,
      "Marca":           r.marca,
      "Producto":        r.descripcion,
      "Gr/ML":           r.grameaje_ml ?? "",
      "P.Compra Caja":   r.precio_compra_caja   ?? "",
      "P.Venta Caja":    r.precio_venta_caja     ?? "",
      "Margen Caja %":   r.margen_caja_pct   != null ? parseFloat(r.margen_caja_pct.toFixed(1))   : "",
      "P.Compra Ud.":    r.precio_compra_unidad  ?? "",
      "P.Venta Ud.":     r.precio_venta_unidad   ?? "",
      "Margen Ud. %":    r.margen_unidad_pct != null ? parseFloat(r.margen_unidad_pct.toFixed(1)) : "",
      "Index Real":      r.index_real  != null ? parseFloat(r.index_real.toFixed(2))  : "",
      "Index Marca":     r.index_marca != null ? parseFloat(r.index_marca.toFixed(2)) : "",
      "Última edición":  r.ultima_edicion
                           ? new Date(r.ultima_edicion).toLocaleDateString("es-BO") : "",
    }));

    const hoja  = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, `Relevamiento ${periodo}`);

    // Ancho de columnas automático
    const colWidths = HEADERS.map(h => ({
      wch: Math.min(
        Math.max(h.length, ...rows.map(r => String(r[h] ?? "").length)) + 2,
        40
      ),
    }));
    hoja["!cols"] = colWidths;

    XLSX.writeFile(libro, `relevamiento_${periodo}.xlsx`);
  }

  // ── Card de resumen ───────────────────────────────────────────────────────
  function CardResumen({ icon, label, valor, sub, colorValor }) {
    return (
      <div style={S.card}>
        <span style={S.cardIcon}>{icon}</span>
        <span style={S.cardLabel}>{label}</span>
        <span style={S.cardValor(colorValor)}>
          {loadRes
            ? <span className="panel-shimmer" style={S.skeletonLine("60%", "26px")} />
            : valor ?? "—"}
        </span>
        {sub && <span style={S.cardSub}>{sub}</span>}
      </div>
    );
  }

  // ── Toggle visual de tipo de precio/gráfico ───────────────────────────────
  function ToggleGroup({ opciones, valor, onChange }) {
    return (
      <div style={{
        display: "flex", background: C.gray100,
        borderRadius: "8px", padding: "3px", gap: "2px", flexShrink: 0,
      }}>
        {opciones.map(({ val, label }) => (
          <button
            key={val} type="button"
            onClick={() => onChange(val)}
            style={{
              padding: "4px 12px", borderRadius: "6px", border: "none",
              fontSize: "11.5px", fontWeight: valor === val ? 600 : 400,
              color: valor === val ? C.navy : C.gray400,
              background: valor === val ? C.white : "transparent",
              cursor: "pointer",
              boxShadow: valor === val ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}
          >{label}</button>
        ))}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}${RESPONSIVE_CSS}`}</style>

      {/* ── Barra de filtros ─────────────────────────────────────────── */}
      <div className="panel-filter-bar" style={S.filterBar}>
        <span style={S.filterLabel}>Período</span>
        <select className="panel-select" value={periodoSel}
          onChange={e => setPeriodoSel(e.target.value)} style={S.select(true)}>
          {periodos.map(p => <option key={p} value={p}>{periodoLabel(p)}</option>)}
        </select>
        <select className="panel-select" value={rubroSel}
          onChange={e => setRubroSel(e.target.value)} style={S.select(!!rubroSel)}>
          <option value="">Todos los rubros</option>
          <option>Alimentos</option>
          <option>Bebidas y Tabacos</option>
          <option>Higiene y Limpieza</option>
        </select>
        <select className="panel-select" value={categoriaSel}
          onChange={e => setCategoriaSel(e.target.value)} style={S.select(!!categoriaSel)}>
          <option value="">Todas las categorías</option>
          {categoriasDisponibles.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select className="panel-select" value={fuenteSel}
          onChange={e => setFuenteSel(e.target.value)} style={S.select(!!fuenteSel)}>
          <option value="">LÍDER + Competencia + Seguidor</option>
          <option value="LIDER">⭐ Solo Líder</option>
          <option value="COMPETENCIA">⚡ Solo Competencia</option>
          <option value="SEGUIDOR">◎ Solo Seguidor</option>
        </select>
      </div>

      {/* ── Cards de resumen ─────────────────────────────────────────── */}
      <div style={S.cardsGrid}>
        <CardResumen icon="📦" label="Productos relevados"
          valor={resumen?.total_productos}
          sub={`${resumen?.productos_sin_precio ?? "—"} sin precio`} />
        <CardResumen icon="⭐" label="Líder"
          valor={resumen?.total_lider} colorValor={C.navy} />
        <CardResumen icon="⚡" label="Competencia"
          valor={resumen?.total_competencia} colorValor={C.red} />
        <CardResumen icon="📊" label="Margen prom. caja"
          valor={resumen?.promedio_margen_caja_pct != null
            ? `${(resumen.promedio_margen_caja_pct * 100).toFixed(1)}%` : "—"}
          colorValor={colorMargen(
            resumen?.promedio_margen_caja_pct != null
              ? resumen.promedio_margen_caja_pct * 100 : null
          )} />
        <CardResumen icon="✅" label="Finalizados"
          valor={resumen?.relevamientos_finalizados}
          sub={`${resumen?.relevamientos_borrador ?? "—"} en borrador`}
          colorValor={C.green} />
      </div>

      {/* ── Gráfico de evolución de precios ──────────────────────────── */}
      <div style={S.seccion}>
        <div style={S.seccionHeader}>
          <div style={S.seccionTitulo}>📈 Evolución de precios por mes</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", width: "100%" }}>
            <select
              value={categoriaGrafico}
              onChange={e => setCategoriaGrafico(e.target.value)}
              style={{ ...S.select(!!categoriaGrafico), flex: "1 1 140px" }}
            >
              <option value="">Elegí una categoría…</option>
              {categoriasDisponibles.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <ToggleGroup
              opciones={[{ val: "caja", label: "Caja" }, { val: "unidad", label: "Unidad" }]}
              valor={tipoPrecio} onChange={setTipoPrecio}
            />
            <ToggleGroup
              opciones={[{ val: "lineas", label: "〜 Líneas" }, { val: "barras", label: "▌ Barras" }]}
              valor={tipoGrafico} onChange={setTipoGrafico}
            />
            <button
              onClick={cargarEvolucion}
              disabled={!categoriaGrafico || loadEvol}
              type="button"
              style={{
                height: "36px", padding: "0 16px",
                background: !categoriaGrafico ? C.gray100 : C.red,
                color: !categoriaGrafico ? C.gray400 : C.white,
                border: "none", borderRadius: "7px",
                fontSize: "13px", fontWeight: 600,
                cursor: !categoriaGrafico || loadEvol ? "not-allowed" : "pointer",
                transition: "background 0.15s", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {loadEvol ? "Cargando…" : "Graficar"}
            </button>
          </div>
        </div>
        {loadEvol ? (
          <div style={S.estadoCenter}><span>⏳ Cargando datos…</span></div>
        ) : errorEvol ? (
          <div style={S.estadoCenter}>
            <span style={{ fontSize: "26px" }}>📊</span>
            <span style={{ fontSize: "13px", color: C.gray400 }}>{errorEvol}</span>
          </div>
        ) : evolucion.length > 0 ? (
          <GraficoEvolucion data={evolucion} tipoPrecio={tipoPrecio} tipoGrafico={tipoGrafico} />
        ) : (
          <div style={S.estadoCenter}>
            <span style={{ fontSize: "28px" }}>📈</span>
            <span style={{ fontSize: "13px", color: C.gray400 }}>
              Elegí una categoría y presioná Graficar para ver la evolución de precios.
            </span>
          </div>
        )}
      </div>

      {/* ── Detalle histórico ────────────────────────────────────────── */}
      <div style={{ ...S.seccion, margin: "1rem 1rem 1.5rem" }}>
        <div style={S.seccionHeader}>
          <div style={S.seccionTitulo}>
            📋 Detalle — {periodoLabel(periodoSel)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", color: C.gray400 }}>
              {loadPanel ? "…" : `${panelDataFiltrado.length} registros`}
            </span>
            {!loadPanel && panelDataFiltrado.length > 0 && (
              <button
                onClick={() => exportarXLSX(panelDataFiltrado, periodoSel)}
                type="button"
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  background: C.green, color: C.white,
                  border: "none", borderRadius: "7px",
                  padding: "5px 12px", fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                ↓ Excel
              </button>
            )}
          </div>
        </div>

        {loadPanel ? (
          <div style={{ padding: "16px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "10px", alignItems: "center" }}>
                <span className="panel-shimmer" style={S.skeletonLine("20%")} />
                <span className="panel-shimmer" style={S.skeletonLine("35%")} />
                <span className="panel-shimmer" style={S.skeletonLine("15%")} />
                <span className="panel-shimmer" style={S.skeletonLine("15%")} />
              </div>
            ))}
          </div>
        ) : panelDataFiltrado.length === 0 ? (
          <div style={S.estadoCenter}>
            <span style={{ fontSize: "26px" }}>🗂️</span>
            <span style={{ fontSize: "13px" }}>
              Sin datos para {periodoLabel(periodoSel)} con los filtros aplicados.
            </span>
          </div>
        ) : (
          <>
            {/* Vista mobile: acordeones */}
            <div className="panel-cards-list">
              {categoriasOrdenadas.map((cat, idx) => (
                <CategoriaAcordeonHistorial
                  key={cat} categoria={cat} filas={porCategoria[cat]}
                  defaultAbierto={idx === 0 && categoriasOrdenadas.length <= 4}
                />
              ))}
            </div>

            {/* Vista desktop: tabla agrupada */}
            <div className="panel-table-wrap" style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {["Rubro","Categoría","Fuente","Marca","Producto","Gr/ML",
                      "P. Compra Caja","P. Venta Caja","Margen Caja",
                      "P. Compra Ud.","P. Venta Ud.","Margen Ud.",
                      "Index Real","Index Marca","Última edición"
                    ].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {categoriasOrdenadas.map(cat => (
                    <Fragment key={cat}>
                      <tr>
                        <td colSpan={15} style={{
                          padding: "7px 14px", background: C.gray100,
                          fontSize: "11px", fontWeight: 700, color: C.navy,
                          letterSpacing: "0.3px", textTransform: "uppercase",
                        }}>
                          {cat}{" "}
                          <span style={{ color: C.gray400, fontWeight: 500, textTransform: "none" }}>
                            ({porCategoria[cat].length})
                          </span>
                        </td>
                      </tr>
                      {porCategoria[cat].map((row, i) => (
                        <tr key={i}>
                          <td style={S.td(i)}>{row.rubro}</td>
                          <td style={S.td(i)}>{row.categoria}</td>
                          <td style={S.td(i)}>
                            <span style={S.chip(
                              row.fuente === "LIDER" ? C.white : C.red,
                              row.fuente === "LIDER" ? C.navy  : C.redLight,
                            )}>
                              {row.fuente === "LIDER" ? "⭐ LÍDER" : "⚡ Comp."}
                            </span>
                          </td>
                          <td style={S.td(i)}>{row.marca}</td>
                          <td style={{ ...S.td(i), maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {row.descripcion}
                          </td>
                          <td style={S.td(i)}>{row.grameaje_ml != null ? row.grameaje_ml : "—"}</td>
                          <td style={S.td(i)}>{row.precio_compra_caja   != null ? `Bs ${row.precio_compra_caja.toFixed(2)}`   : "—"}</td>
                          <td style={S.td(i)}>{row.precio_venta_caja    != null ? `Bs ${row.precio_venta_caja.toFixed(2)}`    : "—"}</td>
                          <td style={{ ...S.td(i), ...S.margenCell(row.margen_caja_pct) }}>
                            {row.margen_caja_pct != null ? `${row.margen_caja_pct.toFixed(1)}%` : "—"}
                          </td>
                          <td style={S.td(i)}>{row.precio_compra_unidad != null ? `Bs ${row.precio_compra_unidad.toFixed(2)}` : "—"}</td>
                          <td style={S.td(i)}>{row.precio_venta_unidad  != null ? `Bs ${row.precio_venta_unidad.toFixed(2)}`  : "—"}</td>
                          <td style={{ ...S.td(i), ...S.margenCell(row.margen_unidad_pct) }}>
                            {row.margen_unidad_pct != null ? `${row.margen_unidad_pct.toFixed(1)}%` : "—"}
                          </td>
                          <td style={{ ...S.td(i), fontWeight: 700,
                            color: row.index_real != null
                              ? row.index_real <= 100 ? C.green
                              : row.index_real <= 130 ? C.amber : C.red
                              : C.gray400 }}>
                            {row.index_real != null ? `${row.index_real.toFixed(1)}%` : "—"}
                          </td>
                          <td style={S.td(i)}>
                            {row.index_marca != null ? `${row.index_marca.toFixed(1)}%` : "—"}
                          </td>
                          <td style={{ ...S.td(i), color: C.gray400, fontSize: "11px" }}>
                            {row.ultima_edicion ? new Date(row.ultima_edicion).toLocaleDateString("es-BO") : "—"}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>
  );
}