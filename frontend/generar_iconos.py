"""
generar_iconos.py — Crea los íconos PNG de la PWA
--------------------------------------------------
Ejecutar UNA VEZ dentro de la carpeta frontend/:
  pip install Pillow
  python generar_iconos.py

Genera:
  public/icons/icon-192.png
  public/icons/icon-512.png
"""

from PIL import Image, ImageDraw, ImageFont
import os

os.makedirs("public/icons", exist_ok=True)

def crear_icono(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Fondo redondeado navy
    radio = size // 5
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=radio,
        fill=(230, 57, 70, 255),   # rojo PROESA
    )

    # Texto "RP" centrado
    font_size = size // 3
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                                   font_size)
    except Exception:
        font = ImageFont.load_default()

    text = "RP"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) // 2
    y = (size - th) // 2 - size // 20
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

    img.save(f"public/icons/icon-{size}.png", "PNG")
    print(f"Generado: public/icons/icon-{size}.png")

crear_icono(192)
crear_icono(512)
print("Listo. Iconos generados en public/icons/")