# -*- coding: utf-8 -*-
"""
categorias.py — Categorías: alta/edición/borrado y asignación a relevadores
------------------------------------------------------------------------------
GET    /api/categorias                → lista categorías con rubro y relevadores asignados (admin)
POST   /api/categorias                → crear categoría nueva (admin)
PUT    /api/categorias/:id            → editar nombre/rubro de una categoría (admin)
DELETE /api/categorias/:id            → borrar una categoría (admin, solo si no tiene productos)
PUT    /api/categorias/:id/asignar    → reemplaza el conjunto de relevadores de una categoría (admin)

Una categoría puede estar asignada a varios relevadores a la vez
(asignación compartida, no exclusiva) — vía la tabla categoria_relevadores.
Los productos de una categoría sin ningún relevador asignado no son
visibles para ningún relevador (solo para admin), hasta que se le
asigne al menos uno.
"""

from __future__ import annotations

import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client, create_client

from auth import EmpleadoOut, get_empleado_actual

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter(prefix="/api/categorias", tags=["categorias"])


class EmpleadoMini(BaseModel):
    id:     str
    nombre: str


class CategoriaOut(BaseModel):
    id:           int
    nombre:       str
    rubro_id:     int
    rubro_nombre: str | None = None
    empleados:    list[EmpleadoMini] = []   # relevadores asignados (puede ser varios)


class AsignarBody(BaseModel):
    empleado_ids: list[str] = []   # conjunto completo deseado; reemplaza el anterior


class CategoriaCreate(BaseModel):
    nombre:   str
    rubro_id: int


class CategoriaUpdate(BaseModel):
    nombre:   str | None = None
    rubro_id: int | None = None


def _verificar_rubro_existe(rubro_id: int) -> None:
    resp = supabase.table("rubros").select("id").eq("id", rubro_id).single().execute()
    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El rubro indicado no existe.",
        )


def _verificar_admin(empleado: EmpleadoOut) -> None:
    if empleado.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden gestionar asignaciones de categorías.",
        )


def _fila_a_categoria(row: dict) -> dict:
    rubro = row.pop("rubros", None)
    crs   = row.pop("categoria_relevadores", None) or []
    row["rubro_nombre"] = rubro["nombre"] if rubro else None
    row["empleados"]    = [cr["empleados"] for cr in crs if cr.get("empleados")]
    return row


def _traer_categoria(categoria_id: int) -> dict:
    resp = (
        supabase.table("categorias")
        .select(
            "id, nombre, rubro_id, rubros(nombre), "
            "categoria_relevadores(empleados(id, nombre))"
        )
        .eq("id", categoria_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    return _fila_a_categoria(resp.data)


# ─── GET /api/categorias ──────────────────────────────────────────────────────
@router.get("", response_model=list[CategoriaOut])
def listar_categorias(
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    _verificar_admin(empleado)

    resp = (
        supabase.table("categorias")
        .select(
            "id, nombre, rubro_id, rubros(nombre), "
            "categoria_relevadores(empleados(id, nombre))"
        )
        .order("nombre")
        .execute()
    )

    return [_fila_a_categoria(row) for row in (resp.data or [])]


# ─── POST /api/categorias ──────────────────────────────────────────────────────
@router.post("", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
def crear_categoria(
    body: CategoriaCreate,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    _verificar_admin(empleado)

    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El nombre de la categoría no puede estar vacío.",
        )
    _verificar_rubro_existe(body.rubro_id)

    resp = (
        supabase.table("categorias")
        .insert({"nombre": nombre, "rubro_id": body.rubro_id})
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al crear la categoría.")

    return _traer_categoria(resp.data[0]["id"])


# ─── PUT /api/categorias/:id ────────────────────────────────────────────────────
@router.put("/{categoria_id}", response_model=CategoriaOut)
def editar_categoria(
    categoria_id: int,
    body: CategoriaUpdate,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    _verificar_admin(empleado)
    _traer_categoria(categoria_id)  # 404 si no existe

    cambios = body.model_dump(exclude_none=True)
    if "nombre" in cambios:
        cambios["nombre"] = cambios["nombre"].strip()
        if not cambios["nombre"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El nombre de la categoría no puede estar vacío.",
            )
    if "rubro_id" in cambios:
        _verificar_rubro_existe(cambios["rubro_id"])

    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se enviaron campos para actualizar.",
        )

    supabase.table("categorias").update(cambios).eq("id", categoria_id).execute()
    return _traer_categoria(categoria_id)


# ─── DELETE /api/categorias/:id ─────────────────────────────────────────────────
@router.delete("/{categoria_id}", status_code=status.HTTP_200_OK)
def eliminar_categoria(
    categoria_id: int,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Borra una categoría solo si ya no tiene ningún producto (activo o
    inactivo) apuntando a ella — evitamos dejar productos "huérfanos".
    Las asignaciones a relevadores (categoria_relevadores) se borran
    solas por el ON DELETE CASCADE de esa tabla.
    """
    _verificar_admin(empleado)
    _traer_categoria(categoria_id)  # 404 si no existe

    productos_resp = (
        supabase.table("productos")
        .select("id", count="exact")
        .eq("categoria_id", categoria_id)
        .execute()
    )
    cantidad = productos_resp.count or 0
    if cantidad > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"No se puede borrar: todavía tiene {cantidad} "
                f"producto{'s' if cantidad != 1 else ''} en esta categoría. "
                "Movelos a otra categoría o desactivalos primero."
            ),
        )

    supabase.table("categorias").delete().eq("id", categoria_id).execute()
    return {"mensaje": "Categoría eliminada correctamente."}


# ─── PUT /api/categorias/:id/asignar ──────────────────────────────────────────
@router.put("/{categoria_id}/asignar", response_model=CategoriaOut)
def asignar_categoria(
    categoria_id: int,
    body: AsignarBody,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Reemplaza el conjunto completo de relevadores asignados a esta
    categoría por los IDs recibidos en `empleado_ids`. Enviá una lista
    vacía para dejarla sin asignar, o varios IDs para compartirla entre
    más de un relevador.
    """
    _verificar_admin(empleado)
    _traer_categoria(categoria_id)  # 404 si la categoría no existe

    ids_unicos = list(dict.fromkeys(body.empleado_ids))  # sin duplicados, preserva orden

    if ids_unicos:
        emp_resp = (
            supabase.table("empleados")
            .select("id, activo")
            .in_("id", ids_unicos)
            .execute()
        )
        encontrados = {row["id"]: row for row in (emp_resp.data or [])}
        for emp_id in ids_unicos:
            emp = encontrados.get(emp_id)
            if not emp:
                raise HTTPException(
                    status_code=404,
                    detail=f"Empleado {emp_id} no encontrado.",
                )
            if not emp.get("activo", False):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="No se puede asignar un empleado inactivo.",
                )

    # Reemplazar el conjunto completo: borrar asignaciones actuales, insertar las nuevas
    supabase.table("categoria_relevadores").delete().eq("categoria_id", categoria_id).execute()

    if ids_unicos:
        nuevas = [{"categoria_id": categoria_id, "empleado_id": eid} for eid in ids_unicos]
        supabase.table("categoria_relevadores").insert(nuevas).execute()

    return _traer_categoria(categoria_id)