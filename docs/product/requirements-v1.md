# Requisitos V1

## Entrenamiento
- Gestion de plantillas:
  - Crear, editar, clonar, mover posicion y borrar.
- Gestion de ejercicios dentro de plantilla:
  - Crear, editar, clonar, mover y borrar.
- Gestion de series dentro de ejercicio:
  - Crear, editar, clonar, mover y borrar.
- Ejecucion de entrenamiento:
  - Crear sesion desde plantilla.
  - Permitir cambios durante sesion.
  - Guardar snapshot historico de la sesion.
  - Al finalizar, opcion de aplicar cambios a futuras sesiones (todo o nada).
- Campos de serie:
  - Reps fijas o rango.
  - Descanso `mm:ss`.
  - Peso con decimales.
- Herencia de valores:
  - Si no hay valor nuevo, hereda de ultima sesion del mismo ejercicio.

## Dieta
- Estructura de datos:
  - Dia -> comidas -> items.
- Captura:
  - Manual (gramos/raciones/macros/calorias).
  - Estimacion IA por foto (plato, etiqueta, carta).
- Flujo IA:
  - Guardado automatico permitido.
  - Mostrar confianza.
  - Permitir correccion manual posterior.

## Medidas
- Registro historico de:
  - Peso
  - Contornos (JSON por zona corporal)
  - Notas

## Objetivo
- Un objetivo activo por usuario.

## Chat IA
- Proveedores:
  - Anthropic primario.
  - Fallback OpenAI.
  - Fallback Google.
- Memoria:
  - Global
  - Separada por dominio: entrenamiento, dieta, medidas.
- Safety:
  - Bloqueo de dopaje/farmacos.
  - Bloqueo de ayuno extremo/purgas.
  - Avisos de seguridad cuando aplique.

## No funcionales
- Region de datos: UE.
- Infra: free tier sin SLA.
- Timeouts:
  - Chat: 300s.
  - Multimedia: 600s.
- Rate limit chat: 10 mensajes/min por usuario.
