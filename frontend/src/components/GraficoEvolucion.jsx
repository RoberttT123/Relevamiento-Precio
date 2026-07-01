// -*- coding: utf-8 -*-
/**
 * GraficoEvolucion.jsx — Evolución de precio de venta por mes
 * ------------------------------------------------------------
 * Gráfico SVG puro (sin dependencias) que muestra la evolución del
 * precio de venta de todos los productos de una categoría a lo largo
 * del tiempo, con una línea (o barra) por producto.
 *
 * Props:
 *   data  [ { descripcion, marca, fuente, puntos: [{ periodo, precio_venta_caja, precio_venta_unidad }] } ]
 *   tipoPrecio  "caja" | "unidad"
 *   tipoGrafico "lineas" | "barras"
 */

import { useState, useMemo } from "react";

const C = {
  navy:    "#1A1A2E",
  red:     "#E63946",
  green:   "#2A9D5C",
  amber:   "#E9A825",
  white:   "#FFFFFF",
  gray50:  "#F8F9FF",
  gray100: "#F0F0F0",
  gray200: "#E6E6E6",
  gray400: "#AAAAAA",
  gray600: "#666666",
  border:  "#E6E6E6",
};

// ─── Paleta de colores para las líneas/barras de cada producto ────────────────
// Inspirada en el gráfico de referencia: colores distinguibles entre sí,
// ninguno es igual a navy o rojo de la marca (para que el UI no se mezcle).
const PALETA = [
  "#1F77B4", // azul Steel — para el LÍDER (similar al azul del domo PROESA)
  "#FF7F0E", // naranja
  "#2CA02C", // verde
  "#9467BD", // violeta
  "#8C564B", // marrón
  "#E377C2", // rosa
  "#17BECF", // cyan
  "#BCBD22", // amarillo verdoso
  "#D62728", // rojo oscuro
  "#AEC7E8", // azul claro
];

function colorProducto(index, fuente) {
  // El LÍDER siempre usa el azul del índice 0
  if (fuente === "LIDER") return PALETA[0];
  return PALETA[(index % (PALETA.length - 1)) + 1];
}

// ─── Helper de labels de período ─────────────────────────────────────────────
function labelPeriodo(yyyymm) {
  if (!yyyymm) return "";
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun",
                 "Jul","Ago","Sep","Oct","Nov","Dic"];
  const [y, m] = yyyymm.split("-");
  const mesLabel = MESES[parseInt(m) - 1];
  // Mostrar el año solo en el primer mes o cuando cambia
  return `${mesLabel}`;
}

function labelPeriodoConAnio(yyyymm) {
  if (!yyyymm) return "";
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun",
                 "Jul","Ago","Sep","Oct","Nov","Dic"];
  const [y, m] = yyyymm.split("-");
  return `${MESES[parseInt(m) - 1]}/${y.slice(2)}`;
}

