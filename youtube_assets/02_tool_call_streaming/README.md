# Assets de grabación: streaming de tool calls

Presentación interactiva 16:9 para el vídeo sobre acumulación de argumentos en streaming.

## Abrir y grabar

1. Abre `index.html` en Chrome a 1920×1080.
2. Pulsa `F` para entrar en pantalla completa.
3. Pulsa `H` para mostrar u ocultar los controles.
4. Usa clic, `Espacio`, `Enter` o `→` para revelar el siguiente elemento.
5. Usa clic derecho o `←` para retroceder un paso.
6. Usa `N`/`Page Down` y `P`/`Page Up` para cambiar directamente de escena.
7. Pulsa `R` para reiniciar la escena actual.

También puedes abrir una escena concreta añadiendo `#scene-N` a la URL.

## Exportar PNGs

Desde la raíz del repositorio:

```bash
node youtube_assets/02_tool_call_streaming/capture-scenes.mjs
```

El script usa Playwright y genera en `captures/` una imagen 1920×1080 por escena, además de una composición de miniatura con el estado bloqueado.

## Mapa del guion

| Escena | Momento aproximado | Contenido |
|---|---:|---|
| 1 | 0:00 | Hook: JSON válido con el stream todavía abierto |
| 2 | 0:45 | Provider, parser, harness y tool |
| 3 | 1:35 | Argumentos divididos en deltas |
| 4 | 2:30 | Secuencia completa de OpenAI |
| 5 | 3:45 | Dos tool calls intercaladas |
| 6 | 5:00 | Eventos terminales de OpenAI, Anthropic y Google |
| 7 | 5:40 | Parseable, complete, valid y executable |
| 8 | 6:05 | Barrera de truncamiento entre parser y harness |
| 9 | 6:55 | Por qué `{}` no autoriza la ejecución |
| 10 | 7:25 | Fixture SSE y matriz de tests |
| 11 | 8:35 | Regla completa del flujo seguro |
| 12 | 9:05 | Puente al episodio del dispatcher |

## Assets

- `assets/streaming-thumbnail-background.png`: fondo generado para miniatura o B-roll, sin texto incrustado.
- La primera escena añade sobre ese fondo el titular y los estados editables en HTML.
