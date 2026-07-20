# -*- coding: utf-8 -*-
"""
rubros.py — Lectura de rubros
--------------------------------
GET /api/rubros → lista de rubros (para poblar el select al crear/editar categorías)

No hay CRUD de rubros por ahora — son una taxonomía chica y estable
(Alimentos, Bebidas y Tabacos, Higiene y Limpieza). Si en algún momento
hace falta crear/editar/borrar rubros también, se puede ampliar este
archivo con el mismo patrón que categorias.py.
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

router = APIRouter(prefix="/api/rubros", tags=["rubros"])


class RubroOut(BaseModel):
    id:     int
    nombre: str


# ─── GET /api/rubros ──────────────────────────────────────────────────────────
@router.get("", response_model=list[RubroOut])
def listar_rubros(
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    if empleado.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden ver la lista de rubros.",
        )

    resp = (
        supabase.table("rubros")
        .select("id, nombre")
        .order("nombre")
        .execute()
    )
    return resp.data or []