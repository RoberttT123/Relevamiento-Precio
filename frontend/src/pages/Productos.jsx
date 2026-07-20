// -*- coding: utf-8 -*-
/**
 * Productos.jsx — Vista agrupada por categoría
 * ---------------------------------------------
 * Muestra acordeones por categoría. Dentro de cada uno,
 * los productos ordenados PROESA → COMPETENCIA → SEGUIDOR,
 * todos con sus precios visibles a la vez para comparar.
 *
 * Props:
 *   empleado  { id, nombre, rol, codigo_empleado }
 */

import { useState, useEffect, useCallback } from "react";
import FilaProducto from "../components/FilaProducto";

// ─── Tokens PROESA ────────────────────────────────────────────────────────────
const C = {
  navy:      "#1A1A2E",
  red:       "#E63946",
  redLight:  "rgba(230,57,70,0.10)",
  green:     "#2A9D5C",
  greenLight:"rgba(42,157,92,0.10)",
  amber:     "#E9A825",
  white:     "#FFFFFF",
  gray50:    "#F8F9FF",
  gray100:   "#F0F0F0",
  gray200:   "#E6E6E6",
  gray400:   "#AAAAAA",
  gray600:   "#666666",
  border:    "#E6E6E6",
};

// ─── Base de API, sin barra final ────────────────────────────────────────────
// Evita el bug de "//api/..." si VITE_API_URL quedó con "/" al final en el .env.
const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

// ─── Orden de fuentes para mostrar dentro de cada categoría ──────────────────
const ORDEN_FUENTE = { PROESA: 0, COMPETENCIA: 1, SEGUIDOR: 2 };

// ─── Rubros para los tabs ─────────────────────────────────────────────────────
const RUBROS = [
  { id: "Todos",              icon: "📦" },
  { id: "Alimentos",          icon: "🍫" },
  { id: "Bebidas y Tabacos",  icon: "🥃" },
  { id: "Higiene y Limpieza", icon: "🧴" },
];

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: C.gray50,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: "2rem",
  },

  // ── Barra de filtros ──────────────────────────────────────────────────────
  filterBar: {
    background: C.white,
    borderBottom: `1px solid ${C.border}`,
    padding: "10px 1rem",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  searchWrap: {
    position: "relative",
    flex: "1 1 160px",
    minWidth: "140px",
  },
  searchIcon: {
    position: "absolute", left: "10px", top: "50%",
    transform: "translateY(-50%)",
    fontSize: "14px", color: C.gray400, pointerEvents: "none",
  },
  searchInput: (focused) => ({
    width: "100%", height: "38px",
    padding: "0 10px 0 32px",
    border: `1px solid ${focused ? C.red : C.border}`,
    borderRadius: "8px", fontSize: "14px", color: C.navy,
    background: focused ? C.white : C.gray50,
    outline: "none",
    boxShadow: focused ? `0 0 0 3px ${C.redLight}` : "none",
    transition: "all 0.15s", boxSizing: "border-box",
    fontFamily: "inherit",
  }),
  toggleFuente: {
    display: "flex", background: C.gray100,
    borderRadius: "8px", padding: "3px", gap: "2px",
  },
  toggleBtn: (activo) => ({
    padding: "4px 10px", borderRadius: "6px", border: "none",
    fontSize: "11.5px", fontWeight: activo ? 600 : 400,
    color: activo ? C.navy : C.gray400,
    background: activo ? C.white : "transparent",
    cursor: "pointer", transition: "all 0.15s",
    boxShadow: activo ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
    whiteSpace: "nowrap",
    WebkitTapHighlightColor: "transparent",
  }),
  contador: {
    marginLeft: "auto", fontSize: "12px",
    color: C.gray400, whiteSpace: "nowrap",
  },

  // ── Tabs de rubro ─────────────────────────────────────────────────────────
  rubroTabs: {
    background: C.white,
    borderBottom: `1px solid ${C.border}`,
    padding: "0 1rem",
    display: "flex", gap: "0", overflowX: "auto",
  },
  rubroTab: (activo) => ({
    padding: "10px 14px", fontSize: "13px",
    fontWeight: activo ? 600 : 400,
    color: activo ? C.navy : C.gray400,
    borderBottom: activo ? `3px solid ${C.red}` : "3px solid transparent",
    borderTop: "none", borderLeft: "none", borderRight: "none",
    background: "none", cursor: "pointer", whiteSpace: "nowrap",
    transition: "color 0.15s, border-bottom-color 0.15s",
    outline: "none", WebkitTapHighlightColor: "transparent",
  }),

  // ── Banner ────────────────────────────────────────────────────────────────
  banner: (estado) => ({
    margin: "10px 1rem 0",
    padding: "10px 14px", borderRadius: "10px",
    background: estado === "finalizado" ? C.gray100 : C.redLight,
    border: `1px solid ${estado === "finalizado" ? C.border : C.red}`,
    display: "flex", alignItems: "center",
    justifyContent: "space-between", flexWrap: "wrap", gap: "8px",
  }),
  bannerText: {
    fontSize: "13px", color: C.navy, fontWeight: 500,
    display: "flex", alignItems: "center", gap: "8px",
  },
  bannerBtn: (hover, color) => ({
    padding: "5px 14px",
    background: hover ? (color === "red" ? "#CC2F3B" : "#555") : (color === "red" ? C.red : "#444"),
    color: C.white, border: "none", borderRadius: "6px",
    fontSize: "12px", fontWeight: 600, cursor: "pointer",
    transition: "background 0.15s",
    WebkitTapHighlightColor: "transparent",
  }),

  // ── Acordeón de categoría ─────────────────────────────────────────────────
  categoriaWrap: {
    margin: "10px 1rem 0",
    background: C.white,
    borderRadius: "12px",
    border: `1px solid ${C.border}`,
    overflow: "hidden",
  },
  categoriaHeader: (expandido) => ({
    display: "flex", alignItems: "center", gap: "10px",
    padding: "13px 14px", cursor: "pointer",
    background: expandido ? C.gray50 : C.white,
    borderBottom: expandido ? `1px solid ${C.border}` : "none",
    WebkitTapHighlightColor: "transparent",
    minHeight: "52px",
  }),
  categoriaIcon: {
    fontSize: "18px", flexShrink: 0,
  },
  categoriaNombre: {
    fontSize: "14px", fontWeight: 700, color: C.navy, flex: 1,
  },
  categoriaStats: {
    display: "flex", alignItems: "center", gap: "8px",
  },
  chipCargados: (n, total) => ({
    fontSize: "11px", fontWeight: 600,
    color: n === total ? C.green : C.amber,
    background: n === total ? C.greenLight : "rgba(233,168,37,0.12)",
    padding: "2px 9px", borderRadius: "20px",
    whiteSpace: "nowrap",
  }),
  flecha: (expandido) => ({
    fontSize: "16px", color: C.gray400,
    transform: expandido ? "rotate(180deg)" : "rotate(0deg)",
    transition: "transform 0.2s", lineHeight: 1, flexShrink: 0,
  }),

  // ── Skeleton ──────────────────────────────────────────────────────────────
  skeletonWrap: {
    margin: "10px 1rem 0", borderRadius: "12px",
    border: `1px solid ${C.border}`, overflow: "hidden",
    background: C.white,
  },
  skeletonHeader: {
    height: "52px",
    background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
  },

  // ── Estado vacío ──────────────────────────────────────────────────────────
  empty: {
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "4rem 1rem", gap: "10px",
    color: C.gray400, textAlign: "center",
  },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={S.skeletonWrap}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={S.skeletonHeader} />
    </div>
  );
}

