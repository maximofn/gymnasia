# Measurements Functional Spec (V1)

## Objetivo
Permitir seguimiento historico de peso y contornos corporales.

## Alcance
- Alta de mediciones.
- Listado de mediciones.
- Edicion puntual de mediciones.
- Borrado de mediciones.

## Casos de uso
1. Registrar nueva medicion con fecha/hora.
2. Registrar solo peso, solo contornos o ambos.
3. Consultar historico ordenado por fecha.
4. Corregir una medicion existente.
5. Eliminar una medicion.

## Reglas funcionales
- `weight_kg` no negativo.
- `circumferences_cm` se guarda como mapa flexible `{zona: valor}`.
- El listado devuelve resultados mas recientes primero.

## Criterios de aceptacion
- Usuario puede crear mediciones validas.
- Usuario puede editar campos de medicion existente.
- Usuario puede borrar medicion sin afectar otras.

## Casos limite
- ID invalido retorna 404.
- Payload parcial en patch actualiza solo campos enviados.
- Campos faltantes no deben ser sobreescritos por `null` salvo envio explicito.

## Fuera de alcance v1
- Fotos de progreso enlazadas a medicion.
- Graficas de tendencia en backend.
