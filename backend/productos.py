# -*- coding: utf-8 -*-
"""
productos.py — Rutas de productos
-----------------------------------
GET    /api/productos                → lista productos con filtros opcionales
GET    /api/productos/:id            → detalle de un producto
POST   /api/productos                → crear producto nuevo (solo admin)
PUT    /api/productos/:id            → editar grameaje, marca, descripción
                                       (fuente es inmutable — no se puede cambiar)
DELETE /api/productos/:id            → desactivar producto (soft delete, solo admin)
POST   /api/productos/:id/imagen     → subir imagen a Cloudinary y guardar URL
"""

from __future__ import annotations

import os
from typing import Annotated, Literal

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from supabase import Client, create_client

from auth import EmpleadoOut, get_empleado_actual

# ─── Variables de entorno ────────────────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

# ─── Clientes ────────────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

cloudinary.config(
    cloud_name = os.environ["CLOUDINARY_CLOUD_NAME"],
    api_key    = os.environ["CLOUDINARY_API_KEY"],
    api_secret = os.environ["CLOUDINARY_API_SECRET"],
    secure     = True,
)

# ─── Router ──────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/productos", tags=["productos"])


# ─── Modelos Pydantic ────────────────────────────────────────────────────────
class ProductoOut(BaseModel):
    id:               str
    categoria_id:     int
    categoria_nombre: str | None = None
    rubro_nombre:     str | None = None
    fuente:           Literal["PROESA", "COMPETENCIA", "SEGUIDOR"]
    marca:            str
    codigo:           str | None
    descripcion:      str
    grameaje_ml:      float | None
    unidades_caja:    float | None
    imagen_url:       str | None
    activo:           bool


class ProductoCreate(BaseModel):
    categoria_id:  int
    fuente:        Literal["PROESA", "COMPETENCIA", "SEGUIDOR"]
    marca:         str
    codigo:        str | None = None
    descripcion:   str
    grameaje_ml:   float | None = None
    unidades_caja: float | None = None


class ProductoUpdate(BaseModel):
    # ── FUENTE NO ESTÁ AQUÍ — es inmutable una vez creado el producto ────────
    marca:         str | None = None
    codigo:        str | None = None
    descripcion:   str | None = None
    grameaje_ml:   float | None = None
    unidades_caja: float | None = None


class ImagenResponse(BaseModel):
    imagen_url:       str
    imagen_public_id: str


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _enriquecer(prod: dict, cats: dict) -> dict:
    cat = cats.get(prod.get("categoria_id"))
    prod["categoria_nombre"] = cat["nombre"]       if cat else None
    prod["rubro_nombre"]     = cat["rubro_nombre"] if cat else None
    return prod


def _cargar_categorias() -> dict:
    resp = (
        supabase.table("categorias")
        .select("id, nombre, rubros(nombre)")
        .execute()
    )
    return {
        row["id"]: {
            "nombre":       row["nombre"],
            "rubro_nombre": row["rubros"]["nombre"] if row.get("rubros") else None,
        }
        for row in (resp.data or [])
    }