// ─── Componente de gráfico SVG ────────────────────────────────────────────────
function GraficoSVG({ series, periodos, tipo }) {
  const [tooltip, setTooltip] = useState(null);

  // Dimensiones del área de dibujo
  const W        = 640;
  const H        = 260;
  const PAD_L    = 52;  // espacio para labels del eje Y
  const PAD_R    = 16;
  const PAD_T    = 16;
  const PAD_B    = 44;  // espacio para labels del eje X
  const PLOT_W   = W - PAD_L - PAD_R;
  const PLOT_H   = H - PAD_T - PAD_B;

  // ── Calcular escala ───────────────────────────────────────────────────────
  const todosLosValores = series.flatMap(s => s.valores.filter(v => v != null));
  if (todosLosValores.length === 0) return (
    <div style={{ padding: "2rem", textAlign: "center", color: C.gray400 }}>
      Sin datos para graficar.
    </div>
  );

  const vMax = Math.max(...todosLosValores);
  const vMin = Math.min(0, Math.min(...todosLosValores));
  const rango = vMax - vMin || 1;

  // Escala con un 10% de aire arriba
  const yMax = vMax * 1.10;
  const yMin = vMin;
  const yRango = yMax - yMin || 1;

  // Niveles del eje Y (5 marcas)
  const yTicks = Array.from({ length: 6 }, (_, i) =>
    Math.round((yMin + (yRango / 5) * i) * 100) / 100
  );

  // Posición X de cada columna de período
  const xPos = (i) =>
    PAD_L + (i / Math.max(periodos.length - 1, 1)) * PLOT_W;

  // Posición Y de un valor
  const yPos = (v) =>
    PAD_T + PLOT_H - ((v - yMin) / yRango) * PLOT_H;

  // Ancho de cada barra (para modo barras)
  const barW = tipo === "barras"
    ? Math.max(4, Math.floor(PLOT_W / (periodos.length * (series.length + 0.5))) - 2)
    : 0;

  return (
    <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", minWidth: "340px", display: "block" }}
      >
        {/* Fondo */}
        <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={PLOT_H}
          fill={C.gray50} rx="4" />

        {/* Líneas de grilla horizontales */}
        {yTicks.map((tick, i) => {
          const y = yPos(tick);
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={PAD_L + PLOT_W} y2={y}
                stroke={C.gray200} strokeWidth="1"
                strokeDasharray={i === 0 ? "none" : "3,3"} />
              <text x={PAD_L - 6} y={y + 4}
                fontSize="9" fill={C.gray400} textAnchor="end">
                {tick % 1 === 0 ? tick : tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Labels eje X */}
        {periodos.map((p, i) => (
          <text key={i}
            x={xPos(i)}
            y={PAD_T + PLOT_H + 16}
            fontSize="9"
            fill={C.gray600}
            textAnchor="middle"
          >
            {labelPeriodoConAnio(p)}
          </text>
        ))}

        {tipo === "lineas" && series.map((serie, si) => {
          // Armar segmentos de línea (ignorando nulls)
          const puntos = serie.valores.map((v, i) =>
            v != null ? { x: xPos(i), y: yPos(v), v, i } : null
          ).filter(Boolean);

          if (puntos.length === 0) return null;

          // Construir path de línea pasando solo por puntos no-null
          let path = "";
          let prevIdx = null;
          serie.valores.forEach((v, i) => {
            if (v == null) { prevIdx = null; return; }
            const x = xPos(i);
            const y = yPos(v);
            if (prevIdx === null || prevIdx !== i - 1) {
              path += `M ${x} ${y} `;
            } else {
              path += `L ${x} ${y} `;
            }
            prevIdx = i;
          });

          return (
            <g key={si}>
              <path d={path}
                fill="none"
                stroke={serie.color}
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Puntos y tooltips */}
              {puntos.map(({ x, y, v, i }) => (
                <circle key={i}
                  cx={x} cy={y} r="4"
                  fill={serie.color}
                  stroke={C.white}
                  strokeWidth="1.5"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setTooltip({ x, y, v, serie, periodo: periodos[i] })}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
              {/* Labels de valor en cada punto */}
              {puntos.map(({ x, y, v, i }) => (
                <text key={`lbl-${i}`}
                  x={x} y={y - 8}
                  fontSize="9" fontWeight="700"
                  fill={serie.color}
                  textAnchor="middle"
                >
                  {v % 1 === 0 ? v : v.toFixed(1)}
                </text>
              ))}
            </g>
          );
        })}

        {tipo === "barras" && periodos.map((p, pi) => (
          <g key={pi}>
            {series.map((serie, si) => {
              const v = serie.valores[pi];
              if (v == null) return null;
              const totalSeries = series.length;
              const grupoW = barW * totalSeries + (totalSeries - 1) * 2;
              const xBase = xPos(pi) - grupoW / 2 + si * (barW + 2);
              const yV    = yPos(v);
              const barH  = PAD_T + PLOT_H - yV;

              return (
                <g key={si}>
                  <rect
                    x={xBase} y={yV}
                    width={barW} height={barH}
                    fill={serie.color}
                    rx="2"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setTooltip({ x: xBase + barW / 2, y: yV, v, serie, periodo: p })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                  <text
                    x={xBase + barW / 2} y={yV - 4}
                    fontSize="8" fontWeight="700"
                    fill={serie.color}
                    textAnchor="middle"
                  >
                    {v % 1 === 0 ? v : v.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Tooltip */}
        {tooltip && (() => {
          const TW = 120, TH = 42;
          const tx = Math.min(tooltip.x + 10, W - TW - 4);
          const ty = Math.max(tooltip.y - TH - 8, PAD_T);
          return (
            <g>
              <rect x={tx} y={ty} width={TW} height={TH}
                fill={C.navy} rx="6" opacity="0.92" />
              <text x={tx + 8} y={ty + 14}
                fontSize="9" fill={C.white} fontWeight="600">
                {tooltip.serie.label.length > 16
                  ? tooltip.serie.label.slice(0, 15) + "…"
                  : tooltip.serie.label}
              </text>
              <text x={tx + 8} y={ty + 27}
                fontSize="9" fill={C.gray200}>
                {labelPeriodoConAnio(tooltip.periodo)}
              </text>
              <text x={tx + TW - 8} y={ty + 27}
                fontSize="10" fill={C.white} fontWeight="700"
                textAnchor="end">
                Bs {tooltip.v.toFixed(2)}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ─── Leyenda ──────────────────────────────────────────────────────────────────
function Leyenda({ series, visibles, onToggle }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "8px",
      padding: "10px 14px",
      borderTop: `1px solid ${C.gray100}`,
    }}>
      {series.map((s, i) => {
        const activo = visibles.has(i);
        return (
          <button
            key={i}
            onClick={() => onToggle(i)}
            type="button"
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              background: activo ? `${s.color}18` : C.gray100,
              border: `1.5px solid ${activo ? s.color : C.gray200}`,
              borderRadius: "20px",
              padding: "3px 10px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: activo ? 600 : 400,
              color: activo ? s.color : C.gray400,
              transition: "all 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{
              width: "10px", height: "10px",
              borderRadius: s.fuente === "LIDER" ? "50%" : "2px",
              background: activo ? s.color : C.gray200,
              flexShrink: 0,
            }} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function GraficoEvolucion({ data, tipoPrecio, tipoGrafico }) {
  // data = [ { descripcion, marca, fuente, puntos: [{periodo, precio_venta_caja, precio_venta_unidad}] } ]

  // Índices visibles (todos activos por defecto)
  const [visibles, setVisibles] = useState(() => new Set(data.map((_, i) => i)));

  function toggleVisible(i) {
    setVisibles(prev => {
      const next = new Set(prev);
      if (next.has(i)) {
        // No permitir desactivar todos
        if (next.size > 1) next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }

  // ── Extraer períodos únicos en orden cronológico ──────────────────────────
  const periodos = useMemo(() => {
    const set = new Set();
    data.forEach(prod => prod.puntos.forEach(pt => set.add(pt.periodo)));
    return Array.from(set).sort();
  }, [data]);

  // ── Construir series (una por producto) ───────────────────────────────────
  const todasLasSeries = useMemo(() => {
    // Poner el LÍDER primero
    const ordenado = [...data].sort((a, b) => {
      if (a.fuente === "LIDER" && b.fuente !== "LIDER") return -1;
      if (b.fuente === "LIDER" && a.fuente !== "LIDER") return 1;
      return a.descripcion.localeCompare(b.descripcion);
    });

    return ordenado.map((prod, i) => ({
      label:   prod.marca || prod.descripcion,
      fuente:  prod.fuente,
      color:   colorProducto(i, prod.fuente),
      valores: periodos.map(p => {
        const punto = prod.puntos.find(pt => pt.periodo === p);
        return punto
          ? (tipoPrecio === "caja" ? punto.precio_venta_caja : punto.precio_venta_unidad)
          : null;
      }),
    }));
  }, [data, periodos, tipoPrecio]);

  const seriesVisibles = todasLasSeries.filter((_, i) => visibles.has(i));

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: "2rem 1rem", textAlign: "center", color: C.gray400 }}>
        <div style={{ fontSize: "26px", marginBottom: "8px" }}>📈</div>
        <div style={{ fontSize: "13px" }}>Sin datos para graficar.</div>
      </div>
    );
  }

  return (
    <div>
      <GraficoSVG
        series={seriesVisibles}
        periodos={periodos}
        tipo={tipoGrafico}
      />
      <Leyenda
        series={todasLasSeries}
        visibles={visibles}
        onToggle={toggleVisible}
      />
    </div>
  );
}