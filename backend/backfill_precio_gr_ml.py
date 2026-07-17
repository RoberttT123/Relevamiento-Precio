# -*- coding: utf-8 -*-
"""
backfill_precio_gr_ml.py — Recalcula precio_por_gr_ml e index_real
para TODOS los precios ya guardados, bajo la fórmula nueva basada en
Precio x Gr/ML (producto ÷ líder × 100).

Corré esto UNA SOLA VEZ, después de actualizar relevamientos.py y
productos.py, para que los datos históricos queden con el mismo
criterio que los precios nuevos (esos ya se calculan solos al
guardar/editar, este script solo empareja lo que ya existía antes
del cambio).

Reutiliza las mismas funciones de relevamientos.py — ninguna lógica
duplicada, así que el resultado es idéntico al que produciría la app.

Uso:
  cd backend
  python backfill_precio_gr_ml.py
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from supabase import Client, create_client

from relevamientos import _calcular_precio_por_gr_ml, _calcular_index_real

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def main() -> None:
    # ── Paso 1: traer todos los productos (para el grameaje_ml) ──────────────
    productos = {
        p["id"]: p
        for p in (
            supabase.table("productos").select("id, grameaje_ml").execute().data or []
        )
    }

    # ── Paso 2: traer todos los precios con su período ────────────────────────
    precios = (
        supabase.table("precios_relevamiento")
        .select("id, producto_id, precio_venta_unidad, relevamientos(periodo)")
        .execute()
        .data
        or []
    )

    print(f"Encontrados {len(precios)} precios. Recalculando precio_por_gr_ml…")

    actualizados_gr_ml = 0
    for pr in precios:
        prod = productos.get(pr["producto_id"])
        if not prod:
            continue
        precio_por_gr_ml = _calcular_precio_por_gr_ml(
            pr.get("precio_venta_unidad"), prod.get("grameaje_ml")
        )
        if precio_por_gr_ml is not None:
            supabase.table("precios_relevamiento").update(
                {"precio_por_gr_ml": precio_por_gr_ml}
            ).eq("id", pr["id"]).execute()
            actualizados_gr_ml += 1

    print(f"  → {actualizados_gr_ml} filas con precio_por_gr_ml actualizado.")
    print("Recalculando index_real…")

    actualizados_index = 0
    for pr in precios:
        rel = pr.get("relevamientos") or {}
        periodo = rel.get("periodo")
        if not periodo:
            continue

        # Releer el precio_por_gr_ml recién guardado en el paso anterior
        actual = (
            supabase.table("precios_relevamiento")
            .select("precio_por_gr_ml")
            .eq("id", pr["id"])
            .single()
            .execute()
            .data
            or {}
        )
        precio_por_gr_ml_actual = actual.get("precio_por_gr_ml")

        nuevo_index = _calcular_index_real(
            pr["producto_id"], precio_por_gr_ml_actual, periodo
        )
        if nuevo_index is not None:
            supabase.table("precios_relevamiento").update(
                {"index_real": nuevo_index}
            ).eq("id", pr["id"]).execute()
            actualizados_index += 1

    print(f"  → {actualizados_index} filas con index_real actualizado.")
    print("Listo.")


if __name__ == "__main__":
    main()