# ─── GET /api/productos ───────────────────────────────────────────────────────
@router.get("", response_model=list[ProductoOut])
def listar_productos(
    rubro:     str | None = Query(None),
    categoria: str | None = Query(None),
    fuente:    Literal["PROESA", "COMPETENCIA", "SEGUIDOR"] | None = Query(None),
    busqueda:  str | None = Query(None),
    activo:    bool       = Query(True),
    _empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    query = (
        supabase.table("productos")
        .select("*")
        .eq("activo", activo)
        .order("descripcion")
    )
    if fuente:
        query = query.eq("fuente", fuente)

    data = query.execute().data or []
    cats = _cargar_categorias()
    result = []

    for prod in data:
        cat = cats.get(prod.get("categoria_id"))
        if not cat:
            continue
        if rubro    and cat["rubro_nombre"].lower() != rubro.lower():
            continue
        if categoria and cat["nombre"].lower() != categoria.lower():
            continue
        if busqueda:
            t = busqueda.lower()
            if t not in prod["descripcion"].lower() and t not in prod["marca"].lower():
                continue
        prod["categoria_nombre"] = cat["nombre"]
        prod["rubro_nombre"]     = cat["rubro_nombre"]
        result.append(prod)

    return result


# ─── GET /api/productos/:id ───────────────────────────────────────────────────
@router.get("/{producto_id}", response_model=ProductoOut)
def obtener_producto(
    producto_id: str,
    _empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    resp = (
        supabase.table("productos")
        .select("*")
        .eq("id", producto_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    cats = _cargar_categorias()
    return _enriquecer(resp.data, cats)


# ─── POST /api/productos ──────────────────────────────────────────────────────
@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
def crear_producto(
    body: ProductoCreate,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """Solo admins pueden crear productos. La fuente se define aquí y es inmutable."""
    if empleado.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden crear productos.",
        )

    nuevo = body.model_dump(exclude_none=True)
    resp  = supabase.table("productos").insert(nuevo).execute()

    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al crear el producto.")

    cats = _cargar_categorias()
    return _enriquecer(resp.data[0], cats)


# ─── PUT /api/productos/:id ───────────────────────────────────────────────────
@router.put("/{producto_id}", response_model=ProductoOut)
def editar_producto(
    producto_id: str,
    body: ProductoUpdate,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Edita marca, código, descripción, grameaje_ml y unidades_caja.
    La fuente NO se puede cambiar — queda fija desde la creación.
    Si alguien envía 'fuente' en el body, se ignora silenciosamente.
    """
    cambios = body.model_dump(exclude_none=True)

    # ── Doble seguridad: ignorar fuente aunque venga en el body ──────────────
    cambios.pop("fuente", None)

    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se enviaron campos válidos para actualizar.",
        )

    existe = (
        supabase.table("productos")
        .select("id")
        .eq("id", producto_id)
        .single()
        .execute()
    )
    if not existe.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    resp = (
        supabase.table("productos")
        .update(cambios)
        .eq("id", producto_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al actualizar el producto.")

    cats = _cargar_categorias()
    return _enriquecer(resp.data[0], cats)


# ─── DELETE /api/productos/:id ────────────────────────────────────────────────
@router.delete("/{producto_id}", status_code=status.HTTP_200_OK)
def desactivar_producto(
    producto_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """Soft delete: pone activo=False. Solo admins."""
    if empleado.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden desactivar productos.",
        )

    resp = (
        supabase.table("productos")
        .update({"activo": False})
        .eq("id", producto_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    return {"mensaje": "Producto desactivado correctamente."}


# ─── POST /api/productos/:id/imagen ──────────────────────────────────────────
@router.post("/{producto_id}/imagen", response_model=ImagenResponse)
async def subir_imagen(
    producto_id: str,
    imagen: UploadFile = File(..., description="JPG, PNG o WEBP. Máx 5MB."),
    _empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    MAX_MB   = 5
    FORMATOS = {"image/jpeg", "image/png", "image/webp"}

    if imagen.content_type not in FORMATOS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Formato no permitido. Usá JPG, PNG o WEBP.",
        )

    contenido = await imagen.read()
    if len(contenido) > MAX_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La imagen supera el límite de {MAX_MB} MB.",
        )

    prod_resp = (
        supabase.table("productos")
        .select("id, imagen_public_id")
        .eq("id", producto_id)
        .single()
        .execute()
    )
    if not prod_resp.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    public_id_nuevo = f"relevamiento_precios/productos/{producto_id}"

    try:
        resultado = cloudinary.uploader.upload(
            contenido,
            public_id      = public_id_nuevo,
            overwrite      = True,
            transformation = [
                {"width": 600, "crop": "limit"},
                {"quality": "auto"},
                {"fetch_format": "auto"},
            ],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al subir la imagen a Cloudinary: {e}",
        )

    url       = resultado["secure_url"]
    public_id = resultado["public_id"]

    supabase.table("productos").update(
        {"imagen_url": url, "imagen_public_id": public_id}
    ).eq("id", producto_id).execute()

    return ImagenResponse(imagen_url=url, imagen_public_id=public_id)