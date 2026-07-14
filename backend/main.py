# -*- coding: utf-8 -*-
"""
main.py — Punto de entrada del backend FastAPI
-----------------------------------------------
Ejecutar en desarrollo:
  uvicorn main:app --reload --port 8000

En Render configurás:
  Build Command:  pip install -r requirements.txt
  Start Command:  uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth          import router as auth_router
from productos     import router as productos_router
from relevamientos import router as relevamientos_router
from historial     import router as historial_router
from categorias    import router as categorias_router

app = FastAPI(
    title="Relevamiento de Precios — PROESA",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://relevamiento-precio-1frontend.onrender.com",
      "http://localhost:5195"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(productos_router)
app.include_router(relevamientos_router)
app.include_router(historial_router)
app.include_router(categorias_router)


@app.get("/")
def health():
    return {"status": "ok", "proyecto": "Relevamiento de Precios PROESA"}