#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Uso: $0 <entrada> <salida.jpg>" >&2
  exit 2
fi

input_path=$1
output_path=$2

if [[ ! -f "$input_path" ]]; then
  echo "No existe la imagen de entrada: $input_path" >&2
  exit 1
fi

case "${output_path##*.}" in
  jpg|JPG|jpeg|JPEG) ;;
  *)
    echo "La salida debe usar la extensión .jpg o .jpeg." >&2
    exit 2
    ;;
esac

if [[ -e "$output_path" ]]; then
  echo "La salida ya existe; usa un nombre versionado: $output_path" >&2
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick no está instalado o 'magick' no está disponible." >&2
  exit 1
fi

mkdir -p "$(dirname "$output_path")"

max_bytes=2000000
quality=92

while [[ $quality -ge 68 ]]; do
  magick "$input_path" \
    -auto-orient \
    -strip \
    -resize '1280x720^' \
    -gravity center \
    -extent 1280x720 \
    -sampling-factor 4:2:0 \
    -quality "$quality" \
    "$output_path"

  byte_count=$(wc -c < "$output_path" | tr -d ' ')
  if [[ $byte_count -lt $max_bytes ]]; then
    dimensions=$(magick identify -format '%wx%h' "$output_path")
    echo "Miniatura exportada: $output_path"
    echo "Dimensiones: $dimensions"
    echo "Tamaño: $byte_count bytes"
    echo "Calidad JPEG: $quality"
    exit 0
  fi

  quality=$((quality - 4))
done

rm -f "$output_path"
echo "No se pudo bajar de 2 MB sin reducir la calidad por debajo del límite aceptado." >&2
exit 1

