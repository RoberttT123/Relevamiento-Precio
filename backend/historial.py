# -*- coding: utf-8 -*-
"""
historial.py — Rutas de historial y panel de control
------------------------------------------------------
GET  /api/historial                  → historial de cambios con filtros
GET  /api/historial/panel            → vista consolidada para el panel de control
GET  /api/historial/comparativa      → comparativa de precios entre dos períodos
GET  /api/historial/resumen/:periodo → resumen estadístico de un período

Todas las rutas leen desde:
  - vista_panel_control  (VIEW ya creada en schema.sql)
  - historial_cambios    (tabla con log automático del trigger)
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
    id:                 str
    precio_id:          str
    descripcion_producto: str | None = None
    marca_producto:     str | None = None
    campo_modificado:   str
    valor_anterior:     str | None
    valor_nuevo:        str | None
    modificado_por:     str
    nombre_empleado:    str | None = None
    fecha_modificacion: str


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
    rubro:                   str
    categoria:               str
    fuente:                  str
    marca:                   str
    descripcion:             str
    grameaje_ml:             float | None
    # Período A
    precio_venta_caja_a:     float | None
    margen_caja_pct_a:       float | None
    # Período B
    precio_venta_caja_b:     float | None
    margen_caja_pct_b:       float | None
    # Delta
    delta_precio_caja:       float | None
    delta_margen_pct:        float | None


class ResumenPeriodo(BaseModel):
    periodo:                 str
    total_productos:         int
    total_proesa:            int
    total_competencia:       int
    promedio_margen_caja_pct: float | None
    productos_sin_precio:    int
    relevamientos_finalizados: int
    relevamientos_borrador:  int


# ─── GET /api/historial ───────────────────────────────────────────────────────
@router.get("", response_model=list[CambioOut])
def listar_historial(
    periodo:    str | None = Query(None, description="Filtrar por período YYYY-MM"),
    producto_id: str | None = Query(None, description="Filtrar por UUID de producto"),
    empleado_id: str | None = Query(None, description="Filtrar por UUID de empleado"),
    limite:     int         = Query(100, ge=1, le=500),
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    """
    Log de cambios de precios registrados por el trigger automático.
    Los admins pueden filtrar por cualquier empleado.
    Los relevadores solo ven sus propios cambios.
    """
    # Si no es admin, forzar filtro por su propio id
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

        row["nombre_empleado"]      = emp["nombre"]          if emp  else None
        row["descripcion_producto"] = prod["descripcion"]    if prod else None
        row["marca_producto"]       = prod["marca"]          if prod else None

        # Filtro por período: comparamos con el relevamiento del precio
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
    periodo:   str | None = Query(None, description="Filtrar por período YYYY-MM"),
    rubro:     str | None = Query(None),
    categoria: str | None = Query(None),
    fuente:    Literal["PROESA", "COMPETENCIA"] | None = Query(None),
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    """
    Consulta la vista vista_panel_control ya creada en schema.sql.
    Devuelve precios + márgenes consolidados listos para tablas y gráficos.
    Solo admins ven todos los relevamientos; relevadores solo los propios.
    """
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

    data = query.execute().data or []
    return data


# ─── GET /api/historial/comparativa ──────────────────────────────────────────
@router.get("/comparativa", response_model=list[ComparativaRow])
def comparativa_periodos(
    periodo_a: str = Query(..., description="Período base YYYY-MM. Ej: 2026-05"),
    periodo_b: str = Query(..., description="Período a comparar YYYY-MM. Ej: 2026-06"),
    rubro:     str | None = Query(None),
    fuente:    Literal["PROESA", "COMPETENCIA"] | None = Query(None),
    _empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    """
    Compara precios y márgenes de dos períodos.
    Útil para el gráfico de evolución del panel de control.
    Solo devuelve productos que tienen precio en AMBOS períodos.
    """
    def _traer_periodo(periodo: str) -> dict:
        """Devuelve { 'descripcion|marca': row } para un período."""
        q = supabase.table("vista_panel_control").select("*").eq("periodo", periodo)
        if rubro:
            q = q.ilike("rubro", f"%{rubro}%")
        if fuente:
            q = q.eq("fuente", fuente)
        rows = q.execute().data or []
        return {f"{r['descripcion']}|{r['marca']}": r for r in rows}

    data_a = _traer_periodo(periodo_a)
    data_b = _traer_periodo(periodo_b)

    # Solo productos presentes en ambos períodos
    claves_comunes = set(data_a.keys()) & set(data_b.keys())

    if not claves_comunes:
        raise HTTPException(
            status_code=404,
            detail=f"No hay productos en común entre {periodo_a} y {periodo_b}.",
        )

    result = []
    for clave in sorted(claves_comunes):
        a = data_a[clave]
        b = data_b[clave]

        pv_a = a.get("precio_venta_caja")
        pv_b = b.get("precio_venta_caja")
        mg_a = a.get("margen_caja_pct")
        mg_b = b.get("margen_caja_pct")

        delta_precio = (
            round(pv_b - pv_a, 2)
            if pv_a is not None and pv_b is not None else None
        )
        delta_margen = (
            round(mg_b - mg_a, 4)
            if mg_a is not None and mg_b is not None else None
        )

        result.append(
            ComparativaRow(
                rubro                 = a["rubro"],
                categoria             = a["categoria"],
                fuente                = a["fuente"],
                marca                 = a["marca"],
                descripcion           = a["descripcion"],
                grameaje_ml           = a.get("grameaje_ml"),
                precio_venta_caja_a   = pv_a,
                margen_caja_pct_a     = mg_a,
                precio_venta_caja_b   = pv_b,
                margen_caja_pct_b     = mg_b,
                delta_precio_caja     = delta_precio,
                delta_margen_pct      = delta_margen,
            )
        )

    return result


# ─── GET /api/historial/resumen/:periodo ─────────────────────────────────────
@router.get("/resumen/{periodo}", response_model=ResumenPeriodo)
def resumen_periodo(
    periodo: str,
    _empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    """
    Devuelve un resumen estadístico del período para las cards
    del panel de control:
      - Total de productos relevados
      - Cuántos son PROESA vs COMPETENCIA
      - Promedio de margen caja %
      - Relevamientos finalizados vs borrador
    """
    # ── Datos de la vista ─────────────────────────────────────────────────────
    filas = (
        supabase.table("vista_panel_control")
        .select("fuente, margen_caja_pct, estado_relevamiento")
        .eq("periodo", periodo)
        .execute()
        .data or []
    )

    # ── Relevamientos del período ─────────────────────────────────────────────
    relevamientos = (
        supabase.table("relevamientos")
        .select("estado")
        .eq("periodo", periodo)
        .execute()
        .data or []
    )

    # ── Productos sin precio cargado en este período ──────────────────────────
    # Todos los productos activos menos los que tienen precio en el período
    total_activos = (
        supabase.table("productos")
        .select("id", count="exact")
        .eq("activo", True)
        .execute()
        .count or 0
    )
    con_precio = len(filas)
    sin_precio = max(0, total_activos - con_precio)

    # ── Cálculos ──────────────────────────────────────────────────────────────
    margenes = [
        float(f["margen_caja_pct"])
        for f in filas
        if f.get("margen_caja_pct") is not None
    ]
    promedio_margen = (
        round(sum(margenes) / len(margenes), 4) if margenes else None
    )

    return ResumenPeriodo(
        periodo                   = periodo,
        total_productos           = con_precio,
        total_proesa              = sum(1 for f in filas if f["fuente"] == "PROESA"),
        total_competencia         = sum(1 for f in filas if f["fuente"] == "COMPETENCIA"),
        promedio_margen_caja_pct  = promedio_margen,
        productos_sin_precio      = sin_precio,
        relevamientos_finalizados = sum(1 for r in relevamientos if r["estado"] == "finalizado"),
        relevamientos_borrador    = sum(1 for r in relevamientos if r["estado"] == "borrador"),
    )