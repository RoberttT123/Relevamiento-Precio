// -*- coding: utf-8 -*-
/**
 * FilaProducto.jsx — Fila editable dentro del acordeón de categoría
 * ------------------------------------------------------------------
 * Muestra: badge fuente · nombre · precios compra/venta · margen
 * Al tocar la fila se expande para editar los campos.
 * Diseñado para comparar productos de la misma categoría lado a lado.
 *
 * Props:
 *   producto        { id, descripcion, marca, fuente, grameaje_ml,
 *                     imagen_url, categoria_nombre }
 *   precioActual    { id, precio_compra_caja, precio_venta_caja,
 *                     precio_compra_unidad, precio_venta_unidad,
 *                     margen_caja_pct, margen_unidad_pct } | null
 *   relevamientoId  string
 *   empleado        { id, nombre, rol }
 *   esUltima        boolean (para no mostrar borde inferior en la última)
 *   bloqueado       boolean (relevamiento finalizado)
 *   onGuardado      (precioActualizado) => void
 */

import { useState, useRef } from "react";

const C = {
  navy:       "#1A1A2E",
  red:        "#E63946",
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
};

const API   = import.meta.env.VITE_API_URL ?? "";
const TOUCH = 44;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function colorMargen(pct) {
  if (pct == null) return C.gray400;
  if (pct >= 20)   return C.green;
  if (pct >= 10)   return C.amber;
  return C.red;
}
function bgMargen(pct) {
  if (pct == null) return C.gray100;
  if (pct >= 20)   return C.greenLight;
  if (pct >= 10)   return C.amberLight;
  return C.redLight;
}

const FUENTE_CONFIG = {
  PROESA:      { bg: C.navy,  fg: C.white, icon: "✦", label: "PROESA" },
  COMPETENCIA: { bg: C.red,   fg: C.white, icon: "⚡", label: "COMP." },
  SEGUIDOR:    { bg: C.amber, fg: C.navy,  icon: "◎", label: "SEG."  },
};

function Spinner({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16"
      style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="8" cy="8" r="6" fill="none"
        stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
      <path d="M8 2A6 6 0 0 1 14 8" fill="none"
        stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Input de precio inline ───────────────────────────────────────────────────
function InputPrecio({ label, campo, valores, onChange, dirtyFields, disabled }) {
  const [focused, setFocused] = useState(false);
  const dirty = !!dirtyFields[campo];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "10px", fontWeight: 600, color: C.gray600,
        letterSpacing: "0.4px", textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: "8px", top: "50%",
          transform: "translateY(-50%)",
          fontSize: "11px", color: focused ? C.red : C.gray400,
          fontWeight: 500, pointerEvents: "none",
        }}>Bs</span>
        <input
          type="number"
          inputMode="decimal"
          pattern="[0-9]*"
          min="0"
          step="0.01"
          placeholder="0.00"
          disabled={disabled}
          value={valores[campo] ?? ""}
          onChange={e => onChange(campo, e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            height: `${TOUCH}px`,
            padding: "0 8px 0 26px",
            border: `1.5px solid ${focused ? C.red : dirty ? C.amber : C.gray200}`,
            borderRadius: "8px",
            fontSize: "15px",
            color: C.navy,
            background: disabled ? C.gray100 : focused ? C.white : C.gray50,
            outline: "none",
            boxShadow: focused ? `0 0 0 3px ${C.redLight}` : "none",
            transition: "border-color 0.15s",
            boxSizing: "border-box",
            fontFamily: "inherit",
            WebkitAppearance: "none",
            opacity: disabled ? 0.5 : 1,
          }}
        />
        {dirty && !focused && !disabled && (
          <span style={{
            position: "absolute", right: "7px", top: "50%",
            transform: "translateY(-50%)",
            fontSize: "10px", color: C.amber, fontWeight: 700,
          }}>●</span>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FilaProducto({
  producto, precioActual, relevamientoId, empleado,
  esUltima, bloqueado, onGuardado,
}) {
  const token       = localStorage.getItem("token") ?? "";
  const fuente      = producto?.fuente ?? "PROESA";
  const fc          = FUENTE_CONFIG[fuente] ?? FUENTE_CONFIG.PROESA;
  const tienePrecio = !!precioActual?.id;

  const [expandido,   setExpandido]   = useState(false);
  const [valores,     setValores]     = useState({
    precio_compra_caja:   precioActual?.precio_compra_caja   ?? "",
    precio_venta_caja:    precioActual?.precio_venta_caja    ?? "",
    precio_compra_unidad: precioActual?.precio_compra_unidad ?? "",
    precio_venta_unidad:  precioActual?.precio_venta_unidad  ?? "",
    grameaje_ml:          producto?.grameaje_ml              ?? "",
  });
  const [dirtyFields, setDirtyFields] = useState({});
  const [isDirty,     setIsDirty]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [toast,       setToast]       = useState(null);
  const [imgSrc,      setImgSrc]      = useState(producto?.imagen_url ?? null);
  const [imgLoading,  setImgLoading]  = useState(false);
  const fileRef = useRef(null);

  // ── Márgenes calculados en tiempo real ───────────────────────────────────
  const margenCajaPct = (() => {
    const c = parseFloat(valores.precio_compra_caja);
    const v = parseFloat(valores.precio_venta_caja);
    if (!isNaN(c) && !isNaN(v) && v !== 0)
      return Math.round(((v - c) / v) * 10000) / 100;
    return precioActual?.margen_caja_pct ?? null;
  })();

  const margenUnidadPct = (() => {
    const c = parseFloat(valores.precio_compra_unidad);
    const v = parseFloat(valores.precio_venta_unidad);
    if (!isNaN(c) && !isNaN(v) && v !== 0)
      return Math.round(((v - c) / v) * 10000) / 100;
    return precioActual?.margen_unidad_pct ?? null;
  })();

  function handleChange(campo, valor) {
    setValores(v => ({ ...v, [campo]: valor }));
    setDirtyFields(d => ({ ...d, [campo]: true }));
    setIsDirty(true);
  }

  async function handleGuardar() {
    if (!isDirty || loading || bloqueado) return;
    setLoading(true);

    const cambiosProducto = {};
    const cambiosPrecios  = {};

    if (dirtyFields.grameaje_ml && valores.grameaje_ml !== "")
      cambiosProducto.grameaje_ml = parseFloat(valores.grameaje_ml);

    ["precio_compra_caja","precio_venta_caja",
     "precio_compra_unidad","precio_venta_unidad"].forEach(c => {
      if (dirtyFields[c] && valores[c] !== "")
        cambiosPrecios[c] = parseFloat(valores[c]);
    });

    try {
      if (Object.keys(cambiosProducto).length > 0) {
        await fetch(`${API}/api/productos/${producto.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json",
                     Authorization: `Bearer ${token}` },
          body: JSON.stringify(cambiosProducto),
        });
      }

      if (Object.keys(cambiosPrecios).length > 0 && relevamientoId) {
        const url  = tienePrecio
          ? `${API}/api/relevamientos/${relevamientoId}/precios/${precioActual.id}`
          : `${API}/api/relevamientos/${relevamientoId}/precios`;
        const resp = await fetch(url, {
          method: tienePrecio ? "PUT" : "POST",
          headers: { "Content-Type": "application/json",
                     Authorization: `Bearer ${token}` },
          body: JSON.stringify(tienePrecio
            ? cambiosPrecios
            : { producto_id: producto.id, ...cambiosPrecios }),
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.detail ?? "Error al guardar.");
        }
        const data = await resp.json();
        if (onGuardado) onGuardado(data);
      }

      setDirtyFields({});
      setIsDirty(false);
      mostrarToast("✓ Guardado", "ok");
      setTimeout(() => setExpandido(false), 700);

    } catch (e) {
      mostrarToast(e.message ?? "Error al guardar", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleImagen(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setImgLoading(true);
    const formData = new FormData();
    formData.append("imagen", archivo);
    try {
      const resp = await fetch(`${API}/api/productos/${producto.id}/imagen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!resp.ok) throw new Error("Error al subir imagen.");
      const data = await resp.json();
      setImgSrc(data.imagen_url);
      mostrarToast("✓ Imagen actualizada", "ok");
    } catch (e) {
      mostrarToast(e.message, "error");
    } finally {
      setImgLoading(false);
    }
  }

  function mostrarToast(msg, tipo) {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      borderBottom: esUltima ? "none" : `1px solid ${C.gray100}`,
      position: "relative",
    }}>

      {/* ── FILA RESUMEN (siempre visible) ───────────────────────────── */}
      <div
        onClick={() => !bloqueado && setExpandido(e => !e)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 14px",
          cursor: bloqueado ? "default" : "pointer",
          background: expandido ? C.gray50 : C.white,
          minHeight: "52px",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Thumbnail */}
        <div style={{
          width: "40px", height: "40px", flexShrink: 0,
          borderRadius: "8px", overflow: "hidden",
          background: C.gray100,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {imgSrc
            ? <img src={imgSrc} alt={producto.descripcion}
                style={{ width: "100%", height: "100%",
                  objectFit: "contain", padding: "3px" }} />
            : <span style={{ fontSize: "18px" }}>🖼️</span>
          }
        </div>

        {/* Badge fuente + nombre */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center",
            gap: "6px", marginBottom: "3px", flexWrap: "wrap" }}>
            <span style={{
              fontSize: "9.5px", fontWeight: 700,
              color: fc.fg, background: fc.bg,
              padding: "1px 6px", borderRadius: "20px",
              flexShrink: 0,
            }}>
              {fc.icon} {fc.label}
            </span>
            {tienePrecio && !isDirty && (
              <span style={{ fontSize: "9.5px", color: C.green,
                fontWeight: 600 }}>✓</span>
            )}
            {isDirty && (
              <span style={{ fontSize: "9.5px", color: C.amber,
                fontWeight: 600 }}>● pendiente</span>
            )}
          </div>
          <div style={{
            fontSize: "13px", fontWeight: 600, color: C.navy,
            overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", lineHeight: 1.2,
          }}>
            {producto.descripcion}
          </div>
          {producto.marca && (
            <div style={{ fontSize: "11px", color: C.gray400,
              marginTop: "1px" }}>
              {producto.marca}
              {producto.grameaje_ml ? ` · ${producto.grameaje_ml}g/ml` : ""}
            </div>
          )}
        </div>

        {/* Precios resumen + margen */}
        <div style={{ display: "flex", flexDirection: "column",
          alignItems: "flex-end", gap: "3px", flexShrink: 0 }}>
          {precioActual?.precio_venta_caja != null && (
            <span style={{ fontSize: "13px", fontWeight: 700, color: C.navy }}>
              Bs {parseFloat(precioActual.precio_venta_caja).toFixed(2)}
            </span>
          )}
          {margenCajaPct !== null && (
            <span style={{
              fontSize: "11px", fontWeight: 700,
              color: colorMargen(margenCajaPct),
              background: bgMargen(margenCajaPct),
              padding: "1px 7px", borderRadius: "20px",
            }}>
              {margenCajaPct}%
            </span>
          )}
          {!bloqueado && (
            <span style={{
              fontSize: "14px", color: C.gray400,
              transform: expandido ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s", lineHeight: 1,
            }}>⌄</span>
          )}
        </div>
      </div>

      {/* ── FORMULARIO EXPANDIDO ─────────────────────────────────────── */}
      {expandido && !bloqueado && (
        <div style={{
          padding: "12px 14px",
          background: C.gray50,
          borderTop: `1px solid ${C.gray100}`,
          display: "flex", flexDirection: "column", gap: "12px",
        }}>

          {/* Grameaje */}
          <InputPrecio
            label="Grameaje / ML"
            campo="grameaje_ml"
            valores={valores}
            onChange={handleChange}
            dirtyFields={dirtyFields}
          />

          {/* Precios caja */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600,
              color: C.gray600, letterSpacing: "0.4px",
              textTransform: "uppercase", marginBottom: "6px" }}>
              Precios por caja
            </div>
            <div style={{ display: "grid",
              gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <InputPrecio label="Compra" campo="precio_compra_caja"
                valores={valores} onChange={handleChange}
                dirtyFields={dirtyFields} />
              <InputPrecio label="Venta" campo="precio_venta_caja"
                valores={valores} onChange={handleChange}
                dirtyFields={dirtyFields} />
            </div>
            {margenCajaPct !== null && (
              <div style={{
                marginTop: "6px", padding: "7px 10px",
                borderRadius: "8px", background: bgMargen(margenCajaPct),
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ fontSize: "11px", color: C.gray600,
                  fontWeight: 600 }}>Margen caja</span>
                <span style={{ fontSize: "15px", fontWeight: 700,
                  color: colorMargen(margenCajaPct) }}>
                  {margenCajaPct}%
                </span>
              </div>
            )}
          </div>

          {/* Precios unidad */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600,
              color: C.gray600, letterSpacing: "0.4px",
              textTransform: "uppercase", marginBottom: "6px" }}>
              Precios por unidad
            </div>
            <div style={{ display: "grid",
              gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <InputPrecio label="Compra" campo="precio_compra_unidad"
                valores={valores} onChange={handleChange}
                dirtyFields={dirtyFields} />
              <InputPrecio label="Venta" campo="precio_venta_unidad"
                valores={valores} onChange={handleChange}
                dirtyFields={dirtyFields} />
            </div>
            {margenUnidadPct !== null && (
              <div style={{
                marginTop: "6px", padding: "7px 10px",
                borderRadius: "8px", background: bgMargen(margenUnidadPct),
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ fontSize: "11px", color: C.gray600,
                  fontWeight: 600 }}>Margen unidad</span>
                <span style={{ fontSize: "15px", fontWeight: 700,
                  color: colorMargen(margenUnidadPct) }}>
                  {margenUnidadPct}%
                </span>
              </div>
            )}
          </div>

          {/* Imagen */}
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: "100%", height: `${TOUCH}px`,
              background: C.white,
              border: `1px dashed ${C.gray200}`,
              borderRadius: "8px", fontSize: "12px", color: C.gray400,
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: "6px",
              WebkitTapHighlightColor: "transparent",
            }}
            type="button"
          >
            {imgLoading ? <Spinner /> : "📷"}
            <span>{imgLoading ? "Subiendo…"
              : imgSrc ? "Cambiar imagen" : "Agregar imagen"}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleImagen}
          />

          {/* Guardar */}
          <button
            onClick={handleGuardar}
            disabled={!isDirty || loading}
            style={{
              width: "100%", height: "48px",
              background: isDirty ? C.red : C.gray100,
              color: isDirty ? C.white : C.gray400,
              border: "none", borderRadius: "10px",
              fontSize: "14px", fontWeight: 700,
              cursor: isDirty && !loading ? "pointer" : "default",
              display: "flex", alignItems: "center",
              justifyContent: "center", gap: "7px",
              transition: "all 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}
            type="button"
          >
            {loading ? <Spinner /> : isDirty ? "💾 Guardar" : "✓ Sin cambios"}
          </button>

        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "absolute",
          bottom: "8px", left: "14px", right: "14px",
          background: toast.tipo === "ok" ? C.green : C.red,
          color: C.white, fontSize: "12px", fontWeight: 600,
          padding: "8px 12px", borderRadius: "8px",
          textAlign: "center", zIndex: 10,
          boxShadow: "0 3px 10px rgba(0,0,0,0.15)",
        }}>
          {toast.msg}
        </div>
      )}

    </div>
  );
}