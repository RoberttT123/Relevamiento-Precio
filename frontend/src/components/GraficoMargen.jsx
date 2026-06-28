// -*- coding: utf-8 -*-
/**
 * GraficoMargen.jsx — Comparativa de precios entre dos períodos
 * -------------------------------------------------------------
 * Barras horizontales dobles: precio venta caja período A vs B
 * Delta con flecha de tendencia y márgenes por período
 *
 * Props:
 *   data       [ { descripcion, marca, fuente, grameaje_ml,
 *                  precio_venta_caja_a, precio_venta_caja_b,
 *                  margen_caja_pct_a,  margen_caja_pct_b,
 *                  delta_precio_caja,  delta_margen_pct } ]
 *   periodoA   "YYYY-MM"
 *   periodoB   "YYYY-MM"
 */

import { useState } from "react";

const C = {
  navy:       "#1A1A2E",
  red:        "#E63946",
  redLight:   "rgba(230,57,70,0.15)",
  green:      "#2A9D5C",
  greenLight: "rgba(42,157,92,0.15)",
  amber:      "#E9A825",
  white:      "#FFFFFF",
  gray50:     "#F8F9FF",
  gray100:    "#F0F0F0",
  gray200:    "#E6E6E6",
  gray400:    "#AAAAAA",
  navyBar:    "rgba(26,26,46,0.22)",
};

function periodoLabel(yyyymm) {
  if (!yyyymm) return "—";
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun",
                 "Jul","Ago","Sep","Oct","Nov","Dic"];
  const [y, m] = yyyymm.split("-");
  return `${MESES[parseInt(m) - 1]} ${y}`;
}

// ─── Barra horizontal doble ───────────────────────────────────────────────────
function BarraDoble({ valorA, valorB, maximo, labelA, labelB }) {
  const pctA = maximo > 0 ? Math.min(100, (valorA / maximo) * 100) : 0;
  const pctB = maximo > 0 ? Math.min(100, (valorB / maximo) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      {[
        { label: labelA, pct: pctA, valor: valorA, color: C.navyBar, textColor: C.navy },
        { label: labelB, pct: pctB, valor: valorB, color: C.red,     textColor: C.red  },
      ].map(({ label, pct, valor, color, textColor }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: C.gray400,
            width: "52px", textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
            {label}
          </span>
          <div style={{ flex: 1, height: "10px", background: C.gray100,
            borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              width: `${pct}%`, height: "100%",
              background: color, borderRadius: "3px",
              transition: "width 0.5s ease",
            }} />
          </div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: textColor,
            width: "68px", whiteSpace: "nowrap", flexShrink: 0 }}>
            {valor != null ? `Bs ${valor.toFixed(2)}` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Chip de delta ────────────────────────────────────────────────────────────
function DeltaChip({ delta }) {
  if (delta === null || delta === undefined)
    return <span style={{ color: C.gray400, fontSize: "11px" }}>—</span>;
  const sube = delta > 0;
  const baja = delta < 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      background: sube ? C.redLight : baja ? C.greenLight : C.gray100,
      color:      sube ? C.red      : baja ? C.green      : C.gray400,
      fontSize: "11px", fontWeight: 700,
      padding: "2px 8px", borderRadius: "20px",
    }}>
      {sube ? "▲" : baja ? "▼" : "●"} Bs {Math.abs(delta).toFixed(2)}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function GraficoMargen({ data, periodoA, periodoB }) {
  const [pagina, setPagina] = useState(0);
  const POR_PAGINA   = 10;
  const labelA       = periodoLabel(periodoA);
  const labelB       = periodoLabel(periodoB);
  const totalPaginas = Math.ceil(data.length / POR_PAGINA);
  const slice        = data.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const maximo = Math.max(
    ...data.map(r => Math.max(r.precio_venta_caja_a ?? 0, r.precio_venta_caja_b ?? 0)),
    1
  );

  return (
    <div style={{ padding: "16px" }}>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "16px",
        flexWrap: "wrap", alignItems: "center" }}>
        {[
          { color: C.navyBar, label: labelA },
          { color: C.red,     label: labelB },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "24px", height: "8px", borderRadius: "2px",
              background: color }} />
            <span style={{ fontSize: "11px", color: C.gray400, fontWeight: 500 }}>
              {label}
            </span>
          </div>
        ))}
        <span style={{ fontSize: "11px", color: C.gray400, marginLeft: "auto" }}>
          {data.length} productos en común
        </span>
      </div>

      {/* Filas del gráfico */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {slice.map((row, i) => (
          <div key={i} style={{
            padding: "12px 14px",
            background: i % 2 === 0 ? C.white : C.gray50,
            borderRadius: "8px",
            border: `1px solid ${C.gray200}`,
          }}>
            {/* Header fila */}
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: "10px",
              gap: "8px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: C.navy,
                  lineHeight: 1.3 }}>
                  {row.descripcion}
                </div>
                <div style={{ fontSize: "11px", color: C.gray400, marginTop: "2px",
                  display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <span>{row.marca}</span>
                  {row.grameaje_ml && <span>· {row.grameaje_ml}g/ml</span>}
                  <span style={{
                    color: row.fuente === "PROESA" ? C.navy : C.red,
                    fontWeight: 600,
                  }}>
                    · {row.fuente === "PROESA" ? "✦ PROESA" : "⚡ Comp."}
                  </span>
                </div>
              </div>

              {/* Delta precio */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "10.5px", color: C.gray400 }}>Δ caja:</span>
                <DeltaChip delta={row.delta_precio_caja} />
              </div>
            </div>

            {/* Barras */}
            <BarraDoble
              valorA={row.precio_venta_caja_a}
              valorB={row.precio_venta_caja_b}
              maximo={maximo}
              labelA={labelA}
              labelB={labelB}
            />

            {/* Márgenes */}
            <div style={{ display: "flex", gap: "20px", marginTop: "8px",
              flexWrap: "wrap" }}>
              {[
                { label: `Margen ${labelA}`, val: row.margen_caja_pct_a },
                { label: `Margen ${labelB}`, val: row.margen_caja_pct_b },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: "flex", alignItems: "center",
                  gap: "5px" }}>
                  <span style={{ fontSize: "10.5px", color: C.gray400 }}>
                    {label}:
                  </span>
                  <span style={{
                    fontSize: "12px", fontWeight: 700,
                    color: val == null ? C.gray400
                         : val >= 20  ? C.green
                         : val >= 10  ? C.amber
                         :              C.red,
                  }}>
                    {val != null ? `${val.toFixed(1)}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div style={{ display: "flex", justifyContent: "center",
          alignItems: "center", gap: "10px", marginTop: "16px" }}>
          <button
            onClick={() => setPagina(p => Math.max(0, p - 1))}
            disabled={pagina === 0}
            style={{
              padding: "5px 12px", borderRadius: "7px",
              border: `1px solid ${C.gray200}`, background: C.white,
              cursor: pagina === 0 ? "not-allowed" : "pointer",
              color: pagina === 0 ? C.gray400 : C.navy, fontSize: "12px",
            }}
          >← Anterior</button>
          <span style={{ fontSize: "12px", color: C.gray400 }}>
            {pagina + 1} / {totalPaginas}
          </span>
          <button
            onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
            disabled={pagina === totalPaginas - 1}
            style={{
              padding: "5px 12px", borderRadius: "7px",
              border: `1px solid ${C.gray200}`, background: C.white,
              cursor: pagina === totalPaginas - 1 ? "not-allowed" : "pointer",
              color: pagina === totalPaginas - 1 ? C.gray400 : C.navy,
              fontSize: "12px",
            }}
          >Siguiente →</button>
        </div>
      )}
    </div>
  );
}