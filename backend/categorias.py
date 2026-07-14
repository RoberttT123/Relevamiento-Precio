# -*- coding: utf-8 -*-
"""
categorias.py — Asignación de categorías a relevadores
---------------------------------------------------------
GET /api/categorias                → lista categorías con rubro y relevador asignado (admin)
PUT /api/categorias/:id/asignar    → asigna o desasigna un relevador a una categoría (admin)

Cada categoría le pertenece a un único relevador (asignación exclusiva).
Los productos de una categoría sin asignar no son visibles para ningún
relevador (solo para admin), hasta que se les asigne alguien.
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


class CategoriaOut(BaseModel):
    id:              int
    nombre:          str
    rubro_id:        int
    rubro_nombre:    str | None = None
    empleado_id:     str | None = None
    empleado_nombre: str | None = None


class AsignarBody(BaseModel):
    empleado_id: str | None = None   # None = desasignar


def _verificar_admin(empleado: EmpleadoOut) -> None:
    if empleado.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden gestionar asignaciones de categorías.",
        )


def _traer_categoria(categoria_id: int) -> dict:
    resp = (
        supabase.table("categorias")
        .select("id, nombre, rubro_id, empleado_id, rubros(nombre), empleados(nombre)")
        .eq("id", categoria_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")

    row   = resp.data
    rubro = row.pop("rubros", None)
    emp   = row.pop("empleados", None)
    row["rubro_nombre"]    = rubro["nombre"] if rubro else None
    row["empleado_nombre"] = emp["nombre"]   if emp   else None
    return row


# ─── GET /api/categorias ──────────────────────────────────────────────────────
@router.get("", response_model=list[CategoriaOut])
def listar_categorias(
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    _verificar_admin(empleado)

    resp = (
        supabase.table("categorias")
        .select("id, nombre, rubro_id, empleado_id, rubros(nombre), empleados(nombre)")
        .order("nombre")
        .execute()
    )

    result = []
    for row in resp.data or []:
        rubro = row.pop("rubros", None)
        emp   = row.pop("empleados", None)
        row["rubro_nombre"]    = rubro["nombre"] if rubro else None
        row["empleado_nombre"] = emp["nombre"]   if emp   else None
        result.append(row)

    return result


# ─── PUT /api/categorias/:id/asignar ──────────────────────────────────────────
@router.put("/{categoria_id}/asignar", response_model=CategoriaOut)
def asignar_categoria(
    categoria_id: int,
    body: AsignarBody,
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    _verificar_admin(empleado)
    _traer_categoria(categoria_id)  # 404 si no existe

    if body.empleado_id:
        emp_resp = (
            supabase.table("empleados")
            .select("id, activo")
            .eq("id", body.empleado_id)
            .single()
            .execute()
        )
        if not emp_resp.data:
            raise HTTPException(status_code=404, detail="Empleado no encontrado.")
        if not emp_resp.data.get("activo", False):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No se puede asignar un empleado inactivo.",
            )

    supabase.table("categorias").update(
        {"empleado_id": body.empleado_id}
    ).eq("id", categoria_id).execute()

    return _traer_categoria(categoria_id)