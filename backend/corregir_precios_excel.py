#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Corrige los precios mensuales que quedaron mal cargados o directamente sin
cargar por un bug de cargar_evolutivos.py, y hace valer la regla "el Excel
manda" sobre cualquier relevamiento real que tenga un valor distinto.
=====================================================================================

QUE PROBLEMA HABIA (encontrado revisando el Excel celda por celda)
---------------------------------------------------------------------
`cargar_evolutivos.py` identificaba la columna de cada mes buscando el TEXTO
del encabezado (por ej. "ago-26") dentro de la fila de "Codigo / Descripcion /
... / Ene / Feb / ...". Eso funciono bien para los bloques que vienen del
Excel original (fila 0 a 61), pero para los 6 bloques que vos pegaste a mano
(Papel Higienico, Pañuelos Faciales, Detergente en Barra, Comida Seca Perro,
Comida Seca Gato, Cigarrillos) el encabezado de esos meses esta escrito
distinto:

  - Papel Higienico / Pañuelos Faciales / Detergente en Barra: Agosto dice
    literalmente "ago/26" (con barra), pero el script buscaba "ago-26" (con
    guion) -- no matcheaba, entonces Agosto SIEMPRE quedaba vacio para esos
    8 productos (Confort, Nacional, Perlita, Babyñoño, ELITE, Zote, Uno,
    Macho), aunque el dato SI estaba en el Excel.
  - Comida Seca Perro / Comida Seca Gato / Cigarrillos: los encabezados de
    mes son las palabras completas ("enero", "febrero", ... "agosto"), que
    el script nunca reconocia -- asi que estos 13 productos (Podium, CIBAU
    adulto/cachorro, DOG CHOW, Podium Gato, MONELLO, Lee Roy, CAT CHOW, y
    los 5 cigarrillos) quedaron con TODOS los meses vacios, no solo Agosto.

En criollo: no faltaba el dato en tu Excel, el script no lo estaba leyendo
bien. Verificado celda por celda contra el archivo original: son 112 valores
mensuales reales que nunca se cargaron.

Ademas, por separado, tambien esta el caso que viste con Jabon Zote: un
relevamiento REAL (no el historico que carga este proceso) tenia para Julio
un precio de venta unidad de 470 Bs, muy fuera de rango. Segun tu regla ("el
archivo inicial es el que manda, si hay un relevamiento existente el Excel
se sobrepone"), este script tambien corrige esos casos: para cada
producto+mes que SI tiene valor en el Excel, si encuentra un
precios_relevamiento YA CARGADO (de cualquier relevamiento, historico o
real) con un valor distinto, lo pisa con el valor del Excel.

Que hace este script
----------------------
Para cada producto y cada mes (Ene a Ago 2026) que tiene valor en el Excel:
  1. Busca (o crea, igual que cargar_evolutivos.py) el relevamiento
     "Historico Automatizado {Mes} (Excel evolutivos)" de ese mes.
  2. Si no hay fila de precio para ese producto en ESE relevamiento, la
     inserta (esto es lo que arregla Agosto vacio y las categorias enteras
     que nunca se cargaron).
  3. Ademas busca en TODOS los demas relevamientos de ese mismo periodo
     (incluidos relevamientos reales) si ya existe un precio cargado para
     ese producto. Si existe y el valor no coincide con el Excel, lo
     actualiza para que coincida (deja compra/venta caja y margenes tal
     cual estan -- solo toca precio_venta_unidad y precio_por_gr_ml, igual
     que cargar_evolutivos.py).
  4. Registra cada correccion en `historial_cambios` (campo_modificado=
     'precio_venta_unidad'), para que quede el rastro de que se corrigio y
     por que.

Los meses donde el Excel tiene "-" (sin dato real, ej. Pinguinos y Mogul
Dientes) se dejan sin tocar -- ahi no hay bug, el Excel realmente no trae
ese dato.

IMPORTANTE -- orden recomendado si todavia no corriste fusionar_duplicados.py:
  1. python fusionar_duplicados.py --apply   (fusiona los productos duplicados)
  2. python corregir_precios_excel.py --apply (este script)
Este script ya apunta a los productos CANONICOS (los que van a sobrevivir
despues de la fusion) en los 5 casos que se solapan con esa fusion, asi que
funciona lo corras en el orden que lo corras -- pero es mas prolijo hacerlo
en ese orden.

Por defecto corre en modo DRY-RUN (no escribe nada). Recien con --apply
hace los cambios reales. Es re-corrible: si ya esta todo cargado bien, no
hace nada de mas.

Uso:
  python corregir_precios_excel.py                # dry-run
  python corregir_precios_excel.py --apply         # ejecuta de verdad
"""

import argparse
import os
import sys

try:
    from supabase import create_client
except ImportError:
    sys.exit("Falta el paquete supabase. Instala con: pip install supabase")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# =====================================================================================
# Datos ya extraidos y verificados del Excel (evolutivos.xlsx), releyendo directamente
# las celdas por POSICION de columna (no por texto de encabezado -- asi se evita el bug
# descrito arriba). Cada entrada: idx de fila -> producto_id (ya resuelto contra el
# catalogo real, usando el id CANONICO en los 5 casos que tambien toca
# fusionar_duplicados.py), marca, grameaje_ml, y los 8 precios de venta por unidad
# (Ene..Ago 2026; None = el Excel realmente no trae ese dato, no se toca).
# =====================================================================================
DATOS_EXCEL = {
    0: {'producto_id': '1eee61db-df6c-44d8-8980-53c6f0fbf3ff', 'marca': 'Liz', 'grameaje_ml': 900.0, 'meses': [21.0, 32.0, 32.0, 30.0, 30.0, 30.0, 24.0, 24.0]},
    1: {'producto_id': '52a03414-5390-407b-8937-df513e329b9c', 'marca': 'Sedal', 'grameaje_ml': 850.0, 'meses': [50.0, 53.0, 53.0, 47.0, 47.0, 47.0, 47.0, 47.0]},
    2: {'producto_id': 'a9e39f7a-c00b-41f8-8d17-976c7ce2f165', 'marca': 'Ballerina', 'grameaje_ml': 750.0, 'meses': [21.0, 21.0, 21.0, 21.0, 21.0, 21.0, 21.0, 21.0]},
    3: {'producto_id': '54db4f03-a6a8-456e-a174-09b20486e79e', 'marca': 'Carissa', 'grameaje_ml': 800.0, 'meses': [20.0, 19.0, 20.0, 20.0, 20.0, 20.0, 20.0, 20.0]},
    4: {'producto_id': '1c745d7b-2d4a-4c80-bc38-254b1f30008d', 'marca': 'Selfy', 'grameaje_ml': 900.0, 'meses': [25.0, 25.0, 25.0, 24.0, 24.0, 24.0, 24.0, 24.0]},
    5: {'producto_id': 'e4687a54-9de2-4f7a-a47a-bfb84eb36234', 'marca': 'Revive', 'grameaje_ml': 500.0, 'meses': [32.0, 32.0, 32.0, 22.0, 22.0, 22.0, 22.0, 22.0]},
    6: {'producto_id': '359a1d4c-4c4f-4dd1-be33-1df66998b135', 'marca': 'Biosilk', 'grameaje_ml': 48.0, 'meses': [60.0, 65.0, 60.0, 60.0, 60.0, 60.0, 65.0, 65.0]},
    7: {'producto_id': '29ef2494-6ff3-43f3-b4aa-b9acd80f38c1', 'marca': 'Ballerina', 'grameaje_ml': 48.0, 'meses': [70.0, 70.0, 70.0, 70.0, 70.0, 70.0, 80.0, 80.0]},
    8: {'producto_id': 'dbed2612-fb03-4023-b292-94e986878bf7', 'marca': 'Johnson', 'grameaje_ml': 400.0, 'meses': [50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 74.0, 74.0]},
    9: {'producto_id': '1c913e10-4d19-4aa5-ad1e-5103d83e43ea', 'marca': 'Simonds', 'grameaje_ml': 400.0, 'meses': [55.0, 55.0, 55.0, 60.0, 60.0, 60.0, 60.0, 60.0]},
    10: {'producto_id': '36ba0fde-3c86-4436-a145-92461d190a66', 'marca': 'Babyland', 'grameaje_ml': 400.0, 'meses': [50.0, 57.0, 54.0, 55.0, 55.0, 55.0, 55.0, 55.0]},
    11: {'producto_id': '284a0142-f826-4e9a-930d-8bb7d2c43f8f', 'marca': 'Colgate', 'grameaje_ml': 500.0, 'meses': [69.0, 75.0, 50.0, 55.0, 55.0, 55.0, 56.0, 56.0]},
    12: {'producto_id': '48e44ed6-b14b-4d83-a0d0-4a6ece815dfc', 'marca': 'Listerine', 'grameaje_ml': 500.0, 'meses': [50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0]},
    13: {'producto_id': '093ec8f5-d95f-4927-985d-96b4cb929fbb', 'marca': 'Scotch Brite', 'grameaje_ml': 4.0, 'meses': [13.0, 13.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0]},
    14: {'producto_id': '0ee5f7c4-3045-4014-8506-f6b4098b7008', 'marca': 'Esfrebom', 'grameaje_ml': 4.0, 'meses': [7.5, 9.0, 8.0, 8.0, 8.0, 8.0, 7.0, 7.0]},
    15: {'producto_id': '7f6a01df-981a-4a44-aacc-14fb09028206', 'marca': 'Limppano', 'grameaje_ml': 4.0, 'meses': [7.5, 7.5, 7.0, 7.0, 7.0, 7.0, 6.0, 6.0]},
    16: {'producto_id': '566d5c00-a7e7-4690-a61d-385f0c542137', 'marca': 'Tinindo', 'grameaje_ml': 4.0, 'meses': [9.0, 9.0, 7.0, 7.0, 7.0, 7.0, 7.0, 7.0]},
    17: {'producto_id': 'ba413ad7-4448-4148-8d11-cff3df99f49f', 'marca': 'Oreo', 'grameaje_ml': 6.0, 'meses': [24.0, 18.0, 20.0, 17.0, 17.0, 17.0, 17.0, 17.0]},
    18: {'producto_id': '2c03f909-f25d-4442-a155-30c9f2c26ade', 'marca': 'Frac', 'grameaje_ml': 6.0, 'meses': [15.0, 15.0, 14.0, 16.0, 16.0, 16.0, 15.0, 15.0]},
    19: {'producto_id': 'ed12b640-f964-409b-a365-b85fea666c93', 'marca': 'Cricks', 'grameaje_ml': 6.0, 'meses': [10.0, 10.0, 10.0, 11.0, 11.0, 11.0, 11.0, 11.0]},
    20: {'producto_id': '10817711-1b18-4e8a-8708-c67ac25dba70', 'marca': 'Cremositas', 'grameaje_ml': 6.0, 'meses': [14.0, 14.0, 17.0, 14.0, 14.0, 14.0, 14.0, 14.0]},
    21: {'producto_id': '18de6bae-9c15-4d45-a9f3-1a26b7d9599e', 'marca': 'Infinitas', 'grameaje_ml': 6.0, 'meses': [16.0, 16.0, 14.0, 13.0, 13.0, 13.0, 11.0, 11.0]},
    22: {'producto_id': '1b3a5422-e1c7-49aa-bd79-ed15d3b6bbcf', 'marca': 'Oreo', 'grameaje_ml': 118.0, 'meses': [12.0, 12.0, 12.0, 10.0, 10.0, 9.0, 13.0, 13.0]},
    23: {'producto_id': 'df78357d-8c8f-4247-96ff-9460f56cd15a', 'marca': 'Frac', 'grameaje_ml': 123.0, 'meses': [10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 11.0, 11.0]},
    24: {'producto_id': 'c369b34e-a870-4e43-a4f5-5f4847cae2db', 'marca': 'Infinitas', 'grameaje_ml': 120.0, 'meses': [7.0, 7.0, 7.0, 11.0, 11.0, 11.0, 11.0, 11.0]},
    25: {'producto_id': 'dcdd88cb-8848-4189-b8e4-bc02d5a1c42f', 'marca': 'Pinguinos', 'grameaje_ml': 80.0, 'meses': [None, None, None, None, None, None, None, None]},
    27: {'producto_id': '7b4d5e7b-2136-4285-8c22-c1518e6b9363', 'marca': 'Chocman', 'grameaje_ml': 28.0, 'meses': [1.4, 2.85, 2.85, 3.0, 3.0, 3.0, 4.0, 4.0]},
    28: {'producto_id': '9a3a3d6f-34ef-4a34-b642-26d5eb5ad2e5', 'marca': 'Vizzio', 'grameaje_ml': 122.0, 'meses': [20.0, 20.0, 20.0, 20.0, 20.0, 20.0, 27.0, 27.0]},
    29: {'producto_id': '9ffa90a6-9724-4756-80b2-8c164b964cb7', 'marca': 'Nestlé', 'grameaje_ml': 300.0, 'meses': [42.5, 42.5, 42.5, 42.5, 42.5, 42.5, 45.0, 45.0]},
    30: {'producto_id': '7350009e-db55-4111-bae8-ac36acea1d95', 'marca': 'Garoto', 'grameaje_ml': 250.0, 'meses': [56.0, 56.0, 56.0, 56.0, 56.0, 56.0, 50.0, 50.0]},
    31: {'producto_id': 'e8b2bbe5-fed1-401c-9c26-9b571b467ab6', 'marca': 'Vizzio', 'grameaje_ml': 72.0, 'meses': [20.0, 34.5, 34.5, 34.5, 34.5, 34.5, 34.5, 34.5]},
    32: {'producto_id': 'b9b27e08-f1a5-4251-a7da-bfc8ec642dc6', 'marca': 'Nestlé', 'grameaje_ml': 153.0, 'meses': [39.5, 39.5, 39.5, 39.5, 39.5, 39.5, 39.5, 39.5]},
    33: {'producto_id': '1e0d4f23-e372-452c-8128-b07a3c90e669', 'marca': 'Doblon', 'grameaje_ml': 30.0, 'meses': [21.0, 21.0, 21.0, 21.0, 21.0, 21.0, 26.0, 26.0]},
    34: {'producto_id': '6905ffc3-8465-44ec-831b-69e4735e98c0', 'marca': 'X6 Mini', 'grameaje_ml': 30.0, 'meses': [22.0, 30.0, 22.0, 20.0, 20.0, 20.0, 30.0, 30.0]},
    35: {'producto_id': 'fb25431a-84e3-4308-9218-c480f3b7cfbe', 'marca': 'Megablon', 'grameaje_ml': 30.0, 'meses': [20.0, 20.0, 20.0, 20.0, 20.0, 20.0, 18.0, 18.0]},
    36: {'producto_id': '55017c98-4ce5-4cd4-960f-7dfc212318b3', 'marca': 'Golazo', 'grameaje_ml': 24.0, 'meses': [29.0, 29.0, 29.0, 29.0, 29.0, 29.0, 33.0, 33.0]},
    37: {'producto_id': '9e859e52-4368-4bd2-93ba-4787b5b8d8cc', 'marca': 'Golpe', 'grameaje_ml': 24.0, 'meses': [50.0, 50.0, 50.0, 32.0, 32.0, 32.0, 32.0, 32.0]},
    38: {'producto_id': '6612874a-1652-48bd-8f5e-96a46ea6e90a', 'marca': 'X6', 'grameaje_ml': 24.0, 'meses': [32.0, 34.0, 32.0, 34.0, 34.0, 34.0, 28.0, 28.0]},
    39: {'producto_id': 'c9618307-b92b-4acf-8954-f0b850040f3a', 'marca': 'Toffee Mint', 'grameaje_ml': 100.0, 'meses': [33.0, 33.0, 34.0, 40.0, 40.0, 40.0, 40.0, 40.0]},
    40: {'producto_id': 'f332f7ab-f707-4bcb-8fe2-a79c32d2a9f9', 'marca': 'Butter Toffee', 'grameaje_ml': 100.0, 'meses': [64.5, 55.0, 64.5, 28.0, 28.0, 28.0, 28.0, 28.0]},
    41: {'producto_id': 'b23fc3c1-af67-40fa-a3de-f15ceb40e0bb', 'marca': 'Fini', 'grameaje_ml': 80.0, 'meses': [8.0, 8.0, 7.0, 8.0, 8.0, 8.0, 8.0, 8.0]},
    42: {'producto_id': '2d3e9b14-1c85-4ea0-ae67-b2e9730d3df1', 'marca': 'Trululu', 'grameaje_ml': 80.0, 'meses': [8.0, 8.0, 7.0, 6.0, 6.0, 6.0, 6.0, 6.0]},
    43: {'producto_id': 'b02d53ea-9c81-41a3-9972-2523e0bbd245', 'marca': 'Ambrosito', 'grameaje_ml': 90.0, 'meses': [8.0, 8.0, 8.0, 10.0, 10.0, 10.0, 10.0, 10.0]},
    44: {'producto_id': '86f77169-33c8-4c25-8cdf-ec9c8ae5b2b9', 'marca': 'Mogul', 'grameaje_ml': 30.0, 'meses': [45.0, 45.0, 45.0, 32.0, 32.0, 32.0, 32.0, 32.0]},
    45: {'producto_id': '4216af44-a84e-4914-b113-3057bc1a270c', 'marca': 'Ambrositos', 'grameaje_ml': 25.0, 'meses': [45.0, 47.0, 39.0, 40.0, 40.0, 40.0, 40.0, 40.0]},
    46: {'producto_id': 'd6cd112b-f91d-48b2-b4e0-f76919bdedb2', 'marca': 'Frugelé', 'grameaje_ml': 430.0, 'meses': [31.0, 31.0, 31.0, 26.0, 26.0, 26.0, 26.0, 26.0]},
    47: {'producto_id': '3c7634f0-60f6-498f-b2a8-d46f84efcad0', 'marca': 'Trululu', 'grameaje_ml': 475.0, 'meses': [28.0, 28.0, 28.0, 34.0, 34.0, 34.0, 34.0, 34.0]},
    48: {'producto_id': '605841bf-6648-4ada-baf1-c615fffe5f12', 'marca': 'Mogul Dientes', 'grameaje_ml': 500.0, 'meses': [None, None, None, None, None, None, None, None]},
    49: {'producto_id': '5c6d7dab-8b66-4c2f-bfee-524ff7098876', 'marca': 'Don Vittorio', 'grameaje_ml': 400.0, 'meses': [9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0]},
    50: {'producto_id': 'b155a81c-ed71-4dfa-988f-abce58fa8a85', 'marca': 'Carozzi', 'grameaje_ml': 400.0, 'meses': [10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0]},
    51: {'producto_id': '69d4c288-f011-4fd5-b9ed-8740722a8793', 'marca': 'Lazzaronni', 'grameaje_ml': 400.0, 'meses': [7.0, 7.0, 7.0, 6.0, 6.0, 6.0, 6.0, 6.0]},
    52: {'producto_id': 'b6e48aae-2b5f-4191-9363-3d2687860347', 'marca': 'Nutregal', 'grameaje_ml': 400.0, 'meses': [8.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0]},
    53: {'producto_id': '00c2c5be-cab2-43fe-b98f-5b6c21aebeb9', 'marca': 'Don Vittorio', 'grameaje_ml': 400.0, 'meses': [9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0]},
    54: {'producto_id': 'd978b6dc-fc1e-4431-a5b1-f86656e7dbd1', 'marca': 'Carozzi', 'grameaje_ml': 400.0, 'meses': [12.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0]},
    55: {'producto_id': '8bf3d387-b7c6-4196-acd4-d545d36c7ff1', 'marca': 'La Suprema', 'grameaje_ml': 400.0, 'meses': [6.5, 8.0, 8.0, 10.0, 10.0, 10.0, 10.0, 10.0]},
    56: {'producto_id': '2d4e8778-5239-4ab9-a91d-c37776561ba8', 'marca': 'Lazzaronni', 'grameaje_ml': 400.0, 'meses': [7.0, 7.0, 7.0, 6.0, 6.0, 6.0, 6.0, 6.0]},
    57: {'producto_id': '4b531dd6-fc7e-4950-87ee-bd8c8234b070', 'marca': 'Nutregal', 'grameaje_ml': 400.0, 'meses': [8.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0]},
    58: {'producto_id': '8f682243-8a24-4dcb-bc15-1aa9d57f1ed4', 'marca': 'Don Vittorio', 'grameaje_ml': 200.0, 'meses': [14.0, 14.0, 14.0, 9.0, 9.0, 9.0, 9.0, 9.0]},
    59: {'producto_id': '47d2da25-99e2-4b51-a8e3-f41a766253e6', 'marca': 'Arcor', 'grameaje_ml': 200.0, 'meses': [16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0]},
    60: {'producto_id': 'd7292181-c6b2-45f9-b6ab-79cc790120ae', 'marca': 'Pomarola', 'grameaje_ml': 200.0, 'meses': [12.0, 9.0, 15.0, 9.0, 9.0, 9.0, 9.0, 9.0]},
    61: {'producto_id': '41d1b510-182b-4647-80d1-28af3a29c1d6', 'marca': 'Cajamar', 'grameaje_ml': 140.0, 'meses': [15.0, 15.0, 15.0, 7.0, 7.0, 7.0, 7.0, 7.0]},
    62: {'producto_id': '9d8cd10d-b263-4131-aaa4-52168a719b5f', 'marca': 'Confort', 'grameaje_ml': 12.0, 'meses': [87.0, 87.0, 87.0, 87.0, 87.0, 87.0, 87.0, 87.0]},
    63: {'producto_id': 'd01167db-1aa1-4d8b-8e60-b608ef991ca6', 'marca': 'Nacional', 'grameaje_ml': 12.0, 'meses': [25.0, 25.0, 25.0, 45.0, 45.0, 45.0, 45.0, 45.0]},
    64: {'producto_id': '5f5a0917-f948-4e43-8902-5d59fb1bade4', 'marca': 'Perlita', 'grameaje_ml': 12.0, 'meses': [30.0, 25.0, 30.0, 35.0, 35.0, 35.0, 35.0, 35.0]},
    65: {'producto_id': '8cb722e6-0e95-456f-b4fb-f0593484f9c9', 'marca': 'Babyñoño', 'grameaje_ml': 6.0, 'meses': [12.0, 10.0, 8.0, 7.0, 7.0, 7.0, 7.0, 7.0]},
    66: {'producto_id': 'ba28c623-b641-4a20-8b89-0c43a0f15635', 'marca': 'ELITE', 'grameaje_ml': 6.0, 'meses': [8.0, 8.0, 12.0, 7.0, 7.0, 7.0, 7.0, 7.0]},
    67: {'producto_id': '952040db-6ed7-467c-96d5-acc39cdb3b0e', 'marca': 'Zote', 'grameaje_ml': 400.0, 'meses': [12.0, 12.0, 12.0, 21.0, 21.0, 21.0, 18.0, 18.0]},
    68: {'producto_id': '7640de56-63c3-4a2a-93b0-ad99068e6808', 'marca': 'Uno', 'grameaje_ml': 200.0, 'meses': [7.0, 8.0, 7.0, 20.0, 20.0, 20.0, 20.0, 20.0]},
    69: {'producto_id': '681da6ec-5715-4853-b9f1-0c1deb43ec05', 'marca': 'Macho', 'grameaje_ml': 400.0, 'meses': [15.0, 8.0, 8.0, 18.0, 18.0, 18.0, 18.0, 18.0]},
    70: {'producto_id': '3c189106-8bfc-4c38-94dc-54fe9b49b38b', 'marca': 'Podium', 'grameaje_ml': 23.0, 'meses': [380.0, 380.0, 380.0, 380.0, 380.0, 380.0, 340.0, 340.0]},
    71: {'producto_id': '4ad20327-c4dd-4b0b-8750-afd561a14177', 'marca': 'CIBAU, adulto', 'grameaje_ml': 15.0, 'meses': [476.0, 476.0, 476.0, 476.0, 476.0, 476.0, 530.0, 530.0]},
    72: {'producto_id': '36ebe1f3-d3b2-4158-b3a2-f898676acb73', 'marca': 'CIBAU, cachorro', 'grameaje_ml': 15.0, 'meses': [519.0, 519.0, 519.0, 519.0, 519.0, 519.0, 519.0, 519.0]},
    73: {'producto_id': '3dd5dcd5-c115-4cff-93ba-42fd00f471c9', 'marca': 'DOG CHOW', 'grameaje_ml': 21.0, 'meses': [430.0, 430.0, 430.0, 430.0, 430.0, 430.0, 440.0, 440.0]},
    74: {'producto_id': '2922dabf-3979-49c3-adc7-97987dbe4338', 'marca': 'Podium, Gato', 'grameaje_ml': 15.0, 'meses': [336.0, 336.0, 336.0, 336.0, 336.0, 336.0, 300.0, 300.0]},
    75: {'producto_id': 'e22a2a26-8402-492c-89a8-17773dc3f182', 'marca': 'MONELLO', 'grameaje_ml': 15.0, 'meses': [473.0, 473.0, 473.0, 473.0, 473.0, 473.0, 420.0, 420.0]},
    76: {'producto_id': '904f6d08-7a24-4a9e-9b4d-588dd9eb28c9', 'marca': 'Lee Roy', 'grameaje_ml': 15.0, 'meses': [445.0, 445.0, 445.0, 445.0, 445.0, 445.0, 445.0, 445.0]},
    77: {'producto_id': '366f6662-e22e-441d-998b-267787a7e920', 'marca': 'CAT CHOW', 'grameaje_ml': 15.0, 'meses': [440.0, 440.0, 440.0, 440.0, 440.0, 440.0, 373.4, 373.4]},
    78: {'producto_id': '46ba4aae-d05c-4633-a0be-5f8354bdea48', 'marca': 'Winston Fresh Mix', 'grameaje_ml': 20.0, 'meses': [108.0, 108.0, 108.0, 108.0, 108.0, 108.0, 120.0, 120.0]},
    79: {'producto_id': '09d304dc-49eb-4e4f-bd65-c50e8e2327dc', 'marca': 'Camel Amarillo', 'grameaje_ml': 20.0, 'meses': [175.0, 175.0, 175.0, 175.0, 175.0, 175.0, 195.0, 195.0]},
    80: {'producto_id': 'd7e88d39-c33a-4850-966b-b9548e31ff19', 'marca': 'Marlboro Rojo', 'grameaje_ml': 20.0, 'meses': [195.0, 195.0, 195.0, 195.0, 195.0, 195.0, 230.0, 230.0]},
    81: {'producto_id': '70a50923-9642-4521-8f7e-cad89cff5125', 'marca': 'L&M Azul', 'grameaje_ml': 20.0, 'meses': [165.0, 165.0, 165.0, 165.0, 165.0, 165.0, 230.0, 230.0]},
    82: {'producto_id': '4b9b11cd-d13c-4a9f-8924-85e9635071e1', 'marca': 'Esse Change', 'grameaje_ml': 20.0, 'meses': [180.0, 180.0, 180.0, 180.0, 180.0, 180.0, 180.0, 180.0]},
}

MESES = [
    '2026-01', '2026-02', '2026-03', '2026-04',
    '2026-05', '2026-06', '2026-07', '2026-08',
]
MES_NOMBRE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto']
RELEVAMIENTO_SUFIJO = "(Excel evolutivos)"
TOLERANCIA = 0.005  # diferencias mas chicas que esto se consideran "igual" (redondeo)


def get_client():
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_KEY')
    if not url or not key:
        sys.exit("Faltan las variables de entorno SUPABASE_URL / SUPABASE_SERVICE_KEY.")
    return create_client(url, key)


def get_admin_id(sb):
    res = sb.table('empleados').select('id').eq('codigo_empleado', 'ADMIN01').execute()
    if res.data:
        return res.data[0]['id']
    res = sb.table('empleados').select('id').eq('rol', 'admin').limit(1).execute()
    if res.data:
        return res.data[0]['id']
    sys.exit("No se encontro ningun empleado con rol='admin' en la tabla empleados. Abortando.")


def get_or_create_relevamiento_historico(sb, periodo, mes_nombre, admin_id, cache, crear):
    key = ('historico', periodo)
    if key in cache:
        return cache[key]
    descripcion = f"Histórico Automatizado {mes_nombre} {RELEVAMIENTO_SUFIJO}"
    res = sb.table('relevamientos').select('id').eq('periodo', periodo).eq('descripcion', descripcion).execute()
    if res.data:
        cache[key] = res.data[0]['id']
        return cache[key]
    if not crear:
        cache[key] = None
        return None
    res = sb.table('relevamientos').insert({
        'periodo': periodo, 'descripcion': descripcion,
        'creado_por': admin_id, 'estado': 'finalizado',
    }).execute()
    cache[key] = res.data[0]['id']
    return cache[key]


def construir_plan(sb):
    """Recorre DATOS_EXCEL y arma la lista de inserciones/correcciones necesarias,
    sin escribir nada todavia."""
    inserts = []      # (idx, marca, mes_nombre, periodo, producto_id, valor, relevamiento_descripcion)
    correcciones = []  # (idx, marca, mes_nombre, periodo, producto_id, precio_id, valor_viejo, valor_nuevo, relevamiento_id, relevamiento_desc, relevamiento_estado)

    # cache de relevamientos por periodo (todos, no solo los historicos), para no
    # repetir la misma consulta una vez por producto
    relevamientos_por_periodo = {}

    def get_relevamientos(periodo):
        if periodo not in relevamientos_por_periodo:
            res = sb.table('relevamientos').select('id, descripcion, estado').eq('periodo', periodo).execute()
            relevamientos_por_periodo[periodo] = res.data
        return relevamientos_por_periodo[periodo]

    for idx in sorted(DATOS_EXCEL):
        d = DATOS_EXCEL[idx]
        producto_id = d['producto_id']
        grameaje = d['grameaje_ml'] or 0
        for m, valor in enumerate(d['meses']):
            if valor is None:
                continue
            periodo = MESES[m]
            mes_nombre = MES_NOMBRE[m]
            descripcion_hist = f"Histórico Automatizado {mes_nombre} {RELEVAMIENTO_SUFIJO}"

            relevamientos = get_relevamientos(periodo)
            encontrado_en_historico = False

            for rel in relevamientos:
                res = sb.table('precios_relevamiento').select('id, precio_venta_unidad') \
                    .eq('producto_id', producto_id).eq('relevamiento_id', rel['id']).execute()
                if not res.data:
                    continue
                fila = res.data[0]
                if rel['descripcion'] == descripcion_hist:
                    encontrado_en_historico = True
                actual = fila['precio_venta_unidad']
                if actual is None or abs(float(actual) - valor) > TOLERANCIA:
                    correcciones.append((
                        idx, d['marca'], mes_nombre, periodo, producto_id, fila['id'],
                        actual, valor, rel['id'], rel['descripcion'] or '(sin descripcion)', rel['estado'],
                    ))

            if not encontrado_en_historico:
                inserts.append((idx, d['marca'], mes_nombre, periodo, producto_id, valor, grameaje))

    return inserts, correcciones


def print_dry_run(inserts, correcciones):
    print("=" * 90)
    print(f"FILAS NUEVAS A INSERTAR (nunca se habian cargado -- Agosto faltante + categorias "
          f"enteras sin datos): {len(inserts)}")
    print("=" * 90)
    for idx, marca, mes_nombre, periodo, producto_id, valor, grameaje in inserts:
        print(f"  [{idx:>2}] {marca:<20} {mes_nombre:<8} -> Bs {valor}")

    print()
    print("=" * 90)
    print(f"PRECIOS A CORREGIR (ya tenian un valor cargado -- de un relevamiento real o del "
          f"historico -- distinto al del Excel): {len(correcciones)}")
    print("=" * 90)
    for idx, marca, mes_nombre, periodo, producto_id, precio_id, viejo, nuevo, rel_id, rel_desc, rel_estado in correcciones:
        origen = "HISTORICO (mi carga anterior)" if RELEVAMIENTO_SUFIJO in rel_desc else f"RELEVAMIENTO REAL ({rel_estado})"
        print(f"  [{idx:>2}] {marca:<20} {mes_nombre:<8} {origen:<32} Bs {viejo} -> Bs {nuevo}   "
              f"(relevamiento: {rel_desc})")

    print()
    print("Corre con --apply para ejecutar estos cambios de verdad.")


def aplicar(sb, inserts, correcciones):
    admin_id = get_admin_id(sb)
    cache = {}

    print(f"\nInsertando {len(inserts)} precios nuevos...")
    for idx, marca, mes_nombre, periodo, producto_id, valor, grameaje in inserts:
        rel_id = get_or_create_relevamiento_historico(sb, periodo, mes_nombre, admin_id, cache, crear=True)
        precio_gr_ml = (valor / grameaje) if grameaje else None
        res = sb.table('precios_relevamiento').insert({
            'relevamiento_id': rel_id,
            'producto_id': producto_id,
            'precio_venta_unidad': valor,
            'precio_por_gr_ml': precio_gr_ml,
        }).execute()
        precio_id = res.data[0]['id']
        sb.table('historial_cambios').insert({
            'precio_id': precio_id, 'campo_modificado': 'precio_venta_unidad',
            'valor_anterior': None, 'valor_nuevo': str(valor), 'modificado_por': admin_id,
        }).execute()
    print("  listo.")

    print(f"\nCorrigiendo {len(correcciones)} precios existentes...")
    for idx, marca, mes_nombre, periodo, producto_id, precio_id, viejo, nuevo, rel_id, rel_desc, rel_estado in correcciones:
        grameaje = DATOS_EXCEL[idx]['grameaje_ml'] or 0
        precio_gr_ml = (nuevo / grameaje) if grameaje else None
        sb.table('precios_relevamiento').update({
            'precio_venta_unidad': nuevo, 'precio_por_gr_ml': precio_gr_ml,
        }).eq('id', precio_id).execute()
        sb.table('historial_cambios').insert({
            'precio_id': precio_id, 'campo_modificado': 'precio_venta_unidad',
            'valor_anterior': str(viejo) if viejo is not None else None,
            'valor_nuevo': str(nuevo), 'modificado_por': admin_id,
        }).execute()
        print(f"  [{idx:>2}] {marca:<20} {mes_nombre:<8} Bs {viejo} -> Bs {nuevo}  ({rel_desc})")
    print("  listo.")

    print("\nListo. Revisa en la app las categorias que tocaste -- si alguna de ellas cambio "
          "el precio del LIDER, conviene des-marcar y volver a marcar el lider desde Gestion "
          "de Catalogo para que el backend recalcule index_real de todo el historial.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='Ejecuta los cambios (por defecto es dry-run)')
    args = ap.parse_args()

    sb = get_client()
    inserts, correcciones = construir_plan(sb)
    print_dry_run(inserts, correcciones)
    if args.apply:
        print("\n" + "=" * 90)
        aplicar(sb, inserts, correcciones)


if __name__ == '__main__':
    main()