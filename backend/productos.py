# -*- coding: utf-8 -*-
"""
productos.py — Rutas de productos
-----------------------------------
GET    /api/productos                → lista productos con filtros opcionales
GET    /api/productos/:id            → detalle de un producto
POST   /api/productos                → crear producto nuevo (solo admin)
PUT    /api/productos/:id            → editar categoría*, grameaje, marca, descripción, grupo
PUT    /api/productos/:id/lider      → marcar/desmarcar como líder dentro de su grupo
DELETE /api/productos/:id            → desactivar producto (soft delete, solo admin)
PUT    /api/productos/:id/reactivar  → reactivar producto desactivado (solo admin)
POST   /api/productos/:id/imagen     → subir imagen a Cloudinary y guardar URL

  * Reasignar la categoría (categoria_id) es exclusivo de admin — un
    relevador que lo mande en el body lo ve ignorado en silencio.

Restricción por categoría asignada:
  Una categoría puede estar asignada a varios relevadores a la vez
  (tabla categoria_relevadores — asignación compartida, no exclusiva).
  Un relevador solo ve y puede editar productos de sus categorías asignadas,
  y solo dentro de esas categorías puede elegir el líder del grupo
  (PUT /api/productos/:id/lider). Los admins no tienen esta restricción
  — ven, editan y eligen el líder de todo.
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
    grupo:            str | None = None   # Agrupamiento para Price Index (ej: "Galletas Six Pack")
    es_lider:         bool = False        # True = este producto es el líder del grupo


class ProductoCreate(BaseModel):
    categoria_id:  int
    fuente:        Literal["PROESA", "COMPETENCIA", "SEGUIDOR"]
    marca:         str
    codigo:        str | None = None
    descripcion:   str
    grameaje_ml:   float | None = None
    unidades_caja: float | None = None
    grupo:         str | None = None


class ProductoUpdate(BaseModel):
    # fuente NO está aquí — es inmutable una vez creado el producto
    categoria_id:  int | None = None   # solo admin puede reasignar la categoría
    marca:         str | None = None
    codigo:        str | None = None
    descripcion:   str | None = None
    grameaje_ml:   float | None = None
    unidades_caja: float | None = None
    grupo:         str | None = None   # Ahora editable: permite asignar/cambiar el grupo


class ImagenResponse(BaseModel):
    imagen_url:       str
    imagen_public_id: str


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _enriquecer(prod: dict, cats: dict) -> dict:
    cat = cats.get(prod.get("categoria_id"))
    prod["categoria_nombre"] = cat["nombre"]       if cat else None
    prod["rubro_nombre"]     = cat["rubro_nombre"] if cat else None
    # Asegurar defaults para campos nuevos por si vienen null de Supabase
    if prod.get("es_lider") is None:
        prod["es_lider"] = False
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


def _categorias_asignadas(empleado_id: str) -> set[int]:
    """
    IDs de categoría asignadas a este empleado.
    Una categoría puede estar asignada a varios relevadores a la vez
    (asignación compartida, vía la tabla categoria_relevadores).
    """
    resp = (
        supabase.table("categoria_relevadores")
        .select("categoria_id")
        .eq("empleado_id", empleado_id)
        .execute()
    )
    return {row["categoria_id"] for row in (resp.data or [])}


# ─── GET /api/productos ───────────────────────────────────────────────────────
@router.get("", response_model=list[ProductoOut])
def listar_productos(
    rubro:     str | None = Query(None),
    categoria: str | None = Query(None),
    fuente:    Literal["PROESA", "COMPETENCIA", "SEGUIDOR"] | None = Query(None),
    busqueda:  str | None = Query(None),
    grupo:     str | None = Query(None),
    activo:    bool       = Query(True),
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)] = None,
):
    query = (
        supabase.table("productos")
        .select("*")
        .eq("activo", activo)
        .order("descripcion")
    )
    if fuente:
        query = query.eq("fuente", fuente)
    if grupo:
        query = query.eq("grupo", grupo)

    data = query.execute().data or []
    cats = _cargar_categorias()

    # Relevadores solo ven productos de sus categorías asignadas.
    # Admin ve todo (queda en None → sin filtro).
    categorias_permitidas = (
        _categorias_asignadas(empleado.id) if empleado.rol != "admin" else None
    )

    result = []

    for prod in data:
        cat_id = prod.get("categoria_id")
        cat = cats.get(cat_id)
        if not cat:
            continue
        if categorias_permitidas is not None and cat_id not in categorias_permitidas:
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
        if prod.get("es_lider") is None:
            prod["es_lider"] = False
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
    nuevo.setdefault("es_lider", False)
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
    Edita categoría, marca, código, descripción, grameaje_ml, unidades_caja
    y grupo. La fuente NO se puede cambiar — queda fija desde la creación.
    Para marcar/desmarcar líder usar PUT /api/productos/:id/lider.

    Un relevador solo puede editar productos de sus categorías asignadas,
    y no puede reasignar la categoría de un producto (eso es exclusivo
    de admin) aunque lo mande en el body.
    """
    cambios = body.model_dump(exclude_none=True)

    # Doble seguridad: ignorar fuente y es_lider aunque vengan en el body
    cambios.pop("fuente",   None)
    cambios.pop("es_lider", None)

    # Reasignar categoría es exclusivo de admin
    if empleado.rol != "admin":
        cambios.pop("categoria_id", None)

    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se enviaron campos válidos para actualizar.",
        )

    existe = (
        supabase.table("productos")
        .select("id, categoria_id")
        .eq("id", producto_id)
        .single()
        .execute()
    )
    if not existe.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    if empleado.rol != "admin":
        permitidas = _categorias_asignadas(empleado.id)
        if existe.data["categoria_id"] not in permitidas:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta categoría no está asignada a vos.",
            )

    if "categoria_id" in cambios:
        cat_resp = (
            supabase.table("categorias")
            .select("id")
            .eq("id", cambios["categoria_id"])
            .single()
            .execute()
        )
        if not cat_resp.data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La categoría indicada no existe.",
            )

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