// ─── Acordeón de una categoría ────────────────────────────────────────────────
function CategoriaAcordeon({
  categoria, productos, precios, relevamiento, empleado, onGuardado, onProductoActualizado,
}) {
  const sinPrecio = productos.filter(p => !precios[p.id]).length;
  const [expandido, setExpandido] = useState(sinPrecio > 0 && productos.length <= 6);

  const cargados   = productos.filter(p => !!precios[p.id]).length;
  const total      = productos.length;
  const finalizado = relevamiento?.estado === "finalizado";

  // ── Calcular Precio x Gr/ML del líder por grupo ───────────────────────────
  // Para cada grupo dentro de esta categoría, encontramos el producto
  // marcado como es_lider y usamos su Precio x Gr/ML (precio_venta_unidad
  // ÷ grameaje_ml) como referencia — así el Price Index en pantalla queda
  // calculado con la misma base que el index_real que guarda el backend.
  // Si hay productos sin grupo, sin líder, o al líder le falta grameaje,
  // precioLiderPorGrupo[grupo] queda undefined.
  const precioLiderPorGrupo = {};
  productos.forEach(prod => {
    if (prod.es_lider && prod.grupo) {
      const precio   = precios[prod.id];
      const gramaje  = parseFloat(prod.grameaje_ml);
      const precioUd = parseFloat(precio?.precio_venta_unidad);
      if (precioUd && gramaje) {
        precioLiderPorGrupo[prod.grupo] = precioUd / gramaje;
      }
    }
  });

  // Ordenar: PROESA → COMPETENCIA → SEGUIDOR
  const ordenados = [...productos].sort(
    (a, b) => (ORDEN_FUENTE[a.fuente] ?? 9) - (ORDEN_FUENTE[b.fuente] ?? 9)
  );

  return (
    <div style={S.categoriaWrap}>
      <div
        style={S.categoriaHeader(expandido)}
        onClick={() => setExpandido(e => !e)}
      >
        <div style={S.categoriaIcon}>🏷️</div>
        <div style={S.categoriaNombre}>{categoria}</div>
        <div style={S.categoriaStats}>
          <span style={S.chipCargados(cargados, total)}>
            {cargados}/{total}
          </span>
          <span style={S.flecha(expandido)}>⌄</span>
        </div>
      </div>

      {expandido && (
        <div>
          {ordenados.map((prod, i) => (
            <FilaProducto
              key={prod.id}
              producto={prod}
              precioActual={precios[prod.id] ?? null}
              relevamientoId={relevamiento?.id ?? null}
              empleado={empleado}
              esUltima={i === ordenados.length - 1}
              bloqueado={finalizado}
              onGuardado={onGuardado}
              onProductoActualizado={onProductoActualizado}
              precioLider={prod.grupo ? precioLiderPorGrupo[prod.grupo] ?? null : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Productos({ empleado }) {
  const token = localStorage.getItem("token") ?? "";

  // ── Límite de relevamientos por período (mes), por empleado ──────────────
  // Coincide con LIMITE_MENSUAL en backend/relevamientos.py.
  const LIMITE_MENSUAL = 4;

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [busqueda,     setBusqueda]     = useState("");
  const [rubroActivo,  setRubroActivo]  = useState("Todos");
  const [fuenteFiltro, setFuenteFiltro] = useState("Todos");
  const [focusBusq,    setFocusBusq]    = useState(false);
  const [hoverFinal,   setHoverFinal]   = useState(false);
  const [hoverReabrir, setHoverReabrir] = useState(false);

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [productos,    setProductos]    = useState([]);
  const [precios,      setPrecios]      = useState({});
  const [relevamiento, setRelevamiento] = useState(null);
  const [loadingProds, setLoadingProds] = useState(true);
  const [loadingRelev, setLoadingRelev] = useState(true);
  const [error,        setError]        = useState(null);
  const [errorRelev,   setErrorRelev]   = useState(null);

  // ── Cargar productos ──────────────────────────────────────────────────────
  const cargarProductos = useCallback(async () => {
    setLoadingProds(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (rubroActivo !== "Todos")    params.set("rubro", rubroActivo);
      if (fuenteFiltro !== "Todos")   params.set("fuente", fuenteFiltro);
      if (busqueda.trim())            params.set("busqueda", busqueda.trim());

      const resp = await fetch(`${API}/api/productos?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Error al cargar productos.");
      setProductos(await resp.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingProds(false);
    }
  }, [rubroActivo, fuenteFiltro, busqueda, token]);

  // ── Cargar o crear relevamiento del mes ───────────────────────────────────
  // Un mismo empleado puede tener hasta LIMITE_MENSUAL relevamientos en el
  // mismo período. Regla de entrada a la pantalla:
  //   1. Si hay un relevamiento en borrador este mes → seguimos con ese.
  //   2. Si no hay borrador pero todavía queda cupo (< LIMITE_MENSUAL)
  //      → creamos uno nuevo automáticamente.
  //   3. Si ya se llegó al límite (todos finalizados) → mostramos el más
  //      reciente en modo lectura; el usuario puede "Reabrir" ese mismo
  //      desde el banner si necesita seguir cargando precios.
  const cargarRelevamiento = useCallback(async () => {
    setLoadingRelev(true);
    setErrorRelev(null);
    try {
      const ahora  = new Date();
      const periodo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;

      const resp  = await fetch(
        `${API}/api/relevamientos?periodo=${periodo}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail ?? "Error al cargar el relevamiento del mes.");
      }
      // Viene ordenada por created_at desc → lista[0] es la más reciente
      const lista = await resp.json();

      const enBorrador = lista.find(r => r.estado === "borrador");

      if (enBorrador) {
        setRelevamiento(enBorrador);
        cargarPrecios(enBorrador.id);
      } else if (lista.length < LIMITE_MENSUAL) {
        const crear = await fetch(`${API}/api/relevamientos`, {
          method: "POST",
          headers: { "Content-Type": "application/json",
                     Authorization: `Bearer ${token}` },
          body: JSON.stringify({ periodo }),
        });
        if (crear.ok) {
          const nuevo = await crear.json();
          setRelevamiento(nuevo);
        } else {
          const err = await crear.json().catch(() => ({}));
          throw new Error(err.detail ?? "No se pudo crear el relevamiento del mes.");
        }
      } else {
        const ultimo = lista[0] ?? null;
        setRelevamiento(ultimo);
        if (ultimo) cargarPrecios(ultimo.id);
      }
    } catch (e) {
      // Antes esto quedaba en silencio: relevamiento se quedaba en null,
      // no aparecía ningún banner, y como bloqueado también daba false
      // (relevamiento null), se podía seguir "guardando" sin que nada se
      // persistiera de verdad. Ahora se avisa explícitamente.
      setErrorRelev(e.message ?? "Error al cargar el relevamiento del mes.");
    } finally {
      setLoadingRelev(false);
    }
  }, [token]);

  // ── Cargar precios ────────────────────────────────────────────────────────
  async function cargarPrecios(relevamientoId) {
    try {
      const resp  = await fetch(
        `${API}/api/relevamientos/${relevamientoId}/precios`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const lista = await resp.json();
      const mapa  = {};
      lista.forEach(p => { mapa[p.producto_id] = p; });
      setPrecios(mapa);
    } catch (_) {}
  }

  // ── Finalizar ─────────────────────────────────────────────────────────────
  async function handleFinalizar() {
    if (!relevamiento || relevamiento.estado === "finalizado") return;
    if (!confirm("¿Finalizar el relevamiento? Podrás reabrirlo si necesitás cambios.")) return;
    try {
      const resp = await fetch(
        `${API}/api/relevamientos/${relevamiento.id}/finalizar`,
        { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) setRelevamiento(await resp.json());
    } catch (_) {}
  }

  // ── Reabrir ───────────────────────────────────────────────────────────────
  async function handleReabrir() {
    if (!relevamiento || relevamiento.estado === "borrador") return;
    if (!confirm("¿Reabrir el relevamiento para editar?")) return;
    try {
      const resp = await fetch(
        `${API}/api/relevamientos/${relevamiento.id}/reabrir`,
        { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) setRelevamiento(await resp.json());
    } catch (_) {}
  }

  // ── Callback precio guardado ──────────────────────────────────────────────
  function handlePrecioGuardado(precioActualizado) {
    setPrecios(prev => ({
      ...prev,
      [precioActualizado.producto_id]: precioActualizado,
    }));
  }

  // ── Callback producto actualizado (grupo, es_lider, etc.) ─────────────────
  function handleProductoActualizado(prodActualizado) {
    if (!prodActualizado?.id) return; // guarda: ignorar si viene incompleto
    setProductos(prev => prev.map(p => {
      if (p.id !== prodActualizado.id) return p;
      // Merge defensivo: solo sobreescribir campos que vienen definidos
      const merged = { ...p };
      Object.keys(prodActualizado).forEach(key => {
        if (prodActualizado[key] !== null && prodActualizado[key] !== undefined) {
          merged[key] = prodActualizado[key];
        }
      });
      return merged;
    }));
  }

  // ── Efectos ───────────────────────────────────────────────────────────────
  useEffect(() => { cargarProductos();    }, [cargarProductos]);
  useEffect(() => { cargarRelevamiento(); }, [cargarRelevamiento]);

  // ── Agrupar productos por categoría ──────────────────────────────────────
  const porCategoria = productos.reduce((acc, prod) => {
    const cat = prod.categoria_nombre || "Sin categoría";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(prod);
    return acc;
  }, {});

  const categorias = Object.keys(porCategoria).sort();

  // ── Totales ───────────────────────────────────────────────────────────────
  const totalProductos = productos.length;
  const totalCargados  = productos.filter(p => !!precios[p.id]).length;
  const finalizado     = relevamiento?.estado === "finalizado";

  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                 "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const ahora       = new Date();
  const periodoLabel = `${MESES[ahora.getMonth()]} ${ahora.getFullYear()}`;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* ── Barra de filtros ─────────────────────────────────────────── */}
      <div style={S.filterBar}>
        <div style={S.searchWrap}>
          <span style={S.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Buscar producto o marca…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onFocus={() => setFocusBusq(true)}
            onBlur={() => setFocusBusq(false)}
            style={S.searchInput(focusBusq)}
          />
        </div>

        <div style={S.toggleFuente}>
          {["Todos","PROESA","COMPETENCIA","SEGUIDOR"].map(f => (
            <button
              key={f}
              style={S.toggleBtn(fuenteFiltro === f)}
              onClick={() => setFuenteFiltro(f)}
              type="button"
            >
              {f === "Todos"       ? "Todos"
             : f === "PROESA"      ? "🏢"
             : f === "COMPETENCIA" ? "⚡"
             :                       "◎"}
            </button>
          ))}
        </div>

        {!loadingProds && (
          <span style={S.contador}>
            {totalCargados}/{totalProductos}
          </span>
        )}
      </div>

      {/* ── Tabs de rubro ────────────────────────────────────────────── */}
      <div style={S.rubroTabs}>
        {RUBROS.map(r => (
          <button
            key={r.id}
            style={S.rubroTab(rubroActivo === r.id)}
            onClick={() => setRubroActivo(r.id)}
            type="button"
          >
            {r.icon} {r.id}
          </button>
        ))}
      </div>

      {/* ── Banner relevamiento ──────────────────────────────────────── */}
      {!loadingRelev && relevamiento && (
        <div style={S.banner(relevamiento.estado)}>
          <div style={S.bannerText}>
            {finalizado ? "🔒" : "📝"}
            <span>
              {finalizado
                ? `${periodoLabel} — finalizado`
                : `${periodoLabel} — ${totalCargados}/${totalProductos} cargados`}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {!finalizado && (
              <button
                style={S.bannerBtn(hoverFinal, "red")}
                onClick={handleFinalizar}
                onMouseEnter={() => setHoverFinal(true)}
                onMouseLeave={() => setHoverFinal(false)}
                type="button"
              >
                Finalizar
              </button>
            )}
            {finalizado && (
              <button
                style={S.bannerBtn(hoverReabrir, "dark")}
                onClick={handleReabrir}
                onMouseEnter={() => setHoverReabrir(true)}
                onMouseLeave={() => setHoverReabrir(false)}
                type="button"
              >
                🔓 Reabrir
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Error de relevamiento: sin esto no hay dónde guardar los precios ── */}
      {!loadingRelev && !relevamiento && errorRelev && (
        <div style={{
          margin: "10px 1rem 0", padding: "10px 14px",
          background: "#FFF5F5", borderLeft: `4px solid ${C.red}`,
          borderRadius: "0 8px 8px 0", fontSize: "13px", color: "#C0303B",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "8px",
        }}>
          <span>⚠ {errorRelev} — sin esto no se puede guardar ningún precio.</span>
          <button
            type="button"
            onClick={cargarRelevamiento}
            style={{
              background: C.red, color: C.white, border: "none",
              borderRadius: "6px", padding: "5px 12px", fontSize: "12px",
              fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          margin: "10px 1rem 0", padding: "10px 14px",
          background: "#FFF5F5", borderLeft: `4px solid ${C.red}`,
          borderRadius: "0 8px 8px 0", fontSize: "13px", color: "#C0303B",
        }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Skeletons de carga ───────────────────────────────────────── */}
      {loadingProds && (
        Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)
      )}

      {/* ── Sin resultados ───────────────────────────────────────────── */}
      {!loadingProds && categorias.length === 0 && (
        <div style={S.empty}>
          <span style={{ fontSize: "32px" }}>🔍</span>
          <div style={{ fontSize: "14px", fontWeight: 600, color: C.navy }}>
            Sin resultados
          </div>
          <div style={{ fontSize: "13px" }}>
            Probá cambiar el rubro o la búsqueda.
          </div>
        </div>
      )}

      {/* ── Acordeones por categoría ─────────────────────────────────── */}
      {!loadingProds && categorias.map(cat => (
        <CategoriaAcordeon
          key={cat}
          categoria={cat}
          productos={porCategoria[cat]}
          precios={precios}
          relevamiento={relevamiento}
          empleado={empleado}
          onGuardado={handlePrecioGuardado}
          onProductoActualizado={handleProductoActualizado}
        />
      ))}

    </div>
  );
}