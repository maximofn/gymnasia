# Archivos

- [Shell y navegación de la aplicación móvil](application-shell.md) - El shell Expo de Gymnasia coordina el arranque protegido, los destinos React, las superficies de pantalla y el retorno de Atrás. Esta página fija las barreras de hidratación, los insets seguros y los contratos mínimos para modificar esa integración.
- [Dieta y estimación de alimentos](diet-and-food-estimation.md) - Modelo local de comidas y objetivos nutricionales, vinculación explícita con catálogos y alimentos personales, y flujo opcional de estimación asistida por IA. Distingue la nutrición validada que se persiste de datos externos o estimados que requieren confirmación y validación.
- [Estado local, borrado y recuperación](local-state-and-backup.md)
- [Mediciones corporales](measurements.md) - Contrato local-first para registrar, editar, calcular y consultar medidas corporales en la app móvil. Documenta las validaciones que impiden datos inválidos, conflictos por fecha y escrituras parciales del agente.
- [Cifrado portátil y recuperación](portable-encryption-and-recovery.md) - Contrato del sobre cifrado portable v3 de Gymnasia, el empaquetado e importación de copias y la recuperación local desde cuarentena. Describe límites, fallos seguros y validaciones para operar o cambiar estos flujos sin exponer datos sensibles.
- [Entrenamiento y sesiones](training.md) - Contratos y ciclo recuperable de plantillas, series, sesiones, historial y descansos de entrenamiento. Distingue los datos durables de los controles de interfaz y las validaciones que evitan perder trabajo o duplicar resúmenes.
