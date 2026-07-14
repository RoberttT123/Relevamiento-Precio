# -*- coding: utf-8 -*-
"""
auth.py — Rutas de autenticación
---------------------------------
POST /api/auth/login   → valida empleado en Supabase, devuelve JWT
GET  /api/auth/me      → devuelve datos del empleado logueado (token requerido)
POST /api/auth/logout  → (stateless JWT: solo limpia en el cliente, aquí es no-op)

Integración:
  - Supabase como base de datos (tabla `empleados`)
  - JWT firmado con HS256 (PyJWT)
  - Contraseña = el propio código de empleado (sin hashing por ahora;
    agregá bcrypt cuando quieras passwords reales)

Dependencias (requirements.txt):
  fastapi
  uvicorn[standard]
  supabase
  PyJWT
  python-dotenv
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from supabase import Client, create_client

# ─── Variables de entorno ────────────────────────────────────────────────────
# Crea un archivo .env en la raíz del backend con estas claves.
# En Render las configurás en Environment → Environment Variables.
#
#   SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
#   SUPABASE_SERVICE_KEY=eyJhbGci...   (service_role key, NO la anon key)
#   JWT_SECRET=un_string_largo_y_aleatorio
#   JWT_EXPIRE_HOURS=8

load_dotenv()

SUPABASE_URL       = os.environ["SUPABASE_URL"]
SUPABASE_KEY       = os.environ["SUPABASE_SERVICE_KEY"]
JWT_SECRET         = os.environ.get("JWT_SECRET", "cambia_esto_en_produccion")
JWT_ALGORITHM      = "HS256"
JWT_EXPIRE_HOURS   = int(os.environ.get("JWT_EXPIRE_HOURS", "8"))

# ─── Supabase client ─────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Router FastAPI ──────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/auth", tags=["auth"])


# ─── Modelos Pydantic ────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    nombre: str
    codigo_empleado: str


class EmpleadoOut(BaseModel):
    id: str
    nombre: str
    rol: str
    codigo_empleado: str


class LoginResponse(BaseModel):
    token: str
    empleado: EmpleadoOut


class MeResponse(BaseModel):
    empleado: EmpleadoOut


# ─── Helpers JWT ─────────────────────────────────────────────────────────────
def _crear_token(empleado: dict) -> str:
    """Genera un JWT firmado con los datos del empleado."""
    payload = {
        "sub":              empleado["id"],
        "nombre":           empleado["nombre"],
        "rol":              empleado["rol"],
        "codigo_empleado":  empleado["codigo_empleado"],
        "exp": datetime.now(tz=timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(tz=timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decodificar_token(token: str) -> dict:
    """Decodifica y valida el JWT. Lanza HTTPException si es inválido."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión expiró. Ingresá de nuevo.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )


# ─── Dependencia reutilizable ─────────────────────────────────────────────────
# Usá `empleado_actual: EmpleadoOut = Depends(get_empleado_actual)`
# en cualquier otra ruta para protegerla con JWT.

def get_empleado_actual(
    authorization: Annotated[str | None, Header()] = None,
) -> EmpleadoOut:
    """
    Extrae y valida el JWT del header Authorization: Bearer <token>.
    Lo usan las demás rutas como dependencia.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no proporcionado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token   = authorization.removeprefix("Bearer ").strip()
    payload = _decodificar_token(token)

    return EmpleadoOut(
        id              = payload["sub"],
        nombre          = payload["nombre"],
        rol             = payload["rol"],
        codigo_empleado = payload["codigo_empleado"],
    )


# ─── POST /api/auth/login ─────────────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(body: LoginRequest):
    """
    Valida nombre + código de empleado contra la tabla `empleados` en Supabase.
    Devuelve un JWT y los datos básicos del empleado.

    Lógica de validación:
      1. Busca por codigo_empleado (único en la tabla).
      2. Verifica que el campo `activo` sea TRUE.
      3. Compara el nombre (case-insensitive, sin espacios extra).
         → Esto es validación liviana; si querés passwords reales
           agregá una columna `password_hash` y usá bcrypt.
    """
    codigo = body.codigo_empleado.strip().upper()
    nombre = body.nombre.strip()

    if not codigo or not nombre:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nombre y código de empleado son obligatorios.",
        )

    # ── Consulta a Supabase ──────────────────────────────────────────────────
    try:
        resp = (
            supabase.table("empleados")
            .select("id, nombre, rol, codigo_empleado, activo")
            .eq("codigo_empleado", codigo)
            .single()          # error si no existe exactamente 1 fila
            .execute()
        )
    except Exception:
        # single() lanza excepción si no encuentra la fila
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Código \"{codigo}\" no registrado. Consultá con tu supervisor.",
        )

    empleado_db = resp.data

    # ── Verificar que esté activo ────────────────────────────────────────────
    if not empleado_db.get("activo", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu cuenta está inactiva. Consultá con el administrador.",
        )

    # ── Verificar nombre (case-insensitive) ──────────────────────────────────
    nombre_db = empleado_db["nombre"].strip().lower()
    nombre_in = nombre.lower()

    if nombre_db != nombre_in:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El nombre no coincide con el código ingresado.",
        )

    # ── Generar JWT y responder ───────────────────────────────────────────────
    token = _crear_token(empleado_db)

    return LoginResponse(
        token=token,
        empleado=EmpleadoOut(
            id              = str(empleado_db["id"]),
            nombre          = empleado_db["nombre"],
            rol             = empleado_db["rol"],
            codigo_empleado = empleado_db["codigo_empleado"],
        ),
    )


# ─── GET /api/auth/me ─────────────────────────────────────────────────────────
@router.get("/me", response_model=MeResponse, status_code=status.HTTP_200_OK)
async def me(empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)]):
    """
    Devuelve los datos del empleado logueado a partir del JWT.
    El frontend lo llama al recargar la página para verificar que
    la sesión sigue siendo válida.

    Header requerido:
      Authorization: Bearer <token>
    """
    return MeResponse(empleado=empleado)

# ─── GET /api/auth/empleados ──────────────────────────────────────────────────
@router.get("/empleados", response_model=list[EmpleadoOut])
def listar_empleados(
    empleado: Annotated[EmpleadoOut, Depends(get_empleado_actual)],
):
    """
    Lista empleados activos. Uso administrativo
    (ej. asignar categorías a relevadores).
    """
    if empleado.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden ver la lista de empleados.",
        )

    resp = (
        supabase.table("empleados")
        .select("id, nombre, rol, codigo_empleado")
        .eq("activo", True)
        .order("nombre")
        .execute()
    )
    return resp.data or []
# ─── POST /api/auth/logout ────────────────────────────────────────────────────
@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout():
    """
    Con JWT stateless no hay nada que invalidar en el servidor.
    El frontend borra el token de localStorage y redirige al login.
    Este endpoint existe para mantener la convención REST.
    """
    return {"mensaje": "Sesión cerrada. Eliminá el token del cliente."}