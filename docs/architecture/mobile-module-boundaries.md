# Límites de módulos de la aplicación móvil

`apps/mobile/App.tsx` es la raíz de composición. Decide qué pantalla se muestra,
compone los handlers globales de Atrás y mantiene las barreras de arranque y
recuperación. La lógica de dominio, el estado de cada flujo y las vistas viven en
módulos con una dirección de dependencias explícita.

## Capas

| Capa | Responsabilidad | Puede importar |
| --- | --- | --- |
| `training/`, `diet/`, `measurements/` | Contratos, normalización, cálculos y selectores puros | Otros contratos públicos, nunca React Native ni Expo |
| `persistence/`, `storage/`, `backup/` | Modelo durable, recuperación, serialización y formatos de copia | Contratos públicos de dominio |
| `platform/` | Implementaciones Expo de almacenamiento, red, audio, archivos, imágenes, compartir y APIs nativas | Solo infraestructura compartida; nunca dominios ni pantallas |
| `controllers/` | Estado React y acciones de un flujo; adapta dominios y servicios a un modelo de pantalla | Entradas públicas de dominio, persistencia y plataforma |
| `screens/` | Presentación React Native memorizada | Modelos/acciones de controladores, componentes UI y contratos públicos |
| `shell/` | Destinos, prioridades de Atrás y test IDs | Infraestructura compartida |
| `App.tsx` | Arranque, recuperación y composición del shell | Entradas públicas; no debe contener una pantalla completa |

Los controladores de pantalla usan este contrato común:

```ts
type ScreenController<Model, Actions, Layer extends ShellLayerId = never> = {
  model: Readonly<Model>;
  actions: Readonly<Actions>;
  back: {
    layers: Record<Layer, boolean>;
    handlers: Record<Layer, () => boolean>;
  };
};
```

`LocalStoreRuntime` ofrece la instantánea React, la barrera de hidratación, una
actualización ordinaria y un commit duradero serializado para operaciones que no
pueden confirmar éxito antes de persistir.

## Mapa de composición

```text
App.tsx
├── platform/index.ts
├── persistence/localStoreRuntime.ts
├── controllers/
│   ├── homeController.ts
│   ├── chatController.ts
│   ├── measurementsController.ts
│   ├── dietController.ts
│   ├── trainingController.ts
│   ├── catalogController.ts
│   └── settingsController.ts
├── screens/
│   ├── AppShell.tsx
│   ├── HomeScreen.tsx
│   ├── ChatScreen.tsx
│   ├── MeasurementsScreen.tsx
│   ├── DietScreen.tsx
│   ├── TrainingScreen.tsx
│   ├── SettingsScreen.tsx
│   └── *Overlays.tsx
└── shell/shellRegistry.ts
```

Los runtimes de catálogos, dieta, mediciones, memoria, preferencias y
persistencia se montan una sola vez en la raíz y conservan su estado al cambiar
de pestaña. Las pantallas reciben únicamente `model` y `actions`; no importan
SecureStore, AsyncStorage ni APIs de Expo directamente.

## Control automático

`scripts/mobile-boundaries/check.mjs` analiza imports estáticos, exports desde
otros módulos y `import()` locales mediante la API de TypeScript. Resuelve
extensiones JavaScript/TypeScript e índices, valida entradas públicas y detecta
ciclos con DFS. La política está en `scripts/mobile-boundaries/policy.json`.

```bash
npm run check:mobile-boundaries
npm run test:mobile-boundaries
```

Toda excepción temporal debe aparecer en `legacyImports`, tener un origen
concreto y eliminarse cuando ese bloque se extraiga. Un import nuevo entre capas
no puede ampliar la excepción existente.
