# -*- coding: utf-8 -*-
"""
historial.py — Rutas de historial y panel de control
------------------------------------------------------
GET  /api/historial                  → historial de cambios con filtros
GET  /api/historial/panel            → vista consolidada para el panel de control
GET  /api/historial/comparativa      → comparativa de precios entre dos períodos
GET  /api/historial/evolucion        → evolución de precio venta por mes (para gráfico de líneas)
GET  /api/historial/resumen/:periodo → resumen estadístico de un período
"""

from __future__ import annotations

import os
from typing import Annotated, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import Client, create_client

from auth import EmpleadoOut, get_empleado_actual

# ─── Variables de entorno ────────────────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Router ──────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/historial", tags=["historial"])


# ─── Modelos Pydantic ────────────────────────────────────────────────────────
class CambioOut(BaseModel):
    id:                   str
    precio_id:            str
    descripcion_producto: str | None = None
    marca_producto:       str | None = None
    campo_modificado:     str
    valor_anterior:       str | None
    valor_nuevo:          str | None
    modificado_por:       str
    nombre_empleado:      str | None = None
    fecha_modificacion:   str


class PanelRow(BaseModel):
    periodo:              str
    estado_relevamiento:  str
    relevado_por:         str
    rubro:                str
    categoria:            str
    fuente:               str
    marca:                str
    codigo:               str | None
    descripcion:          str
    grameaje_ml:          float | None
    unidades_caja:        float | None
    imagen_url:           str | None
    precio_compra_caja:   float | None
    precio_venta_caja:    float | None
    precio_compra_unidad: float | None
    precio_venta_unidad:  float | None
    precio_por_gr_ml:     float | None
    margen_caja_bs:       float | None
    margen_caja_pct:      float | None
    margen_unidad_bs:     float | None
    margen_unidad_pct:    float | None
    index_real:           float | None
    index_marca:          float | None
    ultima_edicion:       str


class ComparativaRow(BaseModel):
    rubro:               str
    categoria:           str
    fuente:              str
    marca:               str
    descripcion:         str
    grameaje_ml:         float | None
    precio_venta_caja_a:  float | None
    margen_caja_pct_a:    float | None
    precio_venta_caja_b:  float | None
    margen_caja_pct_b:    float | None
    delta_precio_caja:    float | None
    delta_margen_pct:     float | None


class EvolPunto(BaseModel):
    """Un punto en la serie temporal: período + precio de ese mes."""
    periodo:             str          # "YYYY-MM"
    precio_venta_caja:   float | None
    precio_venta_unidad: float | None


class EvolProducto(BaseModel):
    """Serie completa de un producto a lo largo de N meses."""
    descripcion: str
    marca:       str
    fuente:      str
    puntos:      list[EvolPunto]


class ResumenPeriodo(BaseModel):
    periodo:                  str
    total_productos:          int
    total_lider:              int   # antes total_proesa
    total_competencia:        int
    promedio_margen_caja_pct: float | None
    productos_sin_precio:     int
    relevamientos_finalizados: int
    relevamientos_borrador:   int


# ─── GET /api/historial ───────────────────────────────────────────────────────
@router.get("", response_model=list[CambioOut])
def listar_historial(
    periodo:     str | None = Query(None),
    producto_id: str | None = Query(None),
    empleado_id: str | None = Query(None),
    limite:      int        = Query(100, ge=1, le=500),
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    if empleado.rol != "admin":
        empleado_id = empleado.id

    query = (
        supabase.table("historial_cambios")
        .select(
            "id, precio_id, campo_modificado, valor_anterior, "
            "valor_nuevo, modificado_por, fecha_modificacion, "
            "empleados!historial_cambios_modificado_por_fkey(nombre), "
            "precios_relevamiento!historial_cambios_precio_id_fkey("
            "  producto_id, "
            "  productos(descripcion, marca)"
            ")"
        )
        .order("fecha_modificacion", desc=True)
        .limit(limite)
    )

    if empleado_id:
        query = query.eq("modificado_por", empleado_id)

    data = query.execute().data or []
    result = []

    for row in data:
        emp  = row.pop("empleados", None)
        pr   = row.pop("precios_relevamiento", None)
        prod = pr.get("productos") if pr else None

        row["nombre_empleado"]      = emp["nombre"]       if emp  else None
        row["descripcion_producto"] = prod["descripcion"] if prod else None
        row["marca_producto"]       = prod["marca"]       if prod else None

        if periodo and pr:
            rel_resp = (
                supabase.table("relevamientos")
                .select("periodo")
                .eq("id", (
                    supabase.table("precios_relevamiento")
                    .select("relevamiento_id")
                    .eq("id", row["precio_id"])
                    .single()
                    .execute()
                    .data or {}
                ).get("relevamiento_id", ""))
                .single()
                .execute()
            )
            if not rel_resp.data or rel_resp.data.get("periodo") != periodo:
                continue

        if producto_id and pr:
            if pr.get("producto_id") != producto_id:
                continue

        result.append(row)

    return result


# ─── GET /api/historial/panel ────────────────────────────────────────────────
@router.get("/panel", response_model=list[PanelRow])
def panel_control(
    periodo:   str | None = Query(None),
    rubro:     str | None = Query(None),
    categoria: str | None = Query(None),
    fuente:    Literal["LIDER", "COMPETENCIA", "SEGUIDOR"] | None = Query(None),
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    query = supabase.table("vista_panel_control").select("*")

    if periodo:
        query = query.eq("periodo", periodo)
    if rubro:
        query = query.ilike("rubro", f"%{rubro}%")
    if categoria:
        query = query.ilike("categoria", f"%{categoria}%")
    if fuente:
        query = query.eq("fuente", fuente)
    if empleado.rol != "admin":
        query = query.eq("relevado_por", empleado.nombre)

    return query.execute().data or []


# ─── GET /api/historial/comparativa ──────────────────────────────────────────
@router.get("/comparativa", response_model=list[ComparativaRow])
def comparativa_periodos(
    periodo_a: str = Query(...),
    periodo_b: str = Query(...),
    rubro:     str | None = Query(None),
    fuente:    Literal["LIDER", "COMPETENCIA", "SEGUIDOR"] | None = Query(None),
    _empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    def _traer_periodo(periodo: str) -> dict:
        q = supabase.table("vista_panel_control").select("*").eq("periodo", periodo)
        if rubro:
            q = q.ilike("rubro", f"%{rubro}%")
        if fuente:
            q = q.eq("fuente", fuente)
        rows = q.execute().data or []
        return {f"{r['descripcion']}|{r['marca']}": r for r in rows}

    data_a = _traer_periodo(periodo_a)
    data_b = _traer_periodo(periodo_b)
    claves = set(data_a.keys()) & set(data_b.keys())

    if not claves:
        raise HTTPException(
            status_code=404,
            detail=f"No hay productos en común entre {periodo_a} y {periodo_b}.",
        )

    result = []
    for clave in sorted(claves):
        a, b = data_a[clave], data_b[clave]
        pv_a = a.get("precio_venta_caja")
        pv_b = b.get("precio_venta_caja")
        mg_a = a.get("margen_caja_pct")
        mg_b = b.get("margen_caja_pct")

        result.append(ComparativaRow(
            rubro               = a["rubro"],
            categoria           = a["categoria"],
            fuente              = a["fuente"],
            marca               = a["marca"],
            descripcion         = a["descripcion"],
            grameaje_ml         = a.get("grameaje_ml"),
            precio_venta_caja_a  = pv_a,
            margen_caja_pct_a    = mg_a,
            precio_venta_caja_b  = pv_b,
            margen_caja_pct_b    = mg_b,
            delta_precio_caja    = round(pv_b - pv_a, 2) if pv_a and pv_b else None,
            delta_margen_pct     = round(mg_b - mg_a, 4) if mg_a and mg_b else None,
        ))

    return result


# ─── GET /api/historial/evolucion ────────────────────────────────────────────
@router.get("/evolucion", response_model=list[EvolProducto])
def evolucion_precios(
    categoria: str = Query(..., description="Nombre exacto de la categoría a graficar"),
    meses:     int = Query(12, ge=2, le=24, description="Cuántos meses hacia atrás mostrar"),
    rubro:     str | None = Query(None),
    fuente:    Literal["LIDER", "COMPETENCIA", "SEGUIDOR"] | None = Query(None),
    _empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    """
    Devuelve la evolución mensual de precio de venta (caja y unidad)
    de todos los productos de una categoría, a lo largo de N meses.

    Ejemplo de respuesta:
    [
      {
        "descripcion": "BABYSEC x48",
        "marca": "BABYSEC",
        "fuente": "LIDER",
        "puntos": [
          { "periodo": "2025-07", "precio_venta_caja": 21.0, "precio_venta_unidad": 0.44 },
          { "periodo": "2025-08", "precio_venta_caja": 21.0, "precio_venta_unidad": 0.44 },
          ...
        ]
      },
      ...
    ]

    La estrategia:
    1. Calcular los últimos N períodos YYYY-MM.
    2. Para cada período, buscar en vista_panel_control los productos
       de la categoría pedida.
    3. Agrupar por producto (descripcion|marca) y armar la serie temporal.
    4. Si un producto no tiene precio en un mes, ese punto queda null
       (el frontend lo grafica como gap o lo omite según el tipo de gráfico).
    """
    from datetime import date

    # ── Generar la lista de períodos (últimos N meses) ────────────────────────
    hoy = date.today()
    periodos = []
    anio, mes = hoy.year, hoy.month
    for _ in range(meses):
        periodos.append(f"{anio}-{mes:02d}")
        mes -= 1
        if mes == 0:
            mes = 12
            anio -= 1
    periodos.reverse()  # orden cronológico ascendente

    # ── Traer datos de todos los períodos en una sola consulta ────────────────
    query = (
        supabase.table("vista_panel_control")
        .select(
            "periodo, descripcion, marca, fuente, "
            "precio_venta_caja, precio_venta_unidad"
        )
        .in_("periodo", periodos)
        .ilike("categoria", f"%{categoria}%")
    )
    if rubro:
        query = query.ilike("rubro", f"%{rubro}%")
    if fuente:
        query = query.eq("fuente", fuente)

    filas = query.execute().data or []

    if not filas:
        raise HTTPException(
            status_code=404,
            detail=f"No hay datos para la categoría '{categoria}'.",
        )

    # ── Agrupar por producto ──────────────────────────────────────────────────
    productos: dict[str, dict] = {}  # clave = "descripcion|marca"

    for fila in filas:
        clave = f"{fila['descripcion']}|{fila['marca']}"
        if clave not in productos:
            productos[clave] = {
                "descripcion": fila["descripcion"],
                "marca":       fila["marca"],
                "fuente":      fila["fuente"],
                "por_periodo": {},
            }
        productos[clave]["por_periodo"][fila["periodo"]] = {
            "precio_venta_caja":   fila.get("precio_venta_caja"),
            "precio_venta_unidad": fila.get("precio_venta_unidad"),
        }

    # ── Armar series temporales completas (null si no hay dato ese mes) ───────
    result = []
    for prod in sorted(productos.values(), key=lambda p: p["descripcion"]):
        puntos = [
            EvolPunto(
                periodo             = p,
                precio_venta_caja   = prod["por_periodo"].get(p, {}).get("precio_venta_caja"),
                precio_venta_unidad = prod["por_periodo"].get(p, {}).get("precio_venta_unidad"),
            )
            for p in periodos
        ]
        # Solo incluir el producto si tiene al menos un punto con dato real
        if any(pt.precio_venta_caja is not None or pt.precio_venta_unidad is not None
               for pt in puntos):
            result.append(EvolProducto(
                descripcion = prod["descripcion"],
                marca       = prod["marca"],
                fuente      = prod["fuente"],
                puntos      = puntos,
            ))

    return result


# ─── GET /api/historial/resumen/:periodo ─────────────────────────────────────
@router.get("/resumen/{periodo}", response_model=ResumenPeriodo)
def resumen_periodo(
    periodo: str,
    _empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    filas = (
        supabase.table("vista_panel_control")
        .select("fuente, margen_caja_pct, estado_relevamiento")
        .eq("periodo", periodo)
        .execute()
        .data or []
    )

    relevamientos = (
        supabase.table("relevamientos")
        .select("estado")
        .eq("periodo", periodo)
        .execute()
        .data or []
    )

    total_activos = (
        supabase.table("productos")
        .select("id", count="exact")
        .eq("activo", True)
        .execute()
        .count or 0
    )

    margenes = [
        float(f["margen_caja_pct"])
        for f in filas
        if f.get("margen_caja_pct") is not None
    ]

    return ResumenPeriodo(
        periodo                   = periodo,
        total_productos           = len(filas),
        total_lider               = sum(1 for f in filas if f["fuente"] == "LIDER"),
        total_competencia         = sum(1 for f in filas if f["fuente"] == "COMPETENCIA"),
        promedio_margen_caja_pct  = round(sum(margenes) / len(margenes), 4) if margenes else None,
        productos_sin_precio      = max(0, total_activos - len(filas)),
        relevamientos_finalizados = sum(1 for r in relevamientos if r["estado"] == "finalizado"),
        relevamientos_borrador    = sum(1 for r in relevamientos if r["estado"] == "borrador"),
    )