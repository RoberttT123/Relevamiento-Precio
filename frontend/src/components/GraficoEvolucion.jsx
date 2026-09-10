// -*- coding: utf-8 -*-
/**
 * GraficoEvolucion.jsx — Evolución de precio de venta por mes
 * ------------------------------------------------------------
 * Gráfico de líneas o barras SVG puro.
 * - Recorta el eje X a los meses que tienen datos reales
 * - Eje Y con rango inteligente (no desde 0)
 * - Los nombres de producto viven solo en la leyenda (no se repiten al
 *   final de cada línea, para no saturar el gráfico)
 * - Línea horizontal cuando hay un solo punto (tendencia plana)
 * - Etiquetas de valor con separación anti-colisión: si dos series tienen
 *   un valor muy cercano en el mismo mes, sus etiquetas se apilan en vez
 *   de superponerse (ver resolverColisionesLabels)
 * - Botón "Descargar" que exporta gráfico + leyenda como PNG (via html2canvas)
 *
 * Props:
 *   data        [ { descripcion, marca, fuente,
 *                   puntos: [{ periodo, precio_venta_caja, precio_venta_unidad }] } ]
 *   tipoPrecio  "caja" | "unidad"
 *   tipoGrafico "lineas" | "barras"
 */

import { useState, useMemo, useRef } from "react";
import html2canvas from "html2canvas";

const C = {
  navy:    "#1A1A2E",
  red:     "#E63946",
  green:   "#2A9D5C",
  amber:   "#E9A825",
  white:   "#FFFFFF",
  gray50:  "#F8F9FF",
  gray100: "#F0F0F0",
  gray200: "#E6E6E6",
  gray300: "#DDDDDD",
  gray400: "#AAAAAA",
  gray600: "#555555",
  border:  "#E6E6E6",
};

// Paleta de 10 colores distinguibles
const PALETA = [
  "#1565C0", // azul oscuro — LÍDER
  "#E65100", // naranja oscuro
  "#2E7D32", // verde oscuro
  "#6A1B9A", // violeta
  "#00838F", // teal
  "#AD1457", // rosa oscuro
  "#F57F17", // amarillo oscuro
  "#37474F", // gris azulado
  "#558B2F", // verde oliva
  "#4527A0", // índigo
];

function colorProducto(index, fuente) {
  if (fuente === "LIDER") return PALETA[0];
  return PALETA[(index % (PALETA.length - 1)) + 1];
}

function labelPeriodo(yyyymm) {
  if (!yyyymm) return "";
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun",
                 "Jul","Ago","Sep","Oct","Nov","Dic"];
  const [y, m] = yyyymm.split("-");
  return `${MESES[parseInt(m) - 1]}/${y.slice(2)}`;
}

// Redondear "bonito" para el eje Y
function niceNum(range, round) {
  const exp   = Math.floor(Math.log10(range));
  const frac  = range / Math.pow(10, exp);
  let nice;
  if (round) {
    if (frac < 1.5)       nice = 1;
    else if (frac < 3)    nice = 2;
    else if (frac < 7)    nice = 5;
    else                  nice = 10;
  } else {
    if (frac <= 1)        nice = 1;
    else if (frac <= 2)   nice = 2;
    else if (frac <= 5)   nice = 5;
    else                  nice = 10;
  }
  return nice * Math.pow(10, exp);
}

function calcYAxis(values) {
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  if (vMin === vMax) {
    // Un solo valor: centrar con margen del 20%
    const margin = vMin * 0.2 || 1;
    return { yMin: vMin - margin, yMax: vMax + margin, ticks: 4 };
  }
  const range      = niceNum(vMax - vMin, false);
  const tickSpacing = niceNum(range / 5, true);
  const yMin = Math.floor(vMin / tickSpacing) * tickSpacing;
  const yMax = Math.ceil(vMax  / tickSpacing) * tickSpacing;
  return { yMin, yMax, tickSpacing };
}

// Separación mínima (en unidades del viewBox) entre dos etiquetas de valor
// apiladas verticalmente antes de considerarlas "pisadas".
const LABEL_MIN_GAP = 12;

// Para cada mes (columna del eje X), junta los puntos de todas las series que
// tengan dato ahí, los ordena de arriba hacia abajo y empuja hacia abajo
// cualquier etiqueta que quede a menos de LABEL_MIN_GAP de la anterior. Así,
// si dos productos tienen un valor casi idéntico el mismo mes, sus números
// se apilan en vez de quedar uno encima del otro (ilegibles).
// Devuelve un Map con clave `${indiceSerie}_${indicePeriodo}` -> y de la etiqueta.
function resolverColisionesLabels(series, periodos, yPos) {
  const resultado = new Map();
  periodos.forEach((_, i) => {
    const candidatos = [];
    series.forEach((s, si) => {
      const v = s.valores[i];
      if (v != null) candidatos.push({ si, y: yPos(v) - 10, v });
    });
    candidatos.sort((a, b) => a.y - b.y);
    for (let k = 1; k < candidatos.length; k++) {
      const prev = candidatos[k - 1];
      const cur  = candidatos[k];
      if (cur.y - prev.y < LABEL_MIN_GAP) {
        cur.y = prev.y + LABEL_MIN_GAP;
      }
    }
    candidatos.forEach(({ si, y }) => resultado.set(`${si}_${i}`, y));
  });
  return resultado;
}

