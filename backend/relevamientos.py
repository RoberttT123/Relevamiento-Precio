# -*- coding: utf-8 -*-
"""
relevamientos.py — Rutas de relevamientos y carga de precios
--------------------------------------------------------------
POST   /api/relevamientos                        → crear relevamiento del mes
GET    /api/relevamientos                        → listar relevamientos (con filtro)
GET    /api/relevamientos/:id                    → detalle + todos sus precios
PUT    /api/relevamientos/:id/finalizar          → marcar como finalizado
DELETE /api/relevamientos/:id                    → eliminar borrador (solo admin)

POST   /api/relevamientos/:id/precios            → cargar precio de un producto
PUT    /api/relevamientos/:id/precios/:precio_id → editar precio (dispara historial)
GET    /api/relevamientos/:id/precios            → listar precios del relevamiento

El trigger `log_cambios_precios` de Supabase registra automáticamente
cada cambio de precio en historial_cambios, pero solo si el backend
ejecuta antes del UPDATE:
  SET LOCAL app.current_user_id = '<uuid_empleado>';
Esto se hace con la función _ejecutar_con_historial() de este archivo.
"""

from __future__ import annotations

import os
from typing import Annotated, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator
from supabase import Client, create_client

from auth import EmpleadoOut, get_empleado_actual

# ─── Variables de entorno ────────────────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Router ──────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/relevamientos", tags=["relevamientos"])


# ─── Modelos Pydantic ────────────────────────────────────────────────────────
class RelevamientoCreate(BaseModel):
    periodo:     str   # "YYYY-MM" — ej: "2026-06"
    descripcion: str | None = None


class RelevamientoOut(BaseModel):
    id:          str
    periodo:     str
    descripcion: str | None
    creado_por:  str          # UUID del empleado
    nombre_empleado: str | None = None
    estado:      Literal["borrador", "finalizado"]
    created_at:  str
    updated_at:  str


class PrecioCreate(BaseModel):
    producto_id:           str
    precio_compra_caja:    float | None = None
    precio_venta_caja:     float | None = None
    precio_compra_unidad:  float | None = None
    precio_venta_unidad:   float | None = None
    precio_por_gr_ml:      float | None = None
    index_real:            float | None = None
    index_marca:           float | None = None

    @model_validator(mode="after")
    def al_menos_un_precio(self):
        campos = [
            self.precio_compra_caja,
            self.precio_venta_caja,
            self.precio_compra_unidad,
            self.precio_venta_unidad,
        ]
        if all(v is None for v in campos):
            raise ValueError(
                "Debés ingresar al menos uno de: "
                "precio_compra_caja, precio_venta_caja, "
                "precio_compra_unidad, precio_venta_unidad."
            )
        return self


class PrecioUpdate(BaseModel):
    precio_compra_caja:    float | None = None
    precio_venta_caja:     float | None = None
    precio_compra_unidad:  float | None = None
    precio_venta_unidad:   float | None = None
    precio_por_gr_ml:      float | None = None
    index_real:            float | None = None
    index_marca:           float | None = None


class PrecioOut(BaseModel):
    id:                    str
    relevamiento_id:       str
    producto_id:           str
    descripcion_producto:  str | None = None
    marca_producto:        str | None = None
    imagen_url:            str | None = None
    precio_compra_caja:    float | None
    precio_venta_caja:     float | None
    precio_compra_unidad:  float | None
    precio_venta_unidad:   float | None
    precio_por_gr_ml:      float | None
    margen_caja_bs:        float | None
    margen_caja_pct:       float | None
    margen_unidad_bs:      float | None
    margen_unidad_pct:     float | None
    index_real:            float | None
    index_marca:           float | None
    updated_at:            str


# ─── Helper: validar formato YYYY-MM ─────────────────────────────────────────
def _validar_periodo(periodo: str) -> str:
    import re
    if not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", periodo):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='El período debe tener el formato YYYY-MM. Ej: "2026-06".',
        )
    return periodo


