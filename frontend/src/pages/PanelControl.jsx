// -*- coding: utf-8 -*-
/**
 * PanelControl.jsx — Panel de control e históricos
 * --------------------------------------------------
 * Cards de resumen del período
 * Tabla histórica filtrable por período / rubro / fuente
 * Gráfico de comparativa entre dos períodos (GraficoMargen)
 *
 * Props:
 *   empleado  { id, nombre, rol, codigo_empleado }
 */

import { useState, useEffect, useCallback } from "react";
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

const API = import.meta.env.VITE_API_URL ?? "";

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
    padding: "12px 1.5rem",
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
  },
  select: (activo) => ({
    height: "36px",
    padding: "0 28px 0 10px",
    border: `1px solid ${activo ? C.red : C.border}`,
    borderRadius: "8px",
    fontSize: "13px",
    color: activo ? C.navy : C.gray600,
    background: activo ? C.redLight : C.gray50,
    outline: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    minWidth: "130px",
    transition: "all 0.15s",
  }),
  filterLabel: {
    fontSize: "12px",
    color: C.gray400,
    fontWeight: 500,
    whiteSpace: "nowrap",
  },

  // ── Cards de resumen ──────────────────────────────────────────────────────
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "12px",
    padding: "1.2rem 1.5rem 0",
  },
  card: {
    background: C.white,
    borderRadius: "12px",
    border: `1px solid ${C.border}`,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  cardIcon: { fontSize: "20px", marginBottom: "2px" },
  cardLabel: {
    fontSize: "10.5px",
    fontWeight: 600,
    color: C.gray400,
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },
  cardValor: (color = C.navy) => ({
    fontSize: "24px",
    fontWeight: 700,
    color,
    lineHeight: 1.1,
  }),
  cardSub: {
    fontSize: "11px",
    color: C.gray400,
    marginTop: "2px",
  },

  // ── Sección comparativa ───────────────────────────────────────────────────
  seccion: {
    margin: "1.2rem 1.5rem 0",
    background: C.white,
    borderRadius: "12px",
    border: `1px solid ${C.border}`,
    overflow: "hidden",
  },
  seccionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: `1px solid ${C.border}`,
    flexWrap: "wrap",
    gap: "8px",
  },
  seccionTitulo: {
    fontSize: "14px",
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
  },
  vsLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: C.gray400,
    padding: "0 2px",
  },
  btnComparar: (hover) => ({
    height: "32px",
    padding: "0 14px",
    background: hover ? C.redHover : C.red,
    color: C.white,
    border: "none",
    borderRadius: "7px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s",
    whiteSpace: "nowrap",
  }),

  // ── Tabla histórica ───────────────────────────────────────────────────────
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
};

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

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PanelControl({ empleado }) {
  const token    = localStorage.getItem("token") ?? "";
  const periodos = ultimosPeriodos();

  // ── Filtros del panel ─────────────────────────────────────────────────────
  const [periodoSel, setPeriodoSel] = useState(periodoActual());
  const [rubroSel,   setRubroSel]   = useState("");
  const [fuenteSel,  setFuenteSel]  = useState("");

  // ── Filtros comparativa ───────────────────────────────────────────────────
  const [periodoA,   setPeriodoA]   = useState(periodoAnterior());
  const [periodoB,   setPeriodoB]   = useState(periodoActual());
  const [hoverComp,  setHoverComp]  = useState(false);

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [resumen,      setResumen]      = useState(null);
  const [panelData,    setPanelData]    = useState([]);
  const [comparativa,  setComparativa]  = useState([]);
  const [loadRes,      setLoadRes]      = useState(true);
  const [loadPanel,    setLoadPanel]    = useState(true);
  const [loadComp,     setLoadComp]     = useState(false);

  // ── Cargar resumen del período ────────────────────────────────────────────
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

  // ── Cargar datos del panel ────────────────────────────────────────────────
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

  // ── Cargar comparativa ────────────────────────────────────────────────────
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

  // ── Efectos ───────────────────────────────────────────────────────────────
  useEffect(() => { cargarResumen(); }, [cargarResumen]);
  useEffect(() => { cargarPanel();   }, [cargarPanel]);

  // ── Render de cards de resumen ────────────────────────────────────────────
  function CardResumen({ icon, label, valor, sub, colorValor }) {
    return (
      <div style={S.card}>
        <span style={S.cardIcon}>{icon}</span>
        <span style={S.cardLabel}>{label}</span>
        <span style={S.cardValor(colorValor)}>
          {loadRes
            ? <span style={S.skeletonLine("60%", "28px")} />
            : valor ?? "—"}
        </span>
        {sub && <span style={S.cardSub}>{sub}</span>}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* ── Barra de filtros ─────────────────────────────────────────── */}
      <div style={S.filterBar}>
        <span style={S.filterLabel}>Período</span>
        <select
          value={periodoSel}
          onChange={e => setPeriodoSel(e.target.value)}
          style={S.select(true)}
        >
          {periodos.map(p => (
            <option key={p} value={p}>{periodoLabel(p)}</option>
          ))}
        </select>

        <select
          value={rubroSel}
          onChange={e => setRubroSel(e.target.value)}
          style={S.select(!!rubroSel)}
        >
          <option value="">Todos los rubros</option>
          <option>Alimentos</option>
          <option>Bebidas y Tabacos</option>
          <option>Higiene y Limpieza</option>
        </select>

        <select value={fuenteSel} onChange={e => setFuenteSel(e.target.value)} style={S.select(!!fuenteSel)}>
        <option value="">PROESA + Competencia + Seguidor</option>
        <option value="PROESA">✦ Solo PROESA</option>
        <option value="COMPETENCIA">⚡ Solo Competencia</option>
        <option value="SEGUIDOR">◎ Solo Seguidor</option>
        </select>
      </div>

      {/* ── Cards de resumen ─────────────────────────────────────────── */}
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

      {/* ── Comparativa entre períodos + gráfico ─────────────────────── */}
      <div style={{ ...S.seccion, margin: "1.2rem 1.5rem 0" }}>
        <div style={S.seccionHeader}>
          <div style={S.seccionTitulo}>
            📈 Comparativa de precios
          </div>
          <div style={S.comparativaSelects}>
            <select
              value={periodoA}
              onChange={e => setPeriodoA(e.target.value)}
              style={S.select(true)}
            >
              {periodos.map(p => (
                <option key={p} value={p}>{periodoLabel(p)}</option>
              ))}
            </select>
            <span style={S.vsLabel}>vs</span>
            <select
              value={periodoB}
              onChange={e => setPeriodoB(e.target.value)}
              style={S.select(true)}
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

        {/* Gráfico */}
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

      {/* ── Tabla histórica ──────────────────────────────────────────── */}
      <div style={{ ...S.seccion, margin: "1.2rem 1.5rem 1.5rem" }}>
        <div style={S.seccionHeader}>
          <div style={S.seccionTitulo}>
            📋 Detalle — {periodoLabel(periodoSel)}
          </div>
          <span style={{ fontSize: "12px", color: C.gray400 }}>
            {loadPanel ? "…" : `${panelData.length} registros`}
          </span>
        </div>

        <div style={S.tableWrap}>
          {loadPanel ? (
            <div style={{ padding: "16px" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{
                  display: "flex", gap: "12px", marginBottom: "10px",
                  alignItems: "center",
                }}>
                  <span style={S.skeletonLine("15%")} />
                  <span style={S.skeletonLine("25%")} />
                  <span style={S.skeletonLine("10%")} />
                  <span style={S.skeletonLine("10%")} />
                  <span style={S.skeletonLine("10%")} />
                </div>
              ))}
            </div>
          ) : panelData.length === 0 ? (
            <div style={S.estadoCenter}>
              <span style={{ fontSize: "26px" }}>🗂️</span>
              <span style={{ fontSize: "13px" }}>
                Sin datos para {periodoLabel(periodoSel)} con los filtros aplicados.
              </span>
            </div>
          ) : (
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
                {panelData.map((row, i) => (
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
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}