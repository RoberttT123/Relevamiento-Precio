# -*- coding: utf-8 -*-
"""
relevamientos.py — Rutas de relevamientos y carga de precios
--------------------------------------------------------------
POST   /api/relevamientos                        → crear relevamiento del mes
GET    /api/relevamientos                        → listar relevamientos (con filtro)
GET    /api/relevamientos/:id                    → detalle + todos sus precios
PUT    /api/relevamientos/:id/finalizar          → marcar como finalizado
PUT    /api/relevamientos/:id/reabrir            → volver a borrador
DELETE /api/relevamientos/:id                    → eliminar borrador (solo admin)

POST   /api/relevamientos/:id/precios            → cargar precio de un producto
PUT    /api/relevamientos/:id/precios/:precio_id → editar precio (dispara historial)
GET    /api/relevamientos/:id/precios            → listar precios del relevamiento

Límite mensual:
  Cada empleado puede tener como máximo LIMITE_MENSUAL relevamientos
  FINALIZADOS por período (mes). Un borrador abierto no gasta cupo —
  tenga o no precios cargados — hasta que se finaliza; recién ahí se
  consume uno de los LIMITE_MENSUAL. Esto permite abrir la pantalla,
  cargar precios, o dejar un borrador sin tocar, sin que eso cuente
  como un intento usado.

Restricción por categoría asignada:
  Un relevador solo puede cargar/editar precios de productos cuya
  categoría le esté asignada a él (tabla categoria_relevadores). Una
  misma categoría puede estar asignada a varios relevadores a la vez.
  Los admins no tienen esta restricción.

Cálculo automático de precio_por_gr_ml e index_real:
  Al guardar o editar un precio, el backend calcula:
    precio_por_gr_ml = precio_venta_unidad ÷ grameaje_ml
  y con eso busca el líder del grupo del producto y calcula:
    index_real = precio_por_gr_ml_producto / precio_por_gr_ml_lider × 100
  Si el producto ES el líder, index_real = 100.
  Si no hay líder con precio_por_gr_ml cargado en este período, index_real = None.
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

# ─── Configuración ────────────────────────────────────────────────────────────
LIMITE_MENSUAL = 4   # máximo de relevamientos por empleado, por período


# ─── Modelos Pydantic ────────────────────────────────────────────────────────
class RelevamientoCreate(BaseModel):
    periodo:     str
    descripcion: str | None = None


class RelevamientoOut(BaseModel):
    id:              str
    periodo:         str
    descripcion:     str | None
    creado_por:      str
    nombre_empleado: str | None = None
    estado:          Literal["borrador", "finalizado"]
    created_at:      str
    updated_at:      str


class PrecioCreate(BaseModel):
    producto_id:          str
    precio_compra_caja:   float | None = None
    precio_venta_caja:    float | None = None
    precio_compra_unidad: float | None = None
    precio_venta_unidad:  float | None = None
    precio_por_gr_ml:     float | None = None   # se calcula automáticamente
    index_real:           float | None = None   # se calcula automáticamente
    index_marca:          float | None = None   # ingresado manualmente

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
    precio_compra_caja:   float | None = None
    precio_venta_caja:    float | None = None
    precio_compra_unidad: float | None = None
    precio_venta_unidad:  float | None = None
    precio_por_gr_ml:     float | None = None   # se recalcula automáticamente
    index_real:           float | None = None   # se recalcula automáticamente
    index_marca:          float | None = None   # ingresado manualmente


class PrecioOut(BaseModel):
    id:                   str
    relevamiento_id:      str
    producto_id:          str
    descripcion_producto: str | None = None
    marca_producto:       str | None = None
    imagen_url:           str | None = None
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
    updated_at:           str


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

    if empleado.rol != "admin" and relev["creado_por"] != empleado.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés permiso para acceder a este relevamiento.",
        )

    return relev


# ─── Helper: verificar que la categoría del producto está asignada al empleado
def _verificar_categoria_permitida(producto_id: str, empleado: EmpleadoOut) -> None:
    """
    Admin: sin restricción. Relevador: la categoría del producto debe
    estar entre las suyas (una categoría puede estar asignada a varios
    relevadores a la vez, vía la tabla categoria_relevadores).
    """
    if empleado.rol == "admin":
        return

    prod_resp = (
        supabase.table("productos")
        .select("categoria_id")
        .eq("id", producto_id)
        .single()
        .execute()
    )
    if not prod_resp.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    asignacion_resp = (
        supabase.table("categoria_relevadores")
        .select("empleado_id")
        .eq("categoria_id", prod_resp.data["categoria_id"])
        .eq("empleado_id", empleado.id)
        .execute()
    )

    if not asignacion_resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta categoría no está asignada a vos.",
        )


# ─── Helper: calcular precio_por_gr_ml automáticamente ───────────────────────
def _calcular_precio_por_gr_ml(
    precio_venta_unidad: float | None,
    grameaje_ml: float | None,
) -> float | None:
    """
    precio_por_gr_ml = precio_venta_unidad ÷ grameaje_ml.
    Devuelve None si falta cualquiera de los dos datos o si grameaje_ml es 0.
    Es la base del index_real: normaliza el precio de venta unidad por el
    tamaño real del producto, para poder comparar productos de distinto
    gramaje/mililitraje en igualdad de condiciones.
    """
    if not precio_venta_unidad or not grameaje_ml:
        return None
    return round(precio_venta_unidad / grameaje_ml, 6)


# ─── Helper: calcular index_real automáticamente ──────────────────────────────
def _calcular_index_real(
    producto_id: str,
    precio_por_gr_ml_actual: float | None,
    periodo: str,
) -> float | None:
    """
    Busca el líder del grupo del producto y calcula:
      index_real = precio_por_gr_ml_producto / precio_por_gr_ml_lider × 100

    - Si el producto ES el líder → devuelve 100.0
    - Si no hay líder con precio_por_gr_ml cargado en este período → None.
    - Si precio_por_gr_ml_actual es None o 0 → devuelve None.

    La fórmula refleja qué tan caro es el producto respecto al líder,
    normalizado por gramaje/mililitraje (Precio x Gr/ML), no por precio
    de unidad crudo:
      - index_real < 100: el producto es más barato por gr/ml que el líder
      - index_real = 100: el producto cuesta lo mismo por gr/ml que el líder
      - index_real > 100: el producto es más caro por gr/ml que el líder
    """
    if not precio_por_gr_ml_actual or precio_por_gr_ml_actual == 0:
        return None

    # Obtener datos del producto (grupo, es_lider)
    prod_resp = (
        supabase.table("productos")
        .select("grupo, es_lider, categoria_id")
        .eq("id", producto_id)
        .single()
        .execute()
    )
    if not prod_resp.data:
        return None

    prod = prod_resp.data

    # Si este producto ES el líder → index_real = 100
    if prod.get("es_lider"):
        return 100.0

    grupo = prod.get("grupo")
    if not grupo:
        return None

    # Buscar el líder del mismo grupo
    lider_resp = (
        supabase.table("productos")
        .select("id")
        .eq("grupo", grupo)
        .eq("es_lider", True)
        .eq("activo", True)
        .execute()
    )
    lideres = lider_resp.data or []
    if not lideres:
        return None

    lider_id = lideres[0]["id"]

    # Buscar el precio_por_gr_ml del líder en el mismo período
    # Para eso necesitamos el relevamiento del mismo período que tenga precio del líder
    precio_lider_resp = (
        supabase.table("precios_relevamiento")
        .select("precio_por_gr_ml, relevamiento_id, relevamientos(periodo)")
        .eq("producto_id", lider_id)
        .execute()
    )

    precio_gr_ml_lider = None
    for pr in (precio_lider_resp.data or []):
        rel = pr.get("relevamientos") or {}
        if rel.get("periodo") == periodo:
            precio_gr_ml_lider = pr.get("precio_por_gr_ml")
            break

    if not precio_gr_ml_lider or precio_gr_ml_lider == 0:
        return None

    # Calcular Price Index: producto ÷ líder × 100
    index = round((precio_por_gr_ml_actual / precio_gr_ml_lider) * 100, 2)
    return index


# ─── Helper: recalcular index_real de TODOS los productos del grupo ───────────
def _recalcular_grupo(grupo: str, periodo: str) -> None:
    """
    Cuando se guarda el precio del líder, recalcula el index_real
    de todos los demás productos del mismo grupo en este período,
    en base al precio_por_gr_ml que cada uno ya tiene guardado.
    Así los retadores que ya tenían precio cargado se actualizan.
    """
    if not grupo:
        return

    # Traer todos los productos del grupo (excepto el líder)
    productos_resp = (
        supabase.table("productos")
        .select("id")
        .eq("grupo", grupo)
        .eq("es_lider", False)
        .eq("activo", True)
        .execute()
    )
    productos = productos_resp.data or []
    if not productos:
        return

    # Para cada producto, buscar su precio en este período y recalcular
    for prod in productos:
        precio_resp = (
            supabase.table("precios_relevamiento")
            .select("id, precio_por_gr_ml, relevamientos(periodo)")
            .eq("producto_id", prod["id"])
            .execute()
        )
        for pr in (precio_resp.data or []):
            rel = pr.get("relevamientos") or {}
            if rel.get("periodo") != periodo:
                continue
            nuevo_index = _calcular_index_real(
                prod["id"],
                pr.get("precio_por_gr_ml"),
                periodo,
            )
            if nuevo_index is not None:
                supabase.table("precios_relevamiento").update(
                    {"index_real": nuevo_index}
                ).eq("id", pr["id"]).execute()


# ─── Helper: SET LOCAL para trigger de historial ─────────────────────────────
def _ejecutar_con_historial(empleado_id: str, precio_id: str, cambios: dict) -> dict:
    try:
        resp = supabase.rpc(
            "actualizar_precio_con_historial",
            {
                "p_precio_id":   precio_id,
                "p_cambios":     cambios,
                "p_empleado_id": empleado_id,
            },
        ).execute()
        return resp.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar precio con historial: {e}",
        )


# ─── Helper: enriquecer precio con datos del producto ────────────────────────
def _enriquecer_precio(precio: dict) -> dict:
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


# ─── POST /api/relevamientos ──────────────────────────────────────────────────
@router.post("", response_model=RelevamientoOut, status_code=status.HTTP_201_CREATED)
def crear_relevamiento(
    body: RelevamientoCreate,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    periodo = _validar_periodo(body.periodo)

    # Solo cuentan los YA FINALIZADOS. Un borrador abierto (tenga o no
    # precios cargados) no gasta cupo — el cupo se consume recién en el
    # momento de finalizar. Así, abrir la pantalla o cargar precios sin
    # cerrar el relevamiento nunca cuenta como un intento usado.
    existentes = (
        supabase.table("relevamientos")
        .select("id", count="exact")
        .eq("periodo", periodo)
        .eq("creado_por", empleado.id)
        .eq("estado", "finalizado")
        .execute()
    )
    cantidad = existentes.count or 0

    if cantidad >= LIMITE_MENSUAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Ya alcanzaste el límite de {LIMITE_MENSUAL} "
                f"relevamientos para el período {periodo}."
            ),
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
    periodo: str | None = Query(None),
    estado:  Literal["borrador", "finalizado"] | None = Query(None),
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    query = (
        supabase.table("relevamientos")
        .select("*, empleados(nombre)")
        .order("periodo", desc=True)
        .order("created_at", desc=True)
    )

    if empleado.rol != "admin":
        query = query.eq("creado_por", empleado.id)
    if periodo:
        _validar_periodo(periodo)
        query = query.eq("periodo", periodo)
    if estado:
        query = query.eq("estado", estado)

    data = query.execute().data or []
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
    relev = _get_relevamiento_o_404(relevamiento_id, empleado)
    relev["nombre_empleado"] = empleado.nombre
    return relev


# ─── PUT /api/relevamientos/:id/finalizar ─────────────────────────────────────
@router.put("/{relevamiento_id}/finalizar", response_model=RelevamientoOut)
def finalizar_relevamiento(
    relevamiento_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
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


# ─── PUT /api/relevamientos/:id/reabrir ──────────────────────────────────────
@router.put("/{relevamiento_id}/reabrir", response_model=RelevamientoOut)
def reabrir_relevamiento(
    relevamiento_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
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


# ─── DELETE /api/relevamientos/:id ───────────────────────────────────────────
@router.delete("/{relevamiento_id}", status_code=status.HTTP_200_OK)
def eliminar_relevamiento(
    relevamiento_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
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
    relev = _get_relevamiento_o_404(relevamiento_id, empleado)

    if relev["estado"] == "finalizado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pueden agregar precios a un relevamiento finalizado.",
        )

    _verificar_categoria_permitida(body.producto_id, empleado)

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
            detail="Ya existe un precio para este producto. Usá PUT para editarlo.",
        )

    # ── Obtener grameaje/grupo/es_lider del producto para los cálculos ─────────
    prod_info = (
        supabase.table("productos")
        .select("grameaje_ml, grupo, es_lider")
        .eq("id", body.producto_id)
        .single()
        .execute()
    ).data or {}

    nuevo = body.model_dump(exclude_none=True)
    nuevo["relevamiento_id"] = relevamiento_id

    # ── Calcular precio_por_gr_ml automáticamente ──────────────────────────────
    precio_por_gr_ml = _calcular_precio_por_gr_ml(
        body.precio_venta_unidad, prod_info.get("grameaje_ml")
    )
    if precio_por_gr_ml is not None:
        nuevo["precio_por_gr_ml"] = precio_por_gr_ml

    # ── Calcular index_real automáticamente (en base a Precio x Gr/ML) ─────────
    index_real = _calcular_index_real(
        producto_id             = body.producto_id,
        precio_por_gr_ml_actual = precio_por_gr_ml,
        periodo                 = relev["periodo"],
    )
    if index_real is not None:
        nuevo["index_real"] = index_real

    resp = supabase.table("precios_relevamiento").insert(nuevo).execute()

    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al cargar el precio.")

    precio = resp.data[0]

    # ── Si este producto es el líder, recalcular índices del grupo ────────────
    if prod_info.get("es_lider") and prod_info.get("grupo"):
        _recalcular_grupo(prod_info["grupo"], relev["periodo"])

    return _enriquecer_precio(precio)


# ─── GET /api/relevamientos/:id/precios ──────────────────────────────────────
@router.get("/{relevamiento_id}/precios", response_model=list[PrecioOut])
def listar_precios(
    relevamiento_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
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
        .select("id, relevamiento_id, producto_id, precio_venta_unidad")
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

    precio_actual = precio_resp.data
    producto_id   = precio_actual["producto_id"]

    _verificar_categoria_permitida(producto_id, empleado)

    # ── Obtener grameaje/grupo/es_lider del producto para los cálculos ─────────
    prod_info = (
        supabase.table("productos")
        .select("grameaje_ml, grupo, es_lider")
        .eq("id", producto_id)
        .single()
        .execute()
    ).data or {}

    # ── Calcular precio_por_gr_ml automáticamente ──────────────────────────────
    # Usar el precio_venta_unidad del body si viene, o el que ya estaba guardado
    precio_unidad_nuevo = cambios.get("precio_venta_unidad") or \
                         precio_actual.get("precio_venta_unidad")

    precio_por_gr_ml = _calcular_precio_por_gr_ml(
        precio_unidad_nuevo, prod_info.get("grameaje_ml")
    )
    if precio_por_gr_ml is not None:
        cambios["precio_por_gr_ml"] = precio_por_gr_ml

    # ── Calcular index_real automáticamente (en base a Precio x Gr/ML) ─────────
    index_real = _calcular_index_real(
        producto_id             = producto_id,
        precio_por_gr_ml_actual = precio_por_gr_ml,
        periodo                 = relev["periodo"],
    )
    if index_real is not None:
        cambios["index_real"] = index_real

    # ── Ejecutar UPDATE con trigger de historial ──────────────────────────────
    _ejecutar_con_historial(empleado.id, precio_id, cambios)

    # ── Si este producto es el líder, recalcular índices del grupo ────────────
    if prod_info.get("es_lider") and prod_info.get("grupo"):
        _recalcular_grupo(prod_info["grupo"], relev["periodo"])

    # Traer el precio actualizado
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