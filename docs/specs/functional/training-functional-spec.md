# Training Functional Spec (V1)

## Objetivo
Permitir crear, ejecutar y evolucionar entrenamientos con historico de sesiones.

## Alcance
- Plantillas de entrenamiento.
- Ejercicios por plantilla.
- Series por ejercicio.
- Sesiones de entrenamiento basadas en plantilla.

## Casos de uso
1. Crear plantilla con ejercicios y series.
2. Editar plantilla completa.
3. Clonar plantilla.
4. Reordenar plantillas.
5. Crear/editar/clonar/reordenar/borrar ejercicios dentro de plantilla.
6. Crear/editar/clonar/reordenar/borrar series dentro de ejercicio.
7. Iniciar sesion desde plantilla.
8. Editar sesion en progreso o finalizada.
9. Finalizar sesion.
10. Aplicar cambios de sesion a la plantilla futura.

## Reglas funcionales
- Repeticiones:
  - Modo fijo (`reps_fixed`) o rango (`reps_min` + `reps_max`).
  - No se permite mezclar ambos modos en una misma serie.
- Descanso:
  - Formato obligatorio `mm:ss`.
- Peso:
  - Decimal permitido.
- Herencia:
  - Si no hay valor nuevo, se hereda de la ultima sesion del mismo ejercicio y posicion de serie.
- Aplicar cambios a plantilla:
  - Operacion de tipo todo-o-nada.
  - Afecta futuras sesiones, no reescribe origen de la sesion ya guardada.

## Criterios de aceptacion
- Usuario autenticado puede operar CRUD de plantillas, ejercicios y series.
- Iniciar sesion crea snapshot historico separado.
- Finalizar sesion marca estado `finished` y fecha fin.
- Aplicar cambios copia la estructura de la sesion a la plantilla asociada.

## Casos limite
- IDs no validos deben devolver 404 o 400 segun contexto.
- Reordenamiento con IDs incompletos o ajenos al usuario debe fallar.
- Serie con reps invalidas o descanso invalido debe ser rechazada.

## Fuera de alcance v1
- Superseries/circuitos.
- Series de calentamiento como tipo separado.
- Auditoria de cambios historicos.