# ─── Helper: verificar que el relevamiento existe y pertenece al empleado ─────
def _get_relevamiento_o_404(relevamiento_id: str, empleado: EmpleadoOut) -> dict:
    resp = (
        supabase.table("relevamientos")
        .select("*")
        .eq("id", relevamiento_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Relevamiento no encontrado.")

    relev = resp.data

    # Los admins pueden ver/editar cualquier relevamiento
    if empleado.rol != "admin" and relev["creado_por"] != empleado.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés permiso para acceder a este relevamiento.",
        )

    return relev


# ─── Helper: SET LOCAL para que dispare el trigger de historial ───────────────
def _ejecutar_con_historial(empleado_id: str, precio_id: str, cambios: dict) -> dict:
    """
    Ejecuta el UPDATE de precios dentro de una transacción PostgreSQL
    que setea app.current_user_id antes del UPDATE.
    Esto activa el trigger log_cambios_precios en Supabase.

    Supabase Python SDK no expone transacciones directamente,
    así que usamos la función RPC `actualizar_precio_con_historial`
    que debés crear en Supabase → SQL Editor (ver comentario al final).
    """
    try:
        resp = supabase.rpc(
            "actualizar_precio_con_historial",
            {
                "p_precio_id":    precio_id,
                "p_cambios":      cambios,
                "p_empleado_id":  empleado_id,
            },
        ).execute()
        return resp.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar precio con historial: {e}",
        )


# ─── POST /api/relevamientos ──────────────────────────────────────────────────
@router.post("", response_model=RelevamientoOut, status_code=status.HTTP_201_CREATED)
def crear_relevamiento(
    body: RelevamientoCreate,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Crea un relevamiento para el período indicado.
    Un empleado solo puede tener un relevamiento por mes (UNIQUE en BD).
    """
    periodo = _validar_periodo(body.periodo)

    # Verificar que no exista uno para este empleado en el mismo período
    existente = (
        supabase.table("relevamientos")
        .select("id")
        .eq("periodo", periodo)
        .eq("creado_por", empleado.id)
        .execute()
    )
    if existente.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un relevamiento para el período {periodo}. "
                   "Podés editarlo desde la lista.",
        )

    nuevo = {
        "periodo":     periodo,
        "descripcion": body.descripcion,
        "creado_por":  empleado.id,
        "estado":      "borrador",
    }

    resp = supabase.table("relevamientos").insert(nuevo).execute()

    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al crear el relevamiento.")

    row = resp.data[0]
    row["nombre_empleado"] = empleado.nombre
    return row


# ─── GET /api/relevamientos ───────────────────────────────────────────────────
@router.get("", response_model=list[RelevamientoOut])
def listar_relevamientos(
    periodo: str | None = Query(None, description="Filtrar por período YYYY-MM"),
    estado:  Literal["borrador", "finalizado"] | None = Query(None),
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    """
    Los admins ven todos los relevamientos.
    Los relevadores solo ven los propios.
    """
    query = (
        supabase.table("relevamientos")
        .select("*, empleados(nombre)")
        .order("periodo", desc=True)
        .order("created_at", desc=True)
    )

    # Filtro por empleado si no es admin
    if empleado.rol != "admin":
        query = query.eq("creado_por", empleado.id)

    if periodo:
        _validar_periodo(periodo)
        query = query.eq("periodo", periodo)

    if estado:
        query = query.eq("estado", estado)

    data = query.execute().data or []

    # Aplanar el join con empleados
    result = []
    for row in data:
        emp_data = row.pop("empleados", None)
        row["nombre_empleado"] = emp_data["nombre"] if emp_data else None
        result.append(row)

    return result


# ─── GET /api/relevamientos/:id ───────────────────────────────────────────────
@router.get("/{relevamiento_id}", response_model=RelevamientoOut)
def obtener_relevamiento(
    relevamiento_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """Detalle de un relevamiento. Incluye sus precios cargados."""
    relev = _get_relevamiento_o_404(relevamiento_id, empleado)
    relev["nombre_empleado"] = empleado.nombre
    return relev


# ─── PUT /api/relevamientos/:id/finalizar ─────────────────────────────────────
@router.put("/{relevamiento_id}/finalizar", response_model=RelevamientoOut)
def finalizar_relevamiento(
    relevamiento_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Marca el relevamiento como 'finalizado'.
    Un relevamiento finalizado no puede editarse.
    """
    relev = _get_relevamiento_o_404(relevamiento_id, empleado)

    if relev["estado"] == "finalizado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El relevamiento ya estaba finalizado.",
        )

    resp = (
        supabase.table("relevamientos")
        .update({"estado": "finalizado"})
        .eq("id", relevamiento_id)
        .execute()
    )

    row = resp.data[0]
    row["nombre_empleado"] = empleado.nombre
    return row


# ─── DELETE /api/relevamientos/:id ───────────────────────────────────────────
@router.delete("/{relevamiento_id}", status_code=status.HTTP_200_OK)
def eliminar_relevamiento(
    relevamiento_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Elimina un relevamiento en estado 'borrador'.
    Solo admins o el propio creador pueden eliminarlo.
    Los precios asociados se eliminan en cascada (ON DELETE CASCADE en BD).
    """
    relev = _get_relevamiento_o_404(relevamiento_id, empleado)

    if relev["estado"] == "finalizado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar un relevamiento finalizado.",
        )

    supabase.table("relevamientos").delete().eq("id", relevamiento_id).execute()

    return {"mensaje": "Relevamiento eliminado correctamente."}


# =============================================================================
# RUTAS DE PRECIOS
# =============================================================================

# ─── POST /api/relevamientos/:id/precios ─────────────────────────────────────
@router.post(
    "/{relevamiento_id}/precios",
    response_model=PrecioOut,
    status_code=status.HTTP_201_CREATED,
)
def cargar_precio(
    relevamiento_id: str,
    body: PrecioCreate,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Carga el precio de un producto dentro de un relevamiento.
    Si el producto ya tiene precio en este relevamiento, devuelve 409
    (usá PUT para editarlo).
    """
    relev = _get_relevamiento_o_404(relevamiento_id, empleado)

    if relev["estado"] == "finalizado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pueden agregar precios a un relevamiento finalizado.",
        )

    # Verificar que no exista ya un precio para este producto en este relevamiento
    existente = (
        supabase.table("precios_relevamiento")
        .select("id")
        .eq("relevamiento_id", relevamiento_id)
        .eq("producto_id", body.producto_id)
        .execute()
    )
    if existente.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un precio para este producto en este relevamiento. "
                   "Usá PUT para editarlo.",
        )

    nuevo = body.model_dump(exclude_none=True)
    nuevo["relevamiento_id"] = relevamiento_id

    resp = supabase.table("precios_relevamiento").insert(nuevo).execute()

    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al cargar el precio.")

    precio = resp.data[0]
    return _enriquecer_precio(precio)


# ─── GET /api/relevamientos/:id/precios ──────────────────────────────────────
@router.get("/{relevamiento_id}/precios", response_model=list[PrecioOut])
def listar_precios(
    relevamiento_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Devuelve todos los precios cargados en un relevamiento,
    enriquecidos con descripción, marca e imagen del producto.
    """
    _get_relevamiento_o_404(relevamiento_id, empleado)

    resp = (
        supabase.table("precios_relevamiento")
        .select("*, productos(descripcion, marca, imagen_url)")
        .eq("relevamiento_id", relevamiento_id)
        .order("updated_at", desc=True)
        .execute()
    )

    result = []
    for row in resp.data or []:
        prod = row.pop("productos", None)
        row["descripcion_producto"] = prod["descripcion"] if prod else None
        row["marca_producto"]       = prod["marca"]       if prod else None
        row["imagen_url"]           = prod["imagen_url"]  if prod else None
        result.append(row)

    return result


# ─── PUT /api/relevamientos/:id/precios/:precio_id ───────────────────────────
@router.put("/{relevamiento_id}/precios/{precio_id}", response_model=PrecioOut)
def editar_precio(
    relevamiento_id: str,
    precio_id:       str,
    body:            PrecioUpdate,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Edita el precio de un producto en un relevamiento.
    Dispara automáticamente el trigger log_cambios_precios en Supabase
    vía la función RPC actualizar_precio_con_historial.

    Esta es la ruta más usada del sistema — cada vez que el empleado
    edita un campo en TarjetaProducto.jsx se llama a este endpoint.
    """
    relev = _get_relevamiento_o_404(relevamiento_id, empleado)

    if relev["estado"] == "finalizado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede editar un relevamiento finalizado.",
        )

    cambios = body.model_dump(exclude_none=True)

    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se enviaron campos para actualizar.",
        )

    # Verificar que el precio pertenece a este relevamiento
    precio_resp = (
        supabase.table("precios_relevamiento")
        .select("id, relevamiento_id")
        .eq("id", precio_id)
        .eq("relevamiento_id", relevamiento_id)
        .single()
        .execute()
    )
    if not precio_resp.data:
        raise HTTPException(
            status_code=404,
            detail="Precio no encontrado en este relevamiento.",
        )

    # ── Ejecutar UPDATE con trigger de historial ──────────────────────────────
    # Usa la función RPC que setea app.current_user_id antes del UPDATE
    _ejecutar_con_historial(empleado.id, precio_id, cambios)

    # Traer el precio actualizado con datos del producto
    resp = (
        supabase.table("precios_relevamiento")
        .select("*, productos(descripcion, marca, imagen_url)")
        .eq("id", precio_id)
        .single()
        .execute()
    )

    row  = resp.data
    prod = row.pop("productos", None)
    row["descripcion_producto"] = prod["descripcion"] if prod else None
    row["marca_producto"]       = prod["marca"]       if prod else None
    row["imagen_url"]           = prod["imagen_url"]  if prod else None

    return row


# ─── Helper: enriquecer precio con datos del producto ────────────────────────
def _enriquecer_precio(precio: dict) -> dict:
    """Agrega descripción, marca e imagen del producto al precio."""
    prod_resp = (
        supabase.table("productos")
        .select("descripcion, marca, imagen_url")
        .eq("id", precio["producto_id"])
        .single()
        .execute()
    )
    prod = prod_resp.data or {}
    precio["descripcion_producto"] = prod.get("descripcion")
    precio["marca_producto"]       = prod.get("marca")
    precio["imagen_url"]           = prod.get("imagen_url")
    return precio
# ─── PUT /api/relevamientos/:id/reabrir ──────────────────────────────────────
@router.put("/{relevamiento_id}/reabrir", response_model=RelevamientoOut)
def reabrir_relevamiento(
    relevamiento_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Vuelve un relevamiento finalizado a estado borrador.
    Solo el creador o un admin pueden reabrirlo.
    """
    relev = _get_relevamiento_o_404(relevamiento_id, empleado)

    if relev["estado"] == "borrador":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El relevamiento ya está en borrador.",
        )

    resp = (
        supabase.table("relevamientos")
        .update({"estado": "borrador"})
        .eq("id", relevamiento_id)
        .execute()
    )

    row = resp.data[0]
    row["nombre_empleado"] = empleado.nombre
    return row

# =============================================================================
# FUNCIÓN RPC EN SUPABASE — crear en SQL Editor ANTES de usar PUT /precios/:id
# =============================================================================
#
# Esta función permite que el trigger log_cambios_precios sepa quién
# hizo el cambio, seteando app.current_user_id antes del UPDATE.
#
# Pegá este SQL en Supabase → SQL Editor → New Query:
#
# CREATE OR REPLACE FUNCTION actualizar_precio_con_historial(
#     p_precio_id   UUID,
#     p_cambios     JSONB,
#     p_empleado_id UUID
# )
# RETURNS VOID
# LANGUAGE plpgsql
# SECURITY DEFINER
# AS $$
# BEGIN
#     -- Setea el empleado para que lo lea el trigger
#     PERFORM set_config('app.current_user_id', p_empleado_id::TEXT, TRUE);
#
#     -- Construye el UPDATE dinámicamente desde el JSONB
#     UPDATE precios_relevamiento
#     SET
#         precio_compra_caja   = COALESCE((p_cambios->>'precio_compra_caja')::NUMERIC,   precio_compra_caja),
#         precio_venta_caja    = COALESCE((p_cambios->>'precio_venta_caja')::NUMERIC,    precio_venta_caja),
#         precio_compra_unidad = COALESCE((p_cambios->>'precio_compra_unidad')::NUMERIC, precio_compra_unidad),
#         precio_venta_unidad  = COALESCE((p_cambios->>'precio_venta_unidad')::NUMERIC,  precio_venta_unidad),
#         precio_por_gr_ml     = COALESCE((p_cambios->>'precio_por_gr_ml')::NUMERIC,     precio_por_gr_ml),
#         index_real           = COALESCE((p_cambios->>'index_real')::NUMERIC,           index_real),
#         index_marca          = COALESCE((p_cambios->>'index_marca')::NUMERIC,          index_marca),
#         updated_at           = NOW()
#     WHERE id = p_precio_id;
# END;
# $$;