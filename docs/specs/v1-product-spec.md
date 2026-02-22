# V1 Product Spec

## 1. Objetivo
Entregar un MVP B2C de seguimiento de entrenamiento, dieta y medidas, con IA opcional por BYOK, para beta privada.

## 2. Alcance
- Plataformas: web y movil.
- Publico: 18+.
- Modelo: gratis.
- Beta privada: 2 MAU.

## 3. Modulos v1
- Entrenamiento
- Dieta
- Medidas
- Objetivo activo
- Chat IA (BYOK)
- Generacion multimedia (BYOK)

## 4. Requisitos funcionales

### 4.1 Entrenamiento
- Gestion de plantillas:
  - Crear, editar, clonar, mover orden y borrar.
- Gestion de ejercicios por plantilla:
  - Crear, editar, clonar, mover y borrar.
- Gestion de series por ejercicio:
  - Crear, editar, clonar, mover y borrar.
- Ejecucion:
  - Iniciar sesion desde plantilla.
  - Editar durante ejecucion.
  - Guardar snapshot historico de sesion.
  - Al finalizar, opcion de aplicar cambios a plantilla futura (todo o nada).

### 4.2 Dieta
- Estructura:
  - Dia -> comidas -> items.
- Captura manual:
  - gramos/raciones/macros/calorias.
- IA por foto:
  - plato, etiqueta nutricional, carta.
  - guardado automatico.
  - mostrar confianza.
  - permitir edicion posterior.

### 4.3 Medidas
- Registrar peso.
- Registrar contornos.
- Mantener historico.

### 4.4 Objetivo
- Un objetivo activo por usuario.

### 4.5 IA (BYOK)
- Sin API key:
  - tracking activo.
  - IA deshabilitada.
- Con API key:
  - chat y funciones IA habilitadas.

## 5. Reglas de negocio
- Reps: fijo o rango.
- Descanso: formato `mm:ss`.
- Peso: decimal permitido.
- Herencia de valores de serie:
  - de la ultima sesion del mismo ejercicio si no hay nuevo valor.

## 6. Criterios de aceptacion v1
- Usuario autenticado puede gestionar entrenamientos/dieta/medidas.
- Usuario puede iniciar y cerrar sesiones de entrenamiento.
- Usuario puede establecer un objetivo activo.
- Usuario puede usar app sin IA si no configura BYOK.
- Registro de cuenta bloquea menores de 18 anos.

## 7. Exclusiones actuales
- Soporte humano en beta.
- Auditoria completa de cambios historicos.
