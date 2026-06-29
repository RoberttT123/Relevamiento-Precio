// -*- coding: utf-8 -*-
/**
 * PanelControl.jsx — Panel de control e históricos
 * --------------------------------------------------
 * Cards de resumen del período
 * Tabla histórica filtrable por período / rubro / fuente
 *   → En mobile (<860px) se muestra como cards apiladas, una por producto.
 *   → En desktop (≥860px) se muestra como tabla completa (ver RESPONSIVE_CSS).
 * Gráfico de comparativa entre dos períodos (GraficoMargen)
 *
 * Props:
 *   empleado  { id, nombre, rol, codigo_empleado }
 */

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import GraficoMargen from "../components/GraficoMargen";

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

function periodoAnterior() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
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

  // ── Filtros ───────────────────────────────────────────────────────────────
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

  // ── Cards de resumen ──────────────────────────────────────────────────────
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
  cardIcon: { fontSize: "19px", marginBottom: "2px" },
  cardLabel: {
    fontSize: "10px",
    fontWeight: 600,
    color: C.gray400,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  cardValor: (color = C.navy) => ({
    fontSize: "21px",
    fontWeight: 700,
    color,
    lineHeight: 1.1,
  }),
  cardSub: {
    fontSize: "10.5px",
    color: C.gray400,
    marginTop: "2px",
  },

  // ── Sección comparativa ───────────────────────────────────────────────────
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
    fontSize: "13.5px",
    fontWeight: 600,
    color: C.navy,
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },
  comparativaSelects: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    width: "100%",
  },
  vsLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: C.gray400,
    padding: "0 2px",
  },
  btnComparar: (hover) => ({
    height: "36px",
    padding: "0 16px",
    background: hover ? C.redHover : C.red,
    color: C.white,
    border: "none",
    borderRadius: "7px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s",
    whiteSpace: "nowrap",
    flex: "1 1 auto",
  }),

  // ── Tabla histórica (desktop) ─────────────────────────────────────────────
  tableWrap: {
    overflowX: "auto",
    padding: "0 0 4px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12.5px",
  },
  th: {
    padding: "9px 14px",
    textAlign: "left",
    fontSize: "10.5px",
    fontWeight: 600,
    color: C.gray400,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: "nowrap",
    background: C.gray50,
  },
  td: (i) => ({
    padding: "9px 14px",
    borderBottom: `1px solid ${C.gray100}`,
    color: C.navy,
    background: i % 2 === 0 ? C.white : C.gray50,
    whiteSpace: "nowrap",
  }),
  chip: (color, bg) => ({
    display: "inline-block",
    background: bg,
    color,
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "20px",
    letterSpacing: "0.3px",
  }),
  margenCell: (pct) => ({
    fontWeight: 700,
    color: colorMargen(pct),
  }),

  // ── Cards de producto (mobile) ────────────────────────────────────────────
  cardListWrap: {
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  prodCard: {
    border: `1px solid ${C.gray100}`,
    borderRadius: "10px",
    padding: "11px 12px",
    background: C.white,
  },
  prodCardTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
  },
  prodCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  prodCardNombre: {
    fontSize: "13.5px",
    fontWeight: 600,
    color: C.navy,
    lineHeight: 1.3,
  },
  prodCardMeta: {
    fontSize: "11.5px",
    color: C.gray400,
    marginTop: "2px",
  },
  prodCardPreciosGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginTop: "8px",
  },
  precioBlock: {
    background: C.gray50,
    borderRadius: "8px",
    padding: "7px 9px",
  },
  precioBlockLabel: {
    fontSize: "9.5px",
    fontWeight: 600,
    color: C.gray400,
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    marginBottom: "3px",
  },
  precioBlockRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    fontSize: "12.5px",
    color: C.navy,
  },
  prodCardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "8px",
    fontSize: "11px",
    color: C.gray400,
  },

  // ── Estado vacío / carga ──────────────────────────────────────────────────
  estadoCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "2.5rem 1rem",
    gap: "8px",
    color: C.gray400,
    textAlign: "center",
  },

  // ── Skeleton ──────────────────────────────────────────────────────────────
  skeletonLine: (w, h = "14px") => ({
    height: h,
    width: w,
    borderRadius: "4px",
    background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
    display: "inline-block",
  }),

  // ── Acordeón de categoría (detalle histórico) ─────────────────────────────
  catWrap: {
    borderBottom: `1px solid ${C.gray100}`,
  },
  catHeader: (expandido) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    cursor: "pointer",
    background: expandido ? C.gray50 : C.white,
    WebkitTapHighlightColor: "transparent",
    minHeight: "48px",
  }),
  catNombre: {
    fontSize: "13.5px",
    fontWeight: 700,
    color: C.navy,
    flex: 1,
  },
  catContador: {
    fontSize: "11px",
    fontWeight: 600,
    color: C.gray400,
    background: C.gray100,
    padding: "2px 9px",
    borderRadius: "20px",
    whiteSpace: "nowrap",
  },
  catFlecha: (expandido) => ({
    fontSize: "15px",
    color: C.gray400,
    transform: expandido ? "rotate(180deg)" : "rotate(0deg)",
    transition: "transform 0.2s",
    lineHeight: 1,
    flexShrink: 0,
  }),
};

// ─── CSS responsive: alterna entre vista de cards (mobile) y tabla (desktop) ─
const RESPONSIVE_CSS = `
  .panel-cards-list { display: block; }
  .panel-table-wrap { display: none; }

  @media (min-width: 860px) {
    .panel-cards-list { display: none; }
    .panel-table-wrap { display: block; }
  }

  @media (min-width: 640px) {
    .panel-filter-bar {
      flex-wrap: nowrap !important;
    }
    .panel-select {
      flex: 0 1 170px !important;
    }
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
    result.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
    d.setMonth(d.getMonth() - 1);
  }
  return result;
}

// ─── Acordeón de categoría para el detalle histórico (vista mobile) ──────────
function CategoriaAcordeonHistorial({ categoria, filas, defaultAbierto }) {
  const [expandido, setExpandido] = useState(defaultAbierto);

  return (
    <div style={S.catWrap}>
      <div
        style={S.catHeader(expandido)}
        onClick={() => setExpandido(e => !e)}
      >
        <span style={S.catNombre}>{categoria}</span>
        <span style={S.catContador}>{filas.length}</span>
        <span style={S.catFlecha(expandido)}>⌄</span>
      </div>

      {expandido && (
        <div style={S.cardListWrap}>
          {filas.map((row, i) => (
            <ProductoCard key={i} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de producto para vista mobile ──────────────────────────────────────
function ProductoCard({ row }) {
  return (
    <div style={S.prodCard}>
      <div style={S.prodCardTop}>
        <div style={S.prodCardInfo}>
          <div style={S.prodCardNombre}>{row.descripcion}</div>
          <div style={S.prodCardMeta}>
            {row.marca}
            {row.grameaje_ml != null ? ` · ${row.grameaje_ml} g/ml` : ""}
          </div>
        </div>
        <span style={S.chip(
          row.fuente === "PROESA" ? C.white : C.red,
          row.fuente === "PROESA" ? C.navy : C.redLight,
        )}>
          {row.fuente === "PROESA" ? "✦ PROESA" : "⚡ Comp."}
        </span>
      </div>

      <div style={S.prodCardPreciosGrid}>
        <div style={{ ...S.precioBlock, background: bgMargen(row.margen_caja_pct) }}>
          <div style={S.precioBlockLabel}>Por caja</div>
          <div style={S.precioBlockRow}>
            <span>
              {row.precio_compra_caja != null
                ? `Bs ${row.precio_compra_caja.toFixed(2)}` : "—"}
              {" → "}
              {row.precio_venta_caja != null
                ? `Bs ${row.precio_venta_caja.toFixed(2)}` : "—"}
            </span>
          </div>
          <div style={{ ...S.margenCell(row.margen_caja_pct), fontSize: "13px", marginTop: "2px" }}>
            {row.margen_caja_pct != null ? `${row.margen_caja_pct.toFixed(1)}%` : "—"}
          </div>
        </div>

        <div style={{ ...S.precioBlock, background: bgMargen(row.margen_unidad_pct) }}>
          <div style={S.precioBlockLabel}>Por unidad</div>
          <div style={S.precioBlockRow}>
            <span>
              {row.precio_compra_unidad != null
                ? `Bs ${row.precio_compra_unidad.toFixed(2)}` : "—"}
              {" → "}
              {row.precio_venta_unidad != null
                ? `Bs ${row.precio_venta_unidad.toFixed(2)}` : "—"}
            </span>
          </div>
          <div style={{ ...S.margenCell(row.margen_unidad_pct), fontSize: "13px", marginTop: "2px" }}>
            {row.margen_unidad_pct != null ? `${row.margen_unidad_pct.toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>

      <div style={S.prodCardFooter}>
        <span>{row.rubro}</span>
        <span>
          {row.ultima_edicion
            ? new Date(row.ultima_edicion).toLocaleDateString("es-BO")
            : "—"}
        </span>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PanelControl({ empleado }) {
  const token    = localStorage.getItem("token") ?? "";
  const periodos = ultimosPeriodos();

  const [periodoSel, setPeriodoSel] = useState(periodoActual());
  const [rubroSel,   setRubroSel]   = useState("");
  const [fuenteSel,  setFuenteSel]  = useState("");
  const [categoriaSel, setCategoriaSel] = useState("");

  const [periodoA,   setPeriodoA]   = useState(periodoAnterior());
  const [periodoB,   setPeriodoB]   = useState(periodoActual());
  const [hoverComp,  setHoverComp]  = useState(false);

  const [resumen,      setResumen]      = useState(null);
  const [panelData,    setPanelData]    = useState([]);
  const [comparativa,  setComparativa]  = useState([]);
  const [loadRes,      setLoadRes]      = useState(true);
  const [loadPanel,    setLoadPanel]    = useState(true);
  const [loadComp,     setLoadComp]     = useState(false);

  const cargarResumen = useCallback(async () => {
    setLoadRes(true);
    try {
      const resp = await fetch(
        `${API}/api/historial/resumen/${periodoSel}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) setResumen(await resp.json());
      else setResumen(null);
    } catch (_) {
      setResumen(null);
    } finally {
      setLoadRes(false);
    }
  }, [periodoSel, token]);

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
    } catch (_) {
      setPanelData([]);
    } finally {
      setLoadPanel(false);
    }
  }, [periodoSel, rubroSel, fuenteSel, token]);

  async function cargarComparativa() {
    if (periodoA === periodoB) return;
    setLoadComp(true);
    try {
      const params = new URLSearchParams({
        periodo_a: periodoA,
        periodo_b: periodoB,
      });
      if (rubroSel)  params.set("rubro",  rubroSel);
      if (fuenteSel) params.set("fuente", fuenteSel);

      const resp = await fetch(
        `${API}/api/historial/comparativa?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) setComparativa(await resp.json());
      else setComparativa([]);
    } catch (_) {
      setComparativa([]);
    } finally {
      setLoadComp(false);
    }
  }

  useEffect(() => { cargarResumen(); }, [cargarResumen]);
  useEffect(() => { cargarPanel();   }, [cargarPanel]);

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

  // ── Agrupar el detalle histórico por categoría ───────────────────────────
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

  return (
    <div style={S.page}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} } ${RESPONSIVE_CSS}`}</style>

      <div className="panel-filter-bar" style={S.filterBar}>
        <span style={S.filterLabel}>Período</span>
        <select
          className="panel-select"
          value={periodoSel}
          onChange={e => setPeriodoSel(e.target.value)}
          style={S.select(true)}
        >
          {periodos.map(p => (
            <option key={p} value={p}>{periodoLabel(p)}</option>
          ))}
        </select>

        <select
          className="panel-select"
          value={rubroSel}
          onChange={e => setRubroSel(e.target.value)}
          style={S.select(!!rubroSel)}
        >
          <option value="">Todos los rubros</option>
          <option>Alimentos</option>
          <option>Bebidas y Tabacos</option>
          <option>Higiene y Limpieza</option>
        </select>

        <select
          className="panel-select"
          value={categoriaSel}
          onChange={e => setCategoriaSel(e.target.value)}
          style={S.select(!!categoriaSel)}
        >
          <option value="">Todas las categorías</option>
          {categoriasDisponibles.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          className="panel-select"
          value={fuenteSel}
          onChange={e => setFuenteSel(e.target.value)}
          style={S.select(!!fuenteSel)}
        >
          <option value="">PROESA + Competencia + Seguidor</option>
          <option value="PROESA">✦ Solo PROESA</option>
          <option value="COMPETENCIA">⚡ Solo Competencia</option>
          <option value="SEGUIDOR">◎ Solo Seguidor</option>
        </select>
      </div>

      <div style={S.cardsGrid}>
        <CardResumen
          icon="📦"
          label="Productos relevados"
          valor={resumen?.total_productos}
          sub={`${resumen?.productos_sin_precio ?? "—"} sin precio`}
        />
        <CardResumen
          icon="✦"
          label="PROESA"
          valor={resumen?.total_proesa}
          colorValor={C.navy}
        />
        <CardResumen
          icon="⚡"
          label="Competencia"
          valor={resumen?.total_competencia}
          colorValor={C.red}
        />
        <CardResumen
          icon="📊"
          label="Margen prom. caja"
          valor={
            resumen?.promedio_margen_caja_pct != null
              ? `${(resumen.promedio_margen_caja_pct * 100).toFixed(1)}%`
              : "—"
          }
          colorValor={colorMargen(
            resumen?.promedio_margen_caja_pct != null
              ? resumen.promedio_margen_caja_pct * 100
              : null
          )}
        />
        <CardResumen
          icon="✅"
          label="Finalizados"
          valor={resumen?.relevamientos_finalizados}
          sub={`${resumen?.relevamientos_borrador ?? "—"} en borrador`}
          colorValor={C.green}
        />
      </div>

      <div style={S.seccion}>
        <div style={S.seccionHeader}>
          <div style={S.seccionTitulo}>
            📈 Comparativa de precios
          </div>
          <div style={S.comparativaSelects}>
            <select
              value={periodoA}
              onChange={e => setPeriodoA(e.target.value)}
              style={{ ...S.select(true), flex: "1 1 auto" }}
            >
              {periodos.map(p => (
                <option key={p} value={p}>{periodoLabel(p)}</option>
              ))}
            </select>
            <span style={S.vsLabel}>vs</span>
            <select
              value={periodoB}
              onChange={e => setPeriodoB(e.target.value)}
              style={{ ...S.select(true), flex: "1 1 auto" }}
            >
              {periodos.map(p => (
                <option key={p} value={p}>{periodoLabel(p)}</option>
              ))}
            </select>
            <button
              style={S.btnComparar(hoverComp)}
              onClick={cargarComparativa}
              onMouseEnter={() => setHoverComp(true)}
              onMouseLeave={() => setHoverComp(false)}
              type="button"
            >
              Comparar
            </button>
          </div>
        </div>

        {loadComp ? (
          <div style={S.estadoCenter}>
            <span>⏳ Cargando comparativa…</span>
          </div>
        ) : comparativa.length > 0 ? (
          <GraficoMargen
            data={comparativa}
            periodoA={periodoA}
            periodoB={periodoB}
          />
        ) : (
          <div style={S.estadoCenter}>
            <span style={{ fontSize: "28px" }}>📊</span>
            <span style={{ fontSize: "13px", color: C.gray400 }}>
              Seleccioná dos períodos y presioná Comparar.
            </span>
          </div>
        )}
      </div>

      <div style={{ ...S.seccion, margin: "1rem 1rem 1.5rem" }}>
        <div style={S.seccionHeader}>
          <div style={S.seccionTitulo}>
            📋 Detalle — {periodoLabel(periodoSel)}
          </div>
          <span style={{ fontSize: "12px", color: C.gray400 }}>
            {loadPanel ? "…" : `${panelDataFiltrado.length} registros`}
          </span>
        </div>

        {loadPanel ? (
          <div style={{ padding: "16px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{
                display: "flex", gap: "12px", marginBottom: "10px",
                alignItems: "center",
              }}>
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
            {/* ── Vista mobile: acordeones por categoría ─────────────── */}
            <div className="panel-cards-list">
              {categoriasOrdenadas.map((cat, idx) => (
                <CategoriaAcordeonHistorial
                  key={cat}
                  categoria={cat}
                  filas={porCategoria[cat]}
                  defaultAbierto={idx === 0 && categoriasOrdenadas.length <= 4}
                />
              ))}
            </div>

            {/* ── Vista tabla (desktop, ≥860px), agrupada con separadores ── */}
            <div className="panel-table-wrap" style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {[
                      "Rubro","Categoría","Fuente","Marca","Producto",
                      "Gr/ML","P. Compra Caja","P. Venta Caja",
                      "Margen Caja","P. Compra Ud.","P. Venta Ud.",
                      "Margen Ud.","Última edición",
                    ].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoriasOrdenadas.map(cat => (
                    <Fragment key={cat}>
                      <tr>
                        <td colSpan={13} style={{
                          padding: "7px 14px",
                          background: C.gray100,
                          fontSize: "11px",
                          fontWeight: 700,
                          color: C.navy,
                          letterSpacing: "0.3px",
                          textTransform: "uppercase",
                        }}>
                          {cat} <span style={{ color: C.gray400, fontWeight: 500, textTransform: "none" }}>
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
                              row.fuente === "PROESA" ? C.white : C.red,
                              row.fuente === "PROESA" ? C.navy : C.redLight,
                            )}>
                              {row.fuente === "PROESA" ? "✦ PROESA" : "⚡ Comp."}
                            </span>
                          </td>
                          <td style={S.td(i)}>{row.marca}</td>
                          <td style={{ ...S.td(i), maxWidth: "200px",
                            overflow: "hidden", textOverflow: "ellipsis" }}>
                            {row.descripcion}
                          </td>
                          <td style={S.td(i)}>
                            {row.grameaje_ml != null ? `${row.grameaje_ml}` : "—"}
                          </td>
                          <td style={S.td(i)}>
                            {row.precio_compra_caja != null
                              ? `Bs ${row.precio_compra_caja.toFixed(2)}` : "—"}
                          </td>
                          <td style={S.td(i)}>
                            {row.precio_venta_caja != null
                              ? `Bs ${row.precio_venta_caja.toFixed(2)}` : "—"}
                          </td>
                          <td style={{ ...S.td(i), ...S.margenCell(row.margen_caja_pct) }}>
                            {row.margen_caja_pct != null
                              ? `${row.margen_caja_pct.toFixed(1)}%` : "—"}
                          </td>
                          <td style={S.td(i)}>
                            {row.precio_compra_unidad != null
                              ? `Bs ${row.precio_compra_unidad.toFixed(2)}` : "—"}
                          </td>
                          <td style={S.td(i)}>
                            {row.precio_venta_unidad != null
                              ? `Bs ${row.precio_venta_unidad.toFixed(2)}` : "—"}
                          </td>
                          <td style={{ ...S.td(i), ...S.margenCell(row.margen_unidad_pct) }}>
                            {row.margen_unidad_pct != null
                              ? `${row.margen_unidad_pct.toFixed(1)}%` : "—"}
                          </td>
                          <td style={{ ...S.td(i), color: C.gray400, fontSize: "11px" }}>
                            {row.ultima_edicion
                              ? new Date(row.ultima_edicion).toLocaleDateString("es-BO")
                              : "—"}
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