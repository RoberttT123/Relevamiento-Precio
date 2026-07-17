// -*- coding: utf-8 -*-
/**
 * FilaProducto.jsx — Fila editable dentro del acordeón de categoría
 * ------------------------------------------------------------------
 * Muestra: badge fuente · nombre · precios compra/venta · margen · price index
 * Al tocar la fila se expande para editar los campos.
 *
 * Props:
 *   producto        { id, descripcion, marca, fuente, grameaje_ml,
 *                     imagen_url, categoria_nombre, grupo, es_lider }
 *   precioActual    { id, precio_compra_caja, precio_venta_caja,
 *                     precio_compra_unidad, precio_venta_unidad,
 *                     margen_caja_pct, margen_unidad_pct } | null
 *   relevamientoId  string
 *   empleado        { id, nombre, rol }
 *   esUltima        boolean
 *   bloqueado       boolean (relevamiento finalizado)
 *   onGuardado      (precioActualizado) => void
 *   onProductoActualizado (productoActualizado) => void  — para reflejar cambios de líder/grupo
 *   precioLider     number | null — Precio x Gr/ML del líder del mismo grupo
 *                   (precio_venta_unidad ÷ grameaje_ml del líder)
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
  gold:       "#F5A623",
  white:      "#FFFFFF",
  gray50:     "#F8F9FF",
  gray100:    "#F0F0F0",
  gray200:    "#E6E6E6",
  gray400:    "#AAAAAA",
  gray600:    "#666666",
};

// ─── Base de API, sin barra final ────────────────────────────────────────────
const API   = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const TOUCH = 44;

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// Price Index: (Precio x Gr/ML del producto ÷ Precio x Gr/ML del líder) × 100
// Misma base y misma dirección que el index_real que calcula el backend.
// Si el producto es más caro por gr/ml que el líder → pasa el 100%
function calcPriceIndex(precioGrMlProducto, precioGrMlLider) {
  if (!precioGrMlProducto || !precioGrMlLider) return null;
  const p = parseFloat(precioGrMlProducto);
  const l = parseFloat(precioGrMlLider);
  if (isNaN(p) || isNaN(l) || l === 0) return null;
  return Math.round((p / l) * 10000) / 100;
}

function colorPriceIndex(pi) {
  if (pi == null) return C.gray400;
  if (pi <= 100)  return C.green;   // igual o más barato que el líder
  if (pi <= 130)  return C.amber;   // hasta 30% más caro
  return C.red;                     // más de 30% más caro que el líder
}
function bgPriceIndex(pi) {
  if (pi == null) return C.gray100;
  if (pi <= 100)  return C.greenLight;
  if (pi <= 130)  return C.amberLight;
  return C.redLight;
}

// ─── Configuración de badges por fuente ──────────────────────────────────────
const FUENTE_CONFIG = {
  PROESA:      { bg: C.navy,  fg: C.white, icon: "🏢", label: "PROESA" },
  COMPETENCIA: { bg: C.red,   fg: C.white, icon: "⚡", label: "COMP."  },
  SEGUIDOR:    { bg: C.amber, fg: C.navy,  icon: "◎", label: "SEG."   },
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

// ─── Input de texto inline (para el campo grupo) ──────────────────────────────
function InputTexto({ label, value, onChange, placeholder, disabled }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "10px", fontWeight: 600, color: C.gray600,
        letterSpacing: "0.4px", textTransform: "uppercase" }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          height: `${TOUCH}px`,
          padding: "0 12px",
          border: `1.5px solid ${focused ? C.red : C.gray200}`,
          borderRadius: "8px",
          fontSize: "14px",
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
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FilaProducto({
  producto, precioActual, relevamientoId, empleado,
  esUltima, bloqueado, onGuardado, onProductoActualizado,
  precioLider,
}) {
  const token       = localStorage.getItem("token") ?? "";
  const fuente      = producto?.fuente ?? "PROESA";
  const fc          = FUENTE_CONFIG[fuente] ?? FUENTE_CONFIG.PROESA;
  const tienePrecio = !!precioActual?.id;
  const esAdmin     = empleado?.rol?.toLowerCase() === "admin";

  // Debug temporal — borrar después de confirmar que funciona
  if (process.env.NODE_ENV === "development") {
    console.log("[FilaProducto] rol empleado:", empleado?.rol, "| esAdmin:", esAdmin);
  }

  const [expandido,    setExpandido]    = useState(false);
  const [esLider,      setEsLider]      = useState(producto?.es_lider ?? false);
  const [grupo,        setGrupo]        = useState(producto?.grupo ?? "");
  const [loadingLider, setLoadingLider] = useState(false);
  const [valores,      setValores]      = useState({
    precio_compra_caja:   precioActual?.precio_compra_caja   ?? "",
    precio_venta_caja:    precioActual?.precio_venta_caja    ?? "",
    precio_compra_unidad: precioActual?.precio_compra_unidad ?? "",
    precio_venta_unidad:  precioActual?.precio_venta_unidad  ?? "",
    grameaje_ml:          producto?.grameaje_ml              ?? "",
    unidades_caja:        producto?.unidades_caja            ?? "",
    index_marca:          precioActual?.index_marca          ?? "",
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

  // ── Price Index calculado en tiempo real ─────────────────────────────────
  // Compara el Precio x Gr/ML del producto actual (precio_venta_unidad
  // editado o guardado ÷ grameaje_ml editado o guardado) contra el
  // Precio x Gr/ML del líder del grupo, que viene de Productos.jsx —
  // misma base que usa el backend para calcular index_real.
  const precioVentaUnidadActual = parseFloat(valores.precio_venta_unidad) ||
    parseFloat(precioActual?.precio_venta_unidad) || null;
  const gramajeActual = parseFloat(valores.grameaje_ml) || null;
  const precioGrMlActual = (precioVentaUnidadActual && gramajeActual)
    ? precioVentaUnidadActual / gramajeActual
    : null;
  const priceIndex = esLider ? 100 : calcPriceIndex(precioGrMlActual, precioLider);

  function handleChange(campo, valor) {
    setValores(v => ({ ...v, [campo]: valor }));
    setDirtyFields(d => ({ ...d, [campo]: true }));
    setIsDirty(true);
  }

  // ── Toggle líder ─────────────────────────────────────────────────────────
  async function handleToggleLider(e) {
    e.stopPropagation();
    if (loadingLider) return;

    setLoadingLider(true);
    try {
      const resp = await fetch(`${API}/api/productos/${producto.id}/lider`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail ?? "Error al cambiar líder.");
      }
      const prodActualizado = await resp.json();
      setEsLider(prodActualizado.es_lider);
      if (onProductoActualizado) onProductoActualizado(prodActualizado);
      mostrarToast(prodActualizado.es_lider ? "⭐ Marcado como líder" : "Desmarcado como líder", "ok");
    } catch (err) {
      mostrarToast(err.message ?? "Error", "error");
    } finally {
      setLoadingLider(false);
    }
  }

  // ── Guardar precios y grupo ───────────────────────────────────────────────
  async function handleGuardar() {
    if (!isDirty || loading || bloqueado) return;
    setLoading(true);

    const cambiosProducto = {};
    const cambiosPrecios  = {};

    if (dirtyFields.grameaje_ml && valores.grameaje_ml !== "")
      cambiosProducto.grameaje_ml = parseFloat(valores.grameaje_ml);

    if (dirtyFields.unidades_caja && valores.unidades_caja !== "")
      cambiosProducto.unidades_caja = parseFloat(valores.unidades_caja);

    // Guardar grupo si cambió
    const grupoActual = producto?.grupo ?? "";
    if (grupo !== grupoActual)
      cambiosProducto.grupo = grupo.trim() || null;

    ["precio_compra_caja","precio_venta_caja",
     "precio_compra_unidad","precio_venta_unidad",
     "index_marca"].forEach(c => {
      if (dirtyFields[c] && valores[c] !== "")
        cambiosPrecios[c] = parseFloat(valores[c]);
    });

    try {
      if (Object.keys(cambiosProducto).length > 0) {
        const r = await fetch(`${API}/api/productos/${producto.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json",
                     Authorization: `Bearer ${token}` },
          body: JSON.stringify(cambiosProducto),
        });
        if (r.ok && onProductoActualizado) {
          const prodActualizado = await r.json();
          onProductoActualizado(prodActualizado);
        }
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

    } catch (err) {
      mostrarToast(err.message ?? "Error al guardar", "error");
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
    } catch (err) {
      mostrarToast(err.message, "error");
    } finally {
      setImgLoading(false);
    }
  }

  function mostrarToast(msg, tipo) {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2500);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Guarda defensiva: si producto es undefined después de un update, no romper
  if (!producto?.descripcion) return null;

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

        {/* Badge fuente + nombre + grupo */}
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
            {/* Badge de líder adicional si es_lider aunque fuente no sea PROESA */}
            {esLider && fuente !== "PROESA" && (
              <span style={{
                fontSize: "9.5px", fontWeight: 700,
                color: C.white, background: C.gold,
                padding: "1px 6px", borderRadius: "20px",
                flexShrink: 0,
              }}>⭐ líder</span>
            )}
            {tienePrecio && !isDirty && (
              <span style={{ fontSize: "9.5px", color: C.green, fontWeight: 600 }}>✓</span>
            )}
            {isDirty && (
              <span style={{ fontSize: "9.5px", color: C.amber, fontWeight: 600 }}>● pendiente</span>
            )}
          </div>
          <div style={{
            fontSize: "13px", fontWeight: 600, color: C.navy,
            overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", lineHeight: 1.2,
          }}>
            {producto.descripcion}
          </div>
          <div style={{ fontSize: "11px", color: C.gray400, marginTop: "1px" }}>
            {producto.marca}
            {producto.grameaje_ml ? ` · ${producto.grameaje_ml}g/ml` : ""}
            {producto.unidades_caja ? ` · ${producto.unidades_caja}ud/cja` : ""}
            {grupo ? ` · ${grupo}` : ""}
          </div>
        </div>

        {/* Precios resumen + margen + Price Index */}
        <div style={{ display: "flex", flexDirection: "column",
          alignItems: "flex-end", gap: "3px", flexShrink: 0 }}>

          {/* Precio de venta caja */}
          {precioActual?.precio_venta_caja != null && (
            <span style={{ fontSize: "13px", fontWeight: 700, color: C.navy }}>
              Bs {parseFloat(precioActual.precio_venta_caja).toFixed(2)}
            </span>
          )}

          {/* Margen */}
          {margenCajaPct !== null && (
            <span style={{
              fontSize: "10px", fontWeight: 700,
              color: colorMargen(margenCajaPct),
              background: bgMargen(margenCajaPct),
              padding: "1px 6px", borderRadius: "20px",
            }}>
              {margenCajaPct}%
            </span>
          )}

          {/* Price Index — solo si hay líder del grupo y no es el mismo líder */}
          {priceIndex !== null && (
            <span style={{
              fontSize: "10px", fontWeight: 700,
              color: colorPriceIndex(priceIndex),
              background: bgPriceIndex(priceIndex),
              padding: "1px 6px", borderRadius: "20px",
            }}>
              {esLider ? "100% líder" : `PI ${priceIndex}%`}
            </span>
          )}

          {/* Botón toggle líder — admins y relevadores, se ve en la fila resumen */}
          {!bloqueado && (
            <button
              onClick={handleToggleLider}
              disabled={loadingLider}
              title={esLider ? "Desmarcar como líder" : "Marcar como líder de este grupo"}
              style={{
                background: esLider ? "#FFF8E1" : C.gray50,
                border: `1.5px solid ${esLider ? C.gold : C.gray200}`,
                borderRadius: "8px",
                cursor: loadingLider ? "wait" : "pointer",
                fontSize: "12px",
                fontWeight: 600,
                color: esLider ? C.gold : C.gray400,
                padding: "3px 10px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                flexShrink: 0,
                transition: "all 0.15s",
                WebkitTapHighlightColor: "transparent",
              }}
              type="button"
            >
              {loadingLider ? "…" : esLider ? "⭐ Líder" : "☆ Marcar líder"}
            </button>
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

          {/* Grameaje / ML  —  Unidades por caja */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600,
              color: C.gray600, letterSpacing: "0.4px",
              textTransform: "uppercase", marginBottom: "6px" }}>
              Presentación
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <InputPrecio
                label="Grameaje / ML"
                campo="grameaje_ml"
                valores={valores}
                onChange={handleChange}
                dirtyFields={dirtyFields}
              />
              <InputPrecio
                label="Unidades x caja"
                campo="unidades_caja"
                valores={valores}
                onChange={handleChange}
                dirtyFields={dirtyFields}
              />
            </div>
          </div>

          {/* Precios caja */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600,
              color: C.gray600, letterSpacing: "0.4px",
              textTransform: "uppercase", marginBottom: "6px" }}>
              Precios por caja
            </div>
            <div style={{ display: "grid",
              gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <InputPrecio label="Venta (Bs.)" campo="precio_venta_caja"
                valores={valores} onChange={handleChange}
                dirtyFields={dirtyFields} />
              <InputPrecio label="Compra (Bs.)" campo="precio_compra_caja"
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
              <InputPrecio label="Venta (Bs.)" campo="precio_venta_unidad"
                valores={valores} onChange={handleChange}
                dirtyFields={dirtyFields} />
              <InputPrecio label="Compra (Bs.)" campo="precio_compra_unidad"
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

          {/* Index Marca — valor fijo que provee la marca, ingresado manualmente */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600,
              color: C.gray600, letterSpacing: "0.4px",
              textTransform: "uppercase", marginBottom: "6px" }}>
              Index Marca
            </div>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Ej: 85.5"
                value={valores.index_marca ?? ""}
                onChange={e => handleChange("index_marca", e.target.value)}
                style={{
                  width: "100%",
                  height: `${TOUCH}px`,
                  padding: "0 8px 0 12px",
                  border: `1.5px solid ${dirtyFields.index_marca ? C.amber : C.gray200}`,
                  borderRadius: "8px",
                  fontSize: "15px",
                  color: C.navy,
                  background: C.gray50,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  WebkitAppearance: "none",
                }}
              />
              <span style={{
                position: "absolute", right: "10px", top: "50%",
                transform: "translateY(-50%)",
                fontSize: "11px", color: C.gray400, pointerEvents: "none",
              }}>%</span>
            </div>
            {valores.index_marca !== "" && (
              <div style={{
                marginTop: "6px", padding: "5px 10px",
                borderRadius: "8px", background: C.gray100,
                fontSize: "11px", color: C.gray600,
              }}>
                Valor fijo provisto por la marca
              </div>
            )}
          </div>

          {/* Price Index real — calculado automáticamente vs el líder */}
          {/* Price Index expandido — con contexto del grupo */}
          {priceIndex !== null && !esLider && (
            <div style={{
              padding: "9px 12px",
              borderRadius: "8px",
              background: bgPriceIndex(priceIndex),
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600,
                  color: C.gray600, textTransform: "uppercase",
                  letterSpacing: "0.4px" }}>Price Index</div>
                <div style={{ fontSize: "11px", color: C.gray400, marginTop: "1px" }}>
                  respecto al líder del grupo
                </div>
              </div>
              <span style={{ fontSize: "18px", fontWeight: 700,
                color: colorPriceIndex(priceIndex) }}>
                {priceIndex}%
              </span>
            </div>
          )}

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
            {imgLoading ? <Spinner size={14} /> : "📷"}
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

          {/* Toggle líder — dentro del form expandido, más fácil de encontrar.
              Disponible para admins y relevadores (ya estamos dentro de un
              bloque gateado por !bloqueado más arriba). */}
          <button
            onClick={handleToggleLider}
            disabled={loadingLider}
            type="button"
            style={{
              width: "100%", height: "44px",
              background: esLider ? "#FFF8E1" : C.white,
              border: `2px solid ${esLider ? C.gold : C.gray200}`,
              borderRadius: "10px",
              fontSize: "13.5px", fontWeight: 700,
              color: esLider ? C.gold : C.gray400,
              cursor: loadingLider ? "wait" : "pointer",
              display: "flex", alignItems: "center",
              justifyContent: "center", gap: "8px",
              transition: "all 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {loadingLider
              ? "Guardando…"
              : esLider
                ? "⭐ Este producto es el LÍDER del grupo — tocar para desmarcar"
                : "☆ Marcar como LÍDER de este grupo"}
          </button>

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