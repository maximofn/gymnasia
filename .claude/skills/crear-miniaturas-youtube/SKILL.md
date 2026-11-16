---
name: crear-miniaturas-youtube
description: Crea y mejora miniaturas de YouTube que despiertan curiosidad sin engañar, usando fotos, identidad visual y el contenido real del vídeo. Úsala para idear el hook, generar o editar la imagen y entregar un archivo listo para subir; no para escribir el guion completo ni editar el vídeo.
---

# Crear miniaturas de YouTube

Convierte la promesa real de un vídeo en una imagen que se entienda en menos de un segundo y siga siendo legible en móvil. La miniatura debe abrir una pregunta que el vídeo responde, no prometer un resultado que el contenido no ofrece.

## Encontrar el hook visual

Antes de diseñar, identifica:

- qué aprende, descubre o consigue el espectador;
- cuál es el conflicto, decisión, coste o resultado más interesante;
- qué sabe ya por el título y qué incógnita puede aportar la miniatura;
- a quién va dirigido el vídeo;
- qué fotos, capturas, producto e identidad visual reales están disponibles.

Propón internamente varias frases y elige la que genere más tensión honesta. El texto no debe limitarse a describir el tema ni repetir el título. Prefiere entre dos y siete palabras con una idea concreta: una limitación, una consecuencia, un contraste, una decisión difícil o una afirmación que el vídeo demuestra.

Puede rozar el clickbait mediante curiosidad, urgencia o sorpresa, pero nunca debe:

- inventar un fracaso, resultado, cifra o peligro;
- exagerar una emoción que el vídeo no contiene;
- ocultar una condición que vuelve falsa la promesa;
- usar absolutos como «nadie», «siempre» o «imposible» sin respaldo.

Si el usuario ya ha elegido el texto, respétalo salvo que pida mejorarlo. Cuando lo mejore, explica en una frase por qué la nueva opción es más fuerte y sigue siendo fiel al vídeo.

## Diseñar para la vista pequeña

Construye una sola jerarquía visual clara:

1. un hook textual dominante;
2. un rostro, producto u objeto principal;
3. un elemento secundario que explique el conflicto o resultado.

Usa contraste alto, siluetas limpias y espacio negativo. Mantén el rostro y el texto importante dentro del 90 % central del lienzo. Comprueba la composición a tamaño completo y reducida aproximadamente al 10–15 %.

Evita fondos recargados, código diminuto, interfaces llenas de texto, más de dos estilos tipográficos, adornos que compitan con el hook y recursos gastados como flechas rojas, círculos, llamas o expresiones de sorpresa exageradas, salvo que el usuario los solicite y tengan sentido.

Deriva colores, tipografía, iluminación y formas de la marca o del proyecto real cuando existan. No inventes logos, pantallas, métricas ni marcas de terceros.

## Trabajar con la persona de la miniatura

Cuando el usuario aporte una foto o fotograma:

- trátalo como referencia de identidad o como objetivo de edición, según lo pedido;
- inspecciona primero el archivo con `view_image` si está disponible localmente;
- preserva rostro, edad, tono de piel, pelo y rasgos reconocibles;
- permite únicamente un ajuste leve y natural de expresión o pose;
- elimina el fondo solo cuando mejore la composición;
- evita duplicar el rostro, deformar manos o convertir a la persona en una caricatura.

Si la imagen solo está adjunta a la conversación, incluye con `num_last_images_to_include` el mínimo número de imágenes que cubra todas las referencias. Si todas tienen rutas locales, usa `referenced_image_paths`. No combines ambos mecanismos.

## Generar la imagen

Usa la herramienta integrada de generación de imágenes para crear o editar el bitmap. Estructura la petición como una especificación breve que incluya:

- uso: miniatura final de YouTube;
- relación 16:9 y composición prevista;
- función de cada imagen de entrada;
- sujeto y elementos secundarios;
- posición aproximada del sujeto y del texto;
- iluminación, tono y paleta;
- texto literal entre comillas;
- invariantes de identidad y elementos prohibidos.

Para texto dentro de la imagen, exige la frase exacta, sus tildes y que no aparezcan palabras adicionales. Usa mayúsculas, tipografía gruesa y pocas líneas. Revisa visualmente cada carácter: una composición atractiva con texto incorrecto no es una entrega válida.

Genera una primera propuesta completa. Si necesita ajustes, itera cambiando una sola cosa cada vez y repite las invariantes importantes. No sobrescribas la versión anterior salvo petición expresa.

## Exportar para YouTube

La entrega final debe medir exactamente `1280 × 720`, conservar el encuadre y ocupar menos de 2 MB. Para convertir una imagen final opaca a JPEG usa:

```bash
scripts/export_thumbnail.sh entrada.png salida.jpg
```

El script recorta al centro solo lo imprescindible para completar 16:9, elimina metadatos y reduce gradualmente la calidad si hace falta para respetar el límite. Usa nombres descriptivos y versionados cuando ya exista una salida.

Después de exportar, comprueba dimensiones, peso, ortografía, identidad, zona segura y legibilidad a tamaño pequeño. No subas ni publiques la miniatura sin una petición explícita.

## Entrega

Muestra la miniatura en la conversación y proporciona un enlace al archivo final. Indica:

- el hook elegido y su relación con el contenido;
- dimensiones y peso del archivo;
- la ruta final;
- el prompt utilizado o un resumen fiel si es muy largo;
- si se usó generación desde cero o edición con imagen de referencia.

