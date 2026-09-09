# Validación de GYM-230 (ticket para corregir la lentitud de la interfaz)

## Evidencia automática

La regresión usa un historial sintético de 1.826 días distintos, sin fotos ni
datos del teléfono. La E2E arranca un entrenamiento real en la app exportada y
espera que avance su reloj, marca una serie, navega, desplaza pantallas, cambia el
periodo del gráfico y envía un mensaje con el proveedor falso local.

En la ejecución del 9 de septiembre de 2026, las preparaciones y los resúmenes
permanecieron en **2 antes y después** de esas interacciones: una ejecución con
el estado inicial vacío y otra al hidratar el historial. Las visitas al historial
permanecieron en **1.826** y las evaluaciones de métricas en **18**. Solo aumentó
el contador de gráficos, de 4 a 5, al cambiar su periodo.

La misma prueba cubre los cambios de altura y sexo, altas al alcanzar el límite,
edición, borrado, recarga, importación JSON v1, recuperación del último snapshot
y borrado total. Simula también un fallo al persistir una medida: el historial y
el resumen no cambian; al reintentar correctamente, se actualizan.

```bash
npm test
npm --workspace apps/mobile exec tsc --noEmit
npm run test:measurements:performance:e2e
```

Las pruebas deterministas comparan las nueve métricas y los gráficos con el
algoritmo anterior, conservado únicamente como referencia en tests. Incluyen
duplicados, desempates, valores ausentes/no finitos y propiedades generadas con
semilla fija. El coste se comprueba contando ordenaciones reales y lecturas de
campos, además de los contadores del cálculo. Un contrato sobre el árbol de
sintaxis de `App.tsx` protege sus dependencias de memoización en CI.

## Comparación sintética de tiempo

Node 22.22.0 en macOS; 1.826 fechas, nueve métricas, cinco iteraciones de
calentamiento y treinta muestras. El cálculo nuevo incluye preparar el historial,
ordenarlo y derivar el resumen; no mide únicamente un resultado ya almacenado.

| Cálculo completo | Mediana | Percentil 95 | Máximo |
| --- | ---: | ---: | ---: |
| Algoritmo anterior, nueve llamadas | 233,67 ms | 376,81 ms | 478,08 ms |
| Historial y resumen compartidos | 0,25 ms | 0,83 ms | 0,93 ms |

Es una comparación del algoritmo con datos sintéticos, no una medida del
teléfono ni un presupuesto que deba bloquear CI. En renders ajenos a las medidas,
la E2E comprueba que ninguna de esas operaciones vuelve a ejecutarse.

## Comprobación nativa pendiente

Antes de cerrar el ticket, el mantenedor debe validar el APK Staging corregido
en el dispositivo original. Conservar el historial existente; no borrar datos,
reinstalar la versión lenta ni importar copias personales como parte de esta
comprobación sin autorización específica y una copia recuperable.

Registrar versión/commit, modelo de teléfono, Android, tamaño del historial,
estado de batería/ahorro y red. Repetir al menos diez veces por versión:

1. Inicio → Dieta → Medidas → Inicio, con un entrenamiento activo.
2. Marcar una serie y desplazarse por la sesión y por Medidas.
3. Añadir, editar y borrar una medición de prueba: comprobar tarjetas y gráficos.

Anotar mediana, percentil 95 y máximo desde la interacción hasta su respuesta
visual. Conservar una traza nativa comparable que permita comprobar que el resumen
ya no se ejecuta con cada interacción y que desaparecen las asignaciones masivas
asociadas. No incluir contenido sanitario, mensajes, fotos ni credenciales en
las evidencias publicadas.

| Evidencia nativa | Estado |
| --- | --- |
| Diez muestras por interacción, antes/después | Pendiente del dispositivo original |
| Perfil posterior y asignaciones | Pendiente del dispositivo original |
| Confirmación de fluidez del mantenedor | Pendiente |

La PR y el ticket permanecen abiertos hasta esa confirmación. Fusionar y lanzar
Producción requieren aprobación explícita independiente.

## Límites observados en las pruebas

El chat principal actual no ofrece detener una respuesta. La E2E cubre envío,
descarte de un borrador y salida del chat; no afirma probar una cancelación que
la interfaz no permite. En web a 390 px de ancho, la barra flotante del
entrenamiento tapa el botón Enviar; la prueba lo activa con teclado respetando
su estado habilitado. Estas limitaciones de interfaz quedan fuera de la
optimización del resumen corporal.

Si el arranque frío de Metro supera el timeout de la suite de entrenamiento,
puede ejecutarse contra una exportación web servida en loopback con
`TRAIN_E2E_URL=http://127.0.0.1:<puerto> npm run test:train:e2e`.