// ─── SVG principal ────────────────────────────────────────────────────────────
function GraficoSVG({ series, periodos, tipo }) {
  const [tooltip, setTooltip] = useState(null);
  const [hoverSerie, setHoverSerie] = useState(null);

  // Dimensiones
  const W      = 700;
  const H      = 300;
  const PAD_L  = 52;
  const PAD_R  = 28; // margen derecho (los nombres de producto ya estan en la leyenda)
  const PAD_T  = 20;
  const PAD_B  = 48;
  const PLOT_W = W - PAD_L - PAD_R;
  const PLOT_H = H - PAD_T - PAD_B;

  // Escala Y
  const todosValores = series.flatMap(s => s.valores.filter(v => v != null));
  if (todosValores.length === 0) {
    return (
      <div style={{ padding: "2.5rem", textAlign: "center", color: C.gray400, fontSize: "13px" }}>
        Sin datos para graficar en los meses seleccionados.
      </div>
    );
  }

  const { yMin, yMax, tickSpacing } = calcYAxis(todosValores);
  const yRango = yMax - yMin || 1;

  // Ticks del eje Y
  const yTicks = [];
  if (tickSpacing) {
    for (let v = yMin; v <= yMax + tickSpacing * 0.01; v = Math.round((v + tickSpacing) * 1000) / 1000) {
      yTicks.push(Math.round(v * 100) / 100);
    }
  } else {
    for (let i = 0; i <= 5; i++) yTicks.push(Math.round((yMin + (yRango / 5) * i) * 100) / 100);
  }

  // Posiciones X e Y
  const N = Math.max(periodos.length - 1, 1);
  const xPos = (i) => PAD_L + (i / N) * PLOT_W;
  const yPos = (v) => PAD_T + PLOT_H - ((v - yMin) / yRango) * PLOT_H;

  // Posición anti-colisión de cada etiqueta de valor (solo aplica en modo líneas)
  const labelYAjustado = tipo === "lineas" ? resolverColisionesLabels(series, periodos, yPos) : null;

  // Ancho de barra por producto
  const barW = tipo === "barras"
    ? Math.max(6, Math.floor(PLOT_W / (periodos.length * (series.length + 1))) - 1)
    : 0;

  return (
    <div style={{ position: "relative", width: "100%", overflowX: "auto", padding: "0 4px" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", minWidth: "380px", display: "block" }}
      >
        {/* Fondo del área de plot */}
        <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={PLOT_H}
          fill={C.white} rx="4"
          stroke={C.gray200} strokeWidth="1"
        />

        {/* Líneas de grilla + labels eje Y */}
        {yTicks.map((tick, i) => {
          const y = yPos(tick);
          if (y < PAD_T - 2 || y > PAD_T + PLOT_H + 2) return null;
          return (
            <g key={i}>
              <line
                x1={PAD_L} y1={y}
                x2={PAD_L + PLOT_W} y2={y}
                stroke={i === 0 ? C.gray300 : C.gray200}
                strokeWidth={i === 0 ? "1.5" : "1"}
                strokeDasharray={i === 0 ? "none" : "4,4"}
              />
              <text
                x={PAD_L - 7} y={y + 4}
                fontSize="10" fill={C.gray400}
                textAnchor="end" fontFamily="Inter, sans-serif"
              >
                {tick % 1 === 0 ? tick : tick.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Labels eje X */}
        {periodos.map((p, i) => (
          <text key={i}
            x={xPos(i)} y={PAD_T + PLOT_H + 20}
            fontSize="10" fill={C.gray600}
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontWeight={i === periodos.length - 1 ? "600" : "400"}
          >
            {labelPeriodo(p)}
          </text>
        ))}

        {/* Separador vertical para el último mes */}
        <line
          x1={PAD_L} y1={PAD_T}
          x2={PAD_L} y2={PAD_T + PLOT_H}
          stroke={C.gray300} strokeWidth="1.5"
        />

        {/* ── Modo LÍNEAS ───────────────────────────────────────────── */}
        {tipo === "lineas" && series.map((serie, si) => {
          const activo = hoverSerie === null || hoverSerie === si;
          const opacity = activo ? 1 : 0.15;

          // Puntos con valor
          const puntosConValor = serie.valores
            .map((v, i) => v != null ? { x: xPos(i), y: yPos(v), v, i } : null)
            .filter(Boolean);

          if (puntosConValor.length === 0) return null;

          // Path de la línea
          let path = "";
          let prevI = null;
          serie.valores.forEach((v, i) => {
            if (v == null) { prevI = null; return; }
            const x = xPos(i); const y2 = yPos(v);
            if (prevI === null || prevI !== i - 1) path += `M ${x} ${y2} `;
            else path += `L ${x} ${y2} `;
            prevI = i;
          });

          // Si solo hay un punto → línea horizontal de referencia
          const soloUnPunto = puntosConValor.length === 1;
          const refY = soloUnPunto ? puntosConValor[0].y : null;

          return (
            <g key={si} style={{ opacity }}>
              {/* Línea horizontal de referencia si hay un solo punto */}
              {soloUnPunto && (
                <line
                  x1={PAD_L} y1={refY}
                  x2={PAD_L + PLOT_W} y2={refY}
                  stroke={serie.color}
                  strokeWidth="1.5"
                  strokeDasharray="6,4"
                  opacity="0.5"
                />
              )}

              {/* Línea principal */}
              {!soloUnPunto && (
                <path
                  d={path}
                  fill="none"
                  stroke={serie.color}
                  strokeWidth={hoverSerie === si ? 3 : 2.2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {/* Puntos */}
              {puntosConValor.map(({ x, y: py, v, i }) => {
                const yLabel = labelYAjustado.get(`${si}_${i}`) ?? (py - 10);
                return (
                  <g key={i}>
                    {/* Halo hover */}
                    <circle cx={x} cy={py} r="9"
                      fill={serie.color} opacity="0"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => { setTooltip({ x, y: py, v, serie, periodo: periodos[i] }); setHoverSerie(si); }}
                      onMouseLeave={() => { setTooltip(null); setHoverSerie(null); }}
                    />
                    <circle cx={x} cy={py} r="4.5"
                      fill={C.white}
                      stroke={serie.color}
                      strokeWidth="2.2"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => { setTooltip({ x, y: py, v, serie, periodo: periodos[i] }); setHoverSerie(si); }}
                      onMouseLeave={() => { setTooltip(null); setHoverSerie(null); }}
                    />
                    {/* Label de valor, desplazado si colisiona con otra serie en el mismo mes */}
                    <text
                      x={x} y={yLabel}
                      fontSize="9.5" fontWeight="700"
                      fill={serie.color}
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                    >
                      {v % 1 === 0 ? v : v.toFixed(2)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ── Modo BARRAS ───────────────────────────────────────────── */}
        {tipo === "barras" && periodos.map((p, pi) => (
          <g key={pi}>
            {series.map((serie, si) => {
              const v = serie.valores[pi];
              if (v == null) return null;
              const activo = hoverSerie === null || hoverSerie === si;
              const grupoW = barW * series.length + (series.length - 1) * 2;
              const xBase  = xPos(pi) - grupoW / 2 + si * (barW + 2);
              const yV     = yPos(v);
              const barH   = PAD_T + PLOT_H - yV;

              return (
                <g key={si} opacity={activo ? 1 : 0.15}>
                  <rect
                    x={xBase} y={yV}
                    width={barW} height={Math.max(barH, 1)}
                    fill={serie.color} rx="2"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => { setTooltip({ x: xBase + barW/2, y: yV, v, serie, periodo: p }); setHoverSerie(si); }}
                    onMouseLeave={() => { setTooltip(null); setHoverSerie(null); }}
                  />
                  {barH > 16 && (
                    <text
                      x={xBase + barW / 2} y={yV - 4}
                      fontSize="8" fontWeight="700"
                      fill={serie.color}
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                    >
                      {v % 1 === 0 ? v : v.toFixed(1)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        ))}

        {/* Tooltip flotante */}
        {tooltip && (() => {
          const TW = 134; const TH = 52;
          const tx = Math.min(tooltip.x + 12, W - TW - 4);
          const ty = Math.max(tooltip.y - TH - 10, PAD_T + 2);
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={tx} y={ty} width={TW} height={TH}
                fill={C.navy} rx="7" />
              <text x={tx + 10} y={ty + 16}
                fontSize="10" fill={C.white} fontWeight="700"
                fontFamily="Inter, sans-serif">
                {tooltip.serie.label.length > 14
                  ? tooltip.serie.label.slice(0, 13) + "…"
                  : tooltip.serie.label}
              </text>
              <text x={tx + 10} y={ty + 30}
                fontSize="9.5" fill="rgba(255,255,255,0.65)"
                fontFamily="Inter, sans-serif">
                {labelPeriodo(tooltip.periodo)}
              </text>
              <text x={tx + TW - 10} y={ty + 30}
                fontSize="11" fill={tooltip.serie.color} fontWeight="800"
                textAnchor="end" fontFamily="Inter, sans-serif">
                Bs {tooltip.v.toFixed(2)}
              </text>
              <rect x={tx} y={ty} width="4" height={TH}
                fill={tooltip.serie.color} rx="3" />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ─── Leyenda clicable ─────────────────────────────────────────────────────────
function Leyenda({ series, visibles, onToggle }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "8px",
      padding: "10px 16px 14px",
    }}>
      {series.map((s, i) => {
        const activo = visibles.has(i);
        return (
          <button
            key={i}
            onClick={() => onToggle(i)}
            type="button"
            title={s.descripcion}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: activo ? `${s.color}14` : C.gray100,
              border: `1.5px solid ${activo ? s.color : C.gray200}`,
              borderRadius: "20px",
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: "11.5px",
              fontWeight: activo ? 600 : 400,
              color: activo ? s.color : C.gray400,
              transition: "all 0.15s",
              WebkitTapHighlightColor: "transparent",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <span style={{
              width: "8px", height: "8px",
              borderRadius: "50%",
              background: activo ? s.color : C.gray300,
              flexShrink: 0,
            }} />
            {s.label}
            {s.fuente === "LIDER" && (
              <span style={{ fontSize: "10px", opacity: 0.7 }}>⭐</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Boton para descargar el grafico (SVG + leyenda) como imagen PNG
function BotonDescargar({ targetRef, nombreArchivo }) {
  const [descargando, setDescargando] = useState(false);

  async function descargar() {
    if (!targetRef.current || descargando) return;
    setDescargando(true);
    try {
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#ffffff",
        scale: 2, // mayor resolucion para que se vea nitido al compartir/imprimir
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nombreArchivo || "evolucion-precios"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("No se pudo generar la imagen del grafico:", err);
    } finally {
      setDescargando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={descargar}
      disabled={descargando}
      title="Descargar gráfico como imagen"
      style={{
        display: "flex", alignItems: "center", gap: "5px",
        background: C.white,
        border: `1.5px solid ${C.gray300}`,
        borderRadius: "8px",
        padding: "5px 10px",
        cursor: descargando ? "default" : "pointer",
        fontSize: "11.5px",
        fontWeight: 600,
        color: C.gray600,
        fontFamily: "Inter, sans-serif",
        opacity: descargando ? 0.6 : 1,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v13" />
        <path d="M7 11l5 5 5-5" />
        <path d="M4 20h16" />
      </svg>
      {descargando ? "Generando…" : "Descargar"}
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function GraficoEvolucion({ data, tipoPrecio, tipoGrafico }) {
  const contenedorRef = useRef(null);
  const [visibles, setVisibles] = useState(() => new Set(data.map((_, i) => i)));

  function toggleVisible(i) {
    setVisibles(prev => {
      const next = new Set(prev);
      if (next.has(i)) {
        if (next.size > 1) next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }

  // Períodos: solo los que tienen al menos UN dato real en CUALQUIER producto
  const periodos = useMemo(() => {
    const set = new Set();
    data.forEach(prod =>
      prod.puntos.forEach(pt => {
        const v = tipoPrecio === "caja" ? pt.precio_venta_caja : pt.precio_venta_unidad;
        if (v != null) set.add(pt.periodo);
      })
    );
    return Array.from(set).sort();
  }, [data, tipoPrecio]);

  // Series ordenadas: LÍDER primero, luego el resto alfabético
  const todasLasSeries = useMemo(() => {
    const ordenado = [...data].sort((a, b) => {
      if (a.fuente === "LIDER" && b.fuente !== "LIDER") return -1;
      if (b.fuente === "LIDER" && a.fuente !== "LIDER") return 1;
      return a.descripcion.localeCompare(b.descripcion);
    });

    return ordenado.map((prod, i) => ({
      label:       prod.marca || prod.descripcion,
      descripcion: prod.descripcion,
      fuente:      prod.fuente,
      color:       colorProducto(i, prod.fuente),
      valores:     periodos.map(p => {
        const punto = prod.puntos.find(pt => pt.periodo === p);
        if (!punto) return null;
        return tipoPrecio === "caja"
          ? punto.precio_venta_caja
          : punto.precio_venta_unidad;
      }),
    }));
  }, [data, periodos, tipoPrecio]);

  const seriesVisibles = todasLasSeries.filter((_, i) => visibles.has(i));

  if (!data || data.length === 0 || periodos.length === 0) {
    return (
      <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: C.gray400 }}>
        <div style={{ fontSize: "28px", marginBottom: "8px" }}>📈</div>
        <div style={{ fontSize: "13px" }}>Sin datos para graficar.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
        <BotonDescargar targetRef={contenedorRef} nombreArchivo="evolucion-precios" />
      </div>
      <div ref={contenedorRef} style={{ background: C.white }}>
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
    </div>
  );
}