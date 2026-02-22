# Diet Functional Spec (V1)

## Objetivo
Permitir registrar dieta diaria estructurada por comidas e items nutricionales.

## Alcance
- Dia nutricional por fecha.
- Comidas por dia.
- Items por comida.
- Macros y calorias manuales.

## Casos de uso
1. Consultar dieta de una fecha.
2. Crear o sobrescribir dieta de una fecha.
3. Definir comidas en orden.
4. Definir items por comida con valores nutricionales.

## Reglas funcionales
- Un unico registro de dia por usuario y fecha.
- El `PUT` del dia reemplaza estructura previa de comidas/items del mismo dia.
- Cada item puede incluir:
  - gramos
  - raciones
  - calorias totales
  - macros
  - calorias por macro
- `created_by_ai` existe para distinguir origen del item cuando aplique IA.

## Criterios de aceptacion
- Usuario puede crear y leer dieta diaria completa.
- Orden de comidas se conserva por `position`.
- Valores numericos de macros/calorias se persisten correctamente.

## Casos limite
- Fecha sin registro devuelve `null`.
- Payload con comidas vacias es valido si el usuario desea dia sin detalle.
- IDs de otro usuario nunca deben ser visibles ni editables.

## Fuera de alcance v1
- Endpoint de estimacion por foto ya operativo.
- Catalogo global de alimentos con busqueda avanzada.
- Calculo automatico de recomendaciones por objetivo.