# ─── PUT /api/productos/:id/lider ────────────────────────────────────────────
@router.put("/{producto_id}/lider", response_model=ProductoOut)
def toggle_lider(
    producto_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Marca este producto como líder de su grupo y desmarca al anterior líder.
    Si el producto ya era líder, lo desmarca (toggle).

    Permisos: admins sin restricción. Relevadores también pueden elegir
    el líder, pero solo dentro de productos cuya categoría les esté
    asignada (una categoría puede estar asignada a varios relevadores).

    Lógica:
    1. Obtener el producto con su categoría.
    2. Si no es admin, verificar que la categoría del producto le esté
       asignada a este relevador.
    3. Si no tiene grupo, asignar la categoría como grupo
       Y asignar ese mismo grupo a todos los productos de la misma categoría
       que tampoco tengan grupo — así el UPDATE de desmarcar los alcanza a todos.
    4. Si ya es líder → desmarcar solo este.
    5. Si no era líder → desmarcar TODOS del grupo → marcar este.
    """
    # 1. Obtener producto actual con su categoría
    prod_resp = (
        supabase.table("productos")
        .select("id, grupo, es_lider, categoria_id")
        .eq("id", producto_id)
        .single()
        .execute()
    )
    if not prod_resp.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    prod = prod_resp.data

    # 2. Relevadores solo pueden tocar el líder de sus categorías asignadas
    if empleado.rol != "admin":
        permitidas = _categorias_asignadas(empleado.id)
        if prod.get("categoria_id") not in permitidas:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta categoría no está asignada a vos.",
            )

    grupo = prod.get("grupo")

    # 2. Si no tiene grupo, derivarlo de la categoría
    if not grupo:
        cats = _cargar_categorias()
        try:
            cat_id = int(prod.get("categoria_id"))
        except (TypeError, ValueError):
            cat_id = None
        cat = cats.get(cat_id) if cat_id is not None else None
        if cat and cat.get("nombre"):
            grupo = cat["nombre"]
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No se pudo determinar el grupo del producto.",
            )

        # Asignar el grupo a TODOS los productos de la misma categoría
        # que todavía no tengan grupo — así el desmarcar posterior los alcanza
        cat_id_actual = prod.get("categoria_id")
        if cat_id_actual:
            supabase.table("productos").update({"grupo": grupo}) \
                .eq("categoria_id", cat_id_actual) \
                .is_("grupo", "null") \
                .eq("activo", True) \
                .execute()

        # Asignar grupo al producto actual también
        supabase.table("productos").update({"grupo": grupo}) \
            .eq("id", producto_id).execute()

    ya_es_lider = prod.get("es_lider", False)

    if ya_es_lider:
        # Toggle OFF: solo desmarcar este producto
        supabase.table("productos").update({"es_lider": False}) \
            .eq("id", producto_id).execute()
    else:
        # Toggle ON:
        # Primero desmarcar TODOS los líderes del mismo grupo
        supabase.table("productos").update({"es_lider": False}) \
            .eq("grupo", grupo).execute()
        # Luego marcar este
        supabase.table("productos").update({"es_lider": True}) \
            .eq("id", producto_id).execute()

    # Devolver el producto actualizado
    resultado = (
        supabase.table("productos")
        .select("*")
        .eq("id", producto_id)
        .single()
        .execute()
    )
    cats = _cargar_categorias()
    return _enriquecer(resultado.data, cats)


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


# ─── PUT /api/productos/:id/reactivar ─────────────────────────────────────────
@router.put("/{producto_id}/reactivar", response_model=ProductoOut)
def reactivar_producto(
    producto_id: str,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """Vuelve a activar un producto desactivado (activo=True). Solo admins."""
    if empleado.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden reactivar productos.",
        )

    resp = (
        supabase.table("productos")
        .update({"activo": True})
        .eq("id", producto_id)
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    cats = _cargar_categorias()
    return _enriquecer(resp.data[0], cats)


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