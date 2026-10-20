# Revisión de los 29 patrones en el código

Trabajo de GYM-8 (ticket para unificar componentes repetidos de la interfaz).

Revisión de lectura del 2026-10-19, sobre el código de `3df545e4f3839a67e83e3688e923e4b34ead83e9`. **Esta revisión fue de solo lectura.**

La implementación posterior de las 12 familias adaptables se documenta por separado en [implementation.md](implementation.md). Las referencias de este informe siguen apuntando al código original revisado, no a las líneas después de la extracción.

La propuesta visual se conserva. Esta segunda fase contrasta sus 29 candidatos con los componentes y el JSX actuales; el parecido visual no obliga a unificar contratos de negocio.

- **Reutilizar**: Ya hay componentes que cubren el patrón en sus usos actuales; mantener sus especializaciones, sin nueva abstracción.
- **Adaptar**: Hay un componente o helper nombrado que sirve de base, pero necesita ampliar, separar o consolidar su contrato para cubrir la familia visual.
- **Crear**: No hay una abstracción de aplicación para el patrón. Hay JSX y primitivas existentes que pueden extraerse; no significa implementar un comportamiento nuevo.

Resultado: **2 reutilizar · 12 adaptar · 15 crear**. «Crear» se refiere a la abstracción de aplicación, aunque ya existan primitivas de React Native y JSX aprovechable.

## Matriz completa

| Patrón | Decisión | Evidencia principal |
| --- | --- | --- |
| Botón de acción | Adaptar | [PrimaryButton (HomeScreen.tsx:8)](../../../apps/mobile/screens/HomeScreen.tsx#L8); [PrimaryButton (SharedChatPanel.tsx:25)](../../../apps/mobile/screens/SharedChatPanel.tsx#L25) |
| Botón de icono | Crear | [JSX: cerrar ficha (CatalogOverlays.tsx:26)](../../../apps/mobile/screens/CatalogOverlays.tsx#L26); [JSX: volver al historial (TrainingScreen.tsx:34)](../../../apps/mobile/screens/TrainingScreen.tsx#L34) |
| Campo de formulario | Adaptar | [MemoryInput (SettingsScreen.tsx:1559)](../../../apps/mobile/screens/SettingsScreen.tsx#L1559); [JSX: peso (MeasurementsScreen.tsx:624)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L624) |
| Buscador | Adaptar | [CatalogSearch (SettingsScreen.tsx:2000)](../../../apps/mobile/screens/SettingsScreen.tsx#L2000); [JSX: búsqueda del catálogo (ExerciseCatalogBrowser.tsx:121)](../../../apps/mobile/catalogs/ExerciseCatalogBrowser.tsx#L121) |
| Opción seleccionable | Adaptar | [OptionChips (TrainingOverlays.tsx:231)](../../../apps/mobile/screens/TrainingOverlays.tsx#L231); [ChoiceRow (SettingsScreen.tsx:1741)](../../../apps/mobile/screens/SettingsScreen.tsx#L1741) |
| Navegación por pestañas | Reutilizar | [AppHeader (AppShell.tsx:71)](../../../apps/mobile/screens/AppShell.tsx#L71); [DesktopSidebar (AppShell.tsx:16)](../../../apps/mobile/screens/AppShell.tsx#L16) |
| Selector desplegable | Crear | [JSX: selector de métrica (MeasurementsScreen.tsx:336)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L336); [JSX: valor del selector de proveedor (SettingsScreen.tsx:2250)](../../../apps/mobile/screens/SettingsScreen.tsx#L2250) |
| Fila de opción | Crear | [JSX: opción de métrica (MeasurementsScreen.tsx:369)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L369); [JSX: opción de tipo de serie (TrainingOverlays.tsx:212)](../../../apps/mobile/screens/TrainingOverlays.tsx#L212) |
| Tarjeta de métrica | Adaptar | [StatCard de Inicio (HomeScreen.tsx:41)](../../../apps/mobile/screens/HomeScreen.tsx#L41); [StatCard de Medidas (MeasurementsScreen.tsx:17)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L17) |
| Panel de gráfica | Adaptar | [ChartCard (MeasurementsScreen.tsx:60)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L60); [TrainingChartCard (TrainingScreen.tsx:986)](../../../apps/mobile/screens/TrainingScreen.tsx#L986) |
| Barra de progreso | Crear | [JSX: avance global (TrainingScreen.tsx:2715)](../../../apps/mobile/screens/TrainingScreen.tsx#L2715); [JSX: descanso (TrainingScreen.tsx:3521)](../../../apps/mobile/screens/TrainingScreen.tsx#L3521) |
| Miniatura | Adaptar | [FoodThumbnail de Dieta (DietScreen.tsx:196)](../../../apps/mobile/screens/DietScreen.tsx#L196); [FoodThumbnail de superposiciones (DietOverlays.tsx:163)](../../../apps/mobile/screens/DietOverlays.tsx#L163) |
| Fila con imagen y metadatos | Adaptar | [FoodCatalogRow (SettingsScreen.tsx:2010)](../../../apps/mobile/screens/SettingsScreen.tsx#L2010); [JSX: fila virtualizada de ejercicio (ExerciseCatalogBrowser.tsx:214)](../../../apps/mobile/catalogs/ExerciseCatalogBrowser.tsx#L214) |
| Tarjeta de rutina | Crear | [JSX: rutina destacada (HomeScreen.tsx:122)](../../../apps/mobile/screens/HomeScreen.tsx#L122); [JSX: tarjetas de rutinas (TrainingScreen.tsx:2291)](../../../apps/mobile/screens/TrainingScreen.tsx#L2291) |
| Tarjeta de registro | Adaptar | [WorkoutHistoryEntryCard (TrainingScreen.tsx:53)](../../../apps/mobile/screens/TrainingScreen.tsx#L53); [JSX: registros de medidas (SettingsScreen.tsx:1797)](../../../apps/mobile/screens/SettingsScreen.tsx#L1797) |
| Fila de etiqueta y valor | Crear | [JSX: preferencia (SettingsScreen.tsx:958)](../../../apps/mobile/screens/SettingsScreen.tsx#L958); [JSX: resumen de sesión (TrainingScreen.tsx:85)](../../../apps/mobile/screens/TrainingScreen.tsx#L85) |
| Diálogo | Crear | [PortablePasswordModal (PortablePasswordModal.tsx:29)](../../../apps/mobile/backup/PortablePasswordModal.tsx#L29); [AiResponseReportModal (AiResponseReportModal.tsx:91)](../../../apps/mobile/AiResponseReportModal.tsx#L91) |
| Aviso informativo | Adaptar | [AiIdentityDisclosure (AiIdentityDisclosure.tsx:15)](../../../apps/mobile/AiIdentityDisclosure.tsx#L15); [HealthSafetyNotice (HealthSafetyNotice.tsx:13)](../../../apps/mobile/HealthSafetyNotice.tsx#L13) |
| Burbuja de conversación | Crear | [JSX: mensajes del panel (SharedChatPanel.tsx:111)](../../../apps/mobile/screens/SharedChatPanel.tsx#L111); [JSX: mensajes de Coach (ChatScreen.tsx:47)](../../../apps/mobile/screens/ChatScreen.tsx#L47) |
| Entrada de conversación | Adaptar | [Contrato del panel (SharedChatPanel.tsx:50)](../../../apps/mobile/screens/SharedChatPanel.tsx#L50); [JSX: compositor horizontal del panel (SharedChatPanel.tsx:369)](../../../apps/mobile/screens/SharedChatPanel.tsx#L369) |
| Fila con interruptor | Adaptar | [NotificationToggle (SettingsScreen.tsx:987)](../../../apps/mobile/screens/SettingsScreen.tsx#L987); [Usos del interruptor (SettingsScreen.tsx:1182)](../../../apps/mobile/screens/SettingsScreen.tsx#L1182) |
| Grupo de valores nutricionales | Crear | [FoodCatalogDetail: ficha, no grupo genérico (SettingsScreen.tsx:2031)](../../../apps/mobile/screens/SettingsScreen.tsx#L2031); [DietHeader (DietScreen.tsx:15)](../../../apps/mobile/screens/DietScreen.tsx#L15) |
| Panel de formulario | Crear | [MemorySettingsPanel (SettingsScreen.tsx:1488)](../../../apps/mobile/screens/SettingsScreen.tsx#L1488); [JSX: marco del alimento personal (SettingsScreen.tsx:219)](../../../apps/mobile/screens/SettingsScreen.tsx#L219) |
| Fila de serie de ejercicio | Crear | [SwipeableSetRow: solo gesto (TrainingScreen.tsx:2016)](../../../apps/mobile/screens/TrainingScreen.tsx#L2016); [JSX: fila del editor (TrainingScreen.tsx:1514)](../../../apps/mobile/screens/TrainingScreen.tsx#L1514) |
| Sección con cabecera | Crear | [JSX: sección de comida (DietScreen.tsx:230)](../../../apps/mobile/screens/DietScreen.tsx#L230); [JSX: secciones de ejercicios (TrainingScreen.tsx:2594)](../../../apps/mobile/screens/TrainingScreen.tsx#L2594) |
| Estado vacío | Crear | [JSX: vacío de rutinas (TrainingScreen.tsx:2250)](../../../apps/mobile/screens/TrainingScreen.tsx#L2250); [JSX: vacío de medidas (SettingsScreen.tsx:1794)](../../../apps/mobile/screens/SettingsScreen.tsx#L1794) |
| Menú contextual | Crear | [JSX: menú del alimento (DietScreen.tsx:278)](../../../apps/mobile/screens/DietScreen.tsx#L278); [JSX: menú de rutina (TrainingScreen.tsx:2465)](../../../apps/mobile/screens/TrainingScreen.tsx#L2465) |
| Insignia de metadatos | Crear | [JSX: categoría destacada (HomeScreen.tsx:184)](../../../apps/mobile/screens/HomeScreen.tsx#L184); [JSX: estado del historial (TrainingScreen.tsx:63)](../../../apps/mobile/screens/TrainingScreen.tsx#L63) |
| Pie informativo | Reutilizar | [LegalFooter (LegalFooter.tsx:19)](../../../apps/mobile/LegalFooter.tsx#L19); [Uso único compartido por Ajustes (App.tsx:9026)](../../../apps/mobile/App.tsx#L9026) |

## Justificación y siguiente paso por patrón

### Botón de acción — Adaptar

Hay PrimaryButton locales en Inicio y SharedChatPanel, TrainingPrimaryButton en Entreno y SecondaryButton en Dieta. Sus contratos y tamaños difieren; no hay un botón de aplicación con todas las variantes propuestas.

**Siguiente paso propuesto:** Consolidar estos helpers en una base con variante, tamaño, icono, estado desactivado, identificador y estilo; conservar las acciones fuera.

**Fuentes:** [PrimaryButton (apps/mobile/screens/HomeScreen.tsx:8)](../../../apps/mobile/screens/HomeScreen.tsx#L8); [PrimaryButton (apps/mobile/screens/SharedChatPanel.tsx:25)](../../../apps/mobile/screens/SharedChatPanel.tsx#L25); [TrainingPrimaryButton (apps/mobile/screens/TrainingScreen.tsx:1008)](../../../apps/mobile/screens/TrainingScreen.tsx#L1008); [SecondaryButton (apps/mobile/screens/DietOverlays.tsx:149)](../../../apps/mobile/screens/DietOverlays.tsx#L149).

### Botón de icono — Crear

Volver, cerrar, menú y ejecutar se dibujan con Pressable e iconos dentro de cada pantalla. No hay un IconButton de aplicación.

**Siguiente paso propuesto:** Extraer una unidad visual con etiqueta accesible, tamaño táctil, icono y tono; no trasladar handlers de dominio.

**Fuentes:** [JSX: cerrar ficha (apps/mobile/screens/CatalogOverlays.tsx:26)](../../../apps/mobile/screens/CatalogOverlays.tsx#L26); [JSX: volver al historial (apps/mobile/screens/TrainingScreen.tsx:34)](../../../apps/mobile/screens/TrainingScreen.tsx#L34).

### Campo de formulario — Adaptar

MemoryInput es un campo local ya parametrizado. Los formularios de medidas y alimentos repiten TextInput con variantes adicionales que ese helper aún no admite.

**Siguiente paso propuesto:** Usar MemoryInput como base visual, ampliar props nativas y referencia, y separar etiqueta/ayuda de validación. MacroNumberInput conserva aparte su incremento numérico.

**Fuentes:** [MemoryInput (apps/mobile/screens/SettingsScreen.tsx:1559)](../../../apps/mobile/screens/SettingsScreen.tsx#L1559); [JSX: peso (apps/mobile/screens/MeasurementsScreen.tsx:624)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L624); [MacroNumberInput (apps/mobile/screens/SettingsScreen.tsx:1754)](../../../apps/mobile/screens/SettingsScreen.tsx#L1754).

### Buscador — Adaptar

CatalogSearch ya recibe valor, callback y placeholder y se reutiliza en alimentos y productos de Ajustes. Rutinas, ejercicios y Dieta tienen otros buscadores en JSX.

**Siguiente paso propuesto:** Promover CatalogSearch a pieza compartida con variantes de altura y fondo, acción de limpiar y props de foco/accesibilidad.

**Fuentes:** [CatalogSearch (apps/mobile/screens/SettingsScreen.tsx:2000)](../../../apps/mobile/screens/SettingsScreen.tsx#L2000); [JSX: búsqueda del catálogo (apps/mobile/catalogs/ExerciseCatalogBrowser.tsx:121)](../../../apps/mobile/catalogs/ExerciseCatalogBrowser.tsx#L121); [JSX: búsqueda de comida (apps/mobile/screens/DietScreen.tsx:303)](../../../apps/mobile/screens/DietScreen.tsx#L303).

### Opción seleccionable — Adaptar

OptionChips y ChoiceRow ya encapsulan grupos de opciones. Dibujan cada chip internamente y usan contratos distintos para selección múltiple y única.

**Siguiente paso propuesto:** Extraer su unidad visual común y conservar adaptadores separados para selección única y múltiple, filtros y motivos de denuncia.

**Fuentes:** [OptionChips (apps/mobile/screens/TrainingOverlays.tsx:231)](../../../apps/mobile/screens/TrainingOverlays.tsx#L231); [ChoiceRow (apps/mobile/screens/SettingsScreen.tsx:1741)](../../../apps/mobile/screens/SettingsScreen.tsx#L1741); [AiResponseReportModal (apps/mobile/AiResponseReportModal.tsx:91)](../../../apps/mobile/AiResponseReportModal.tsx#L91).

### Navegación por pestañas — Reutilizar

La navegación principal está centralizada en AppHeader y DesktopSidebar; las secciones de Ajustes en SettingsTabs. Ya se consumen desde la composición de App.

**Siguiente paso propuesto:** Conservar esos componentes y sus dos niveles de navegación; no crear una barra universal para sustituirlos solo por su parecido.

**Fuentes:** [AppHeader (apps/mobile/screens/AppShell.tsx:71)](../../../apps/mobile/screens/AppShell.tsx#L71); [DesktopSidebar (apps/mobile/screens/AppShell.tsx:16)](../../../apps/mobile/screens/AppShell.tsx#L16); [SettingsTabs (apps/mobile/screens/SettingsScreen.tsx:58)](../../../apps/mobile/screens/SettingsScreen.tsx#L58); [Uso de SettingsTabs (apps/mobile/App.tsx:8910)](../../../apps/mobile/App.tsx#L8910).

### Selector desplegable — Crear

Los selectores de métrica/periodo y de proveedor son Pressable con flecha y listas definidos en sus pantallas. No hay un disparador visual compartido.

**Siguiente paso propuesto:** Crear solo la presentación del valor y la flecha; mantener la apertura, las fechas, los proveedores y el orden de capas en sus propietarios.

**Fuentes:** [JSX: selector de métrica (apps/mobile/screens/MeasurementsScreen.tsx:336)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L336); [JSX: valor del selector de proveedor (apps/mobile/screens/SettingsScreen.tsx:2250)](../../../apps/mobile/screens/SettingsScreen.tsx#L2250).

### Fila de opción — Crear

Las opciones de métrica, tipo de serie y proveedor se construyen con map y Pressable en lugares distintos. No hay una fila seleccionable común.

**Siguiente paso propuesto:** Crear una fila controlada con etiqueta, icono opcional, seleccionado/desactivado y acción; sin asumir cómo se guarda el valor.

**Fuentes:** [JSX: opción de métrica (apps/mobile/screens/MeasurementsScreen.tsx:369)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L369); [JSX: opción de tipo de serie (apps/mobile/screens/TrainingOverlays.tsx:212)](../../../apps/mobile/screens/TrainingOverlays.tsx#L212); [JSX: opción de proveedor (apps/mobile/screens/SettingsScreen.tsx:2268)](../../../apps/mobile/screens/SettingsScreen.tsx#L2268).

### Tarjeta de métrica — Adaptar

Hay dos funciones locales llamadas StatCard: una en Inicio y otra en Medidas. Comparten contenedor y tipografía; difieren en icono de cabecera y subtítulo.

**Siguiente paso propuesto:** Unificar las dos bases con icono principal y auxiliar opcionales, valor, subtítulo y variación; no mover cálculos al componente.

**Fuentes:** [StatCard de Inicio (apps/mobile/screens/HomeScreen.tsx:41)](../../../apps/mobile/screens/HomeScreen.tsx#L41); [StatCard de Medidas (apps/mobile/screens/MeasurementsScreen.tsx:17)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L17).

### Panel de gráfica — Adaptar

ChartCard de Medidas y TrainingChartCard ya reciben título, selector, children y zIndex. Sus estructuras son prácticamente equivalentes.

**Siguiente paso propuesto:** Compartir el marco y los slots de cabecera/cuerpo. Mantener MeasurementsChartPlot y el gráfico de entrenamiento independientes.

**Fuentes:** [ChartCard (apps/mobile/screens/MeasurementsScreen.tsx:60)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L60); [TrainingChartCard (apps/mobile/screens/TrainingScreen.tsx:986)](../../../apps/mobile/screens/TrainingScreen.tsx#L986); [MeasurementsChartPlot (apps/mobile/screens/MeasurementsScreen.tsx:112)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L112).

### Barra de progreso — Crear

Las barras son pares de View con ancho porcentual dentro de la sesión y la minibarra. No se encontró un componente de barra separado.

**Siguiente paso propuesto:** Crear una pieza de presentación con progreso, alto, tono y accesibilidad; conservar reloj y sincronización de descanso en el dominio.

**Fuentes:** [JSX: avance global (apps/mobile/screens/TrainingScreen.tsx:2715)](../../../apps/mobile/screens/TrainingScreen.tsx#L2715); [JSX: descanso (apps/mobile/screens/TrainingScreen.tsx:3521)](../../../apps/mobile/screens/TrainingScreen.tsx#L3521); [JSX: minibarra (apps/mobile/screens/TrainingOverlays.tsx:60)](../../../apps/mobile/screens/TrainingOverlays.tsx#L60).

### Miniatura — Adaptar

FoodThumbnail y DietItemThumbnail se repiten en DietScreen y DietOverlays. SettingsFoodThumbnail resuelve otro fallback; las imágenes de ejercicios están inline.

**Siguiente paso propuesto:** Consolidar el soporte de imagen/tamaño/error y dejar wrappers por dominio para URI, emoji, punto o icono alternativo.

**Fuentes:** [FoodThumbnail de Dieta (apps/mobile/screens/DietScreen.tsx:196)](../../../apps/mobile/screens/DietScreen.tsx#L196); [FoodThumbnail de superposiciones (apps/mobile/screens/DietOverlays.tsx:163)](../../../apps/mobile/screens/DietOverlays.tsx#L163); [SettingsFoodThumbnail (apps/mobile/screens/SettingsScreen.tsx:2023)](../../../apps/mobile/screens/SettingsScreen.tsx#L2023); [DietItemThumbnail (apps/mobile/screens/DietScreen.tsx:188)](../../../apps/mobile/screens/DietScreen.tsx#L188).

### Fila con imagen y metadatos — Adaptar

FoodCatalogRow ya se reutiliza en alimentos y productos de Ajustes, pero depende de FoodCatalogSettingsModel y del resumen nutricional. Ejercicios y comidas dibujan sus propias filas.

**Siguiente paso propuesto:** Extraer de FoodCatalogRow una disposición con zonas de imagen, título, subtítulo y acción; mantener wrappers para ejercicio y alimento y la virtualización del catálogo.

**Fuentes:** [FoodCatalogRow (apps/mobile/screens/SettingsScreen.tsx:2010)](../../../apps/mobile/screens/SettingsScreen.tsx#L2010); [JSX: fila virtualizada de ejercicio (apps/mobile/catalogs/ExerciseCatalogBrowser.tsx:214)](../../../apps/mobile/catalogs/ExerciseCatalogBrowser.tsx#L214); [JSX: fila de alimento registrado (apps/mobile/screens/DietScreen.tsx:258)](../../../apps/mobile/screens/DietScreen.tsx#L258).

### Tarjeta de rutina — Crear

La tarjeta destacada vive dentro de HomeScreen y las tarjetas de lista en un map de TrainingListScreen. No hay una función WorkoutCard con variantes.

**Siguiente paso propuesto:** Crear una composición de identidad, metadatos y acción; distinguir destacada/lista y mantener menú y reordenación fuera de la base.

**Fuentes:** [JSX: rutina destacada (apps/mobile/screens/HomeScreen.tsx:122)](../../../apps/mobile/screens/HomeScreen.tsx#L122); [JSX: tarjetas de rutinas (apps/mobile/screens/TrainingScreen.tsx:2291)](../../../apps/mobile/screens/TrainingScreen.tsx#L2291).

### Tarjeta de registro — Adaptar

WorkoutHistoryEntryCard ya se comparte entre historial global y detalle de rutina. Las tarjetas de mediciones se generan aparte y no encajan en su contrato WorkoutSessionSummary.

**Siguiente paso propuesto:** Reutilizar la tarjeta actual para sesiones. Si compensa compartir el marco con medidas, extraer cabecera/resumen/acciones mediante composición sin convertir una medida en WorkoutSessionSummary.

**Fuentes:** [WorkoutHistoryEntryCard (apps/mobile/screens/TrainingScreen.tsx:53)](../../../apps/mobile/screens/TrainingScreen.tsx#L53); [JSX: registros de medidas (apps/mobile/screens/SettingsScreen.tsx:1797)](../../../apps/mobile/screens/SettingsScreen.tsx#L1797).

### Fila de etiqueta y valor — Crear

Preferencias y resumen de sesión alinean etiqueta/valor dentro de bucles locales; no hay un helper para la fila.

**Siguiente paso propuesto:** Crear una fila ligera con etiqueta, valor y estilo opcional; considerar si el pequeño ahorro justifica la extracción.

**Fuentes:** [JSX: preferencia (apps/mobile/screens/SettingsScreen.tsx:958)](../../../apps/mobile/screens/SettingsScreen.tsx#L958); [JSX: resumen de sesión (apps/mobile/screens/TrainingScreen.tsx:85)](../../../apps/mobile/screens/TrainingScreen.tsx#L85).

### Diálogo — Crear

Existen diálogos completos de contraseña, denuncia y confirmaciones, pero no un contenedor común. PortablePasswordModal usa Modal nativo/SafeAreaView; otras capas usan View absoluto.

**Siguiente paso propuesto:** Crear un marco visual opcional y adaptadores por host. Mantener gestión nativa/web, foco, teclado, Atrás, capas y confirmaciones en sus propietarios; no sustituir todos los hosts por uno.

**Fuentes:** [PortablePasswordModal (apps/mobile/backup/PortablePasswordModal.tsx:29)](../../../apps/mobile/backup/PortablePasswordModal.tsx#L29); [AiResponseReportModal (apps/mobile/AiResponseReportModal.tsx:91)](../../../apps/mobile/AiResponseReportModal.tsx#L91); [DietCopyConfirmation (apps/mobile/screens/DietOverlays.tsx:112)](../../../apps/mobile/screens/DietOverlays.tsx#L112).

### Aviso informativo — Adaptar

AiIdentityDisclosure, HealthSafetyNotice y CatalogStatusNotice ya son componentes compartidos. PolicyStatusCard y otros avisos aportan variantes locales; no hay un aviso genérico con todos los tonos.

**Siguiente paso propuesto:** Conservar wrappers semánticos y su texto/accesibilidad. Solo adaptar su soporte visual mediante un contenedor opcional si elimina repetición demostrada; no fundir sus contratos.

**Fuentes:** [AiIdentityDisclosure (apps/mobile/AiIdentityDisclosure.tsx:15)](../../../apps/mobile/AiIdentityDisclosure.tsx#L15); [HealthSafetyNotice (apps/mobile/HealthSafetyNotice.tsx:13)](../../../apps/mobile/HealthSafetyNotice.tsx#L13); [CatalogStatusNotice (apps/mobile/catalogs/CatalogStatusNotice.tsx:25)](../../../apps/mobile/catalogs/CatalogStatusNotice.tsx#L25); [PolicyStatusCard (apps/mobile/screens/SettingsScreen.tsx:504)](../../../apps/mobile/screens/SettingsScreen.tsx#L504).

### Burbuja de conversación — Crear

SharedChatPanel reutiliza una conversación completa, pero sus burbujas son JSX dentro de dos ramas. ChatScreen y PersonalFoodAssistantScreen también renderizan mensajes por su cuenta.

**Siguiente paso propuesto:** Extraer solo la burbuja de presentación con atribución, contenido y acciones opcionales. Mantener streaming, denuncias y mensajes sanitarios en wrappers específicos.

**Fuentes:** [JSX: mensajes del panel (apps/mobile/screens/SharedChatPanel.tsx:111)](../../../apps/mobile/screens/SharedChatPanel.tsx#L111); [JSX: mensajes de Coach (apps/mobile/screens/ChatScreen.tsx:47)](../../../apps/mobile/screens/ChatScreen.tsx#L47); [JSX: mensajes del asistente personal (apps/mobile/screens/PersonalFoodAssistantScreen.tsx:60)](../../../apps/mobile/screens/PersonalFoodAssistantScreen.tsx#L60).

### Entrada de conversación — Adaptar

SharedChatPanel ya contiene las variantes de campo/envío horizontal y vertical, con callbacks controlados. El compositor no está separado y Coach y el asistente personal mantienen versiones propias.

**Siguiente paso propuesto:** Separar esa subpieza del panel y admitir distribución, etiqueta/icono y estado de envío; conservar selección de proveedor, adjuntos y envío real fuera.

**Fuentes:** [Contrato del panel (apps/mobile/screens/SharedChatPanel.tsx:50)](../../../apps/mobile/screens/SharedChatPanel.tsx#L50); [JSX: compositor horizontal del panel (apps/mobile/screens/SharedChatPanel.tsx:369)](../../../apps/mobile/screens/SharedChatPanel.tsx#L369); [JSX: compositor de Coach (apps/mobile/screens/ChatScreen.tsx:140)](../../../apps/mobile/screens/ChatScreen.tsx#L140); [JSX: compositor del asistente personal (apps/mobile/screens/PersonalFoodAssistantScreen.tsx:82)](../../../apps/mobile/screens/PersonalFoodAssistantScreen.tsx#L82).

### Fila con interruptor — Adaptar

NotificationToggle ya tiene etiqueta, descripción, checked, disabled y onPress y se usa tres veces. El interruptor sanitario tiene otro layout y muestra estado textual.

**Siguiente paso propuesto:** Promover NotificationToggle con descripción opcional y variante de disposición; no incluir permisos ni consentimiento en el componente.

**Fuentes:** [NotificationToggle (apps/mobile/screens/SettingsScreen.tsx:987)](../../../apps/mobile/screens/SettingsScreen.tsx#L987); [Usos del interruptor (apps/mobile/screens/SettingsScreen.tsx:1182)](../../../apps/mobile/screens/SettingsScreen.tsx#L1182); [JSX: interruptor sanitario (apps/mobile/screens/SettingsScreen.tsx:2164)](../../../apps/mobile/screens/SettingsScreen.tsx#L2164).

### Grupo de valores nutricionales — Crear

FoodCatalogDetail ya es una ficha reutilizada en Ajustes, pero las celdas nutricionales son JSX de un map. DietHeader y la porción repiten otra presentación sin un grupo común.

**Siguiente paso propuesto:** Crear celdas/grupo para valores ya calculados, con variantes compacto/rejilla y unidad/base explícita; no extraer los cálculos de 100 g o ración desde la ficha.

**Fuentes:** [FoodCatalogDetail: ficha, no grupo genérico (apps/mobile/screens/SettingsScreen.tsx:2031)](../../../apps/mobile/screens/SettingsScreen.tsx#L2031); [DietHeader (apps/mobile/screens/DietScreen.tsx:15)](../../../apps/mobile/screens/DietScreen.tsx#L15); [JSX: valores de la porción (apps/mobile/screens/DietScreen.tsx:345)](../../../apps/mobile/screens/DietScreen.tsx#L345).

### Panel de formulario — Crear

MemorySettingsPanel, el registro de medidas y el formulario personal son componentes de flujo. El marco con título, campos y acciones sigue integrado en ellos; no existe un panel de formulario vacío.

**Siguiente paso propuesto:** Crear como mucho un contenedor con slots de cabecera, cuerpo y acciones. Mantener formularios y validación específicos; no crear un schema universal de formulario.

**Fuentes:** [MemorySettingsPanel (apps/mobile/screens/SettingsScreen.tsx:1488)](../../../apps/mobile/screens/SettingsScreen.tsx#L1488); [JSX: marco del alimento personal (apps/mobile/screens/SettingsScreen.tsx:219)](../../../apps/mobile/screens/SettingsScreen.tsx#L219); [JSX: registro de medidas (apps/mobile/screens/MeasurementsScreen.tsx:529)](../../../apps/mobile/screens/MeasurementsScreen.tsx#L529).

### Fila de serie de ejercicio — Crear

SwipeableSetRow existe, pero solo aporta gesto de borrado y children. Las columnas, inputs, subseries y estado de ejecución están embebidos en editor y sesión.

**Siguiente paso propuesto:** Crear una fila de presentación del dominio Entreno por composición, preservando el wrapper de gesto y las diferencias plantilla/sesión. Validar series avanzadas antes de compartir columnas.

**Fuentes:** [SwipeableSetRow: solo gesto (apps/mobile/screens/TrainingScreen.tsx:2016)](../../../apps/mobile/screens/TrainingScreen.tsx#L2016); [JSX: fila del editor (apps/mobile/screens/TrainingScreen.tsx:1514)](../../../apps/mobile/screens/TrainingScreen.tsx#L1514); [JSX: tipo de serie en sesión (apps/mobile/screens/TrainingScreen.tsx:3007)](../../../apps/mobile/screens/TrainingScreen.tsx#L3007).

### Sección con cabecera — Crear

DietMealsScreen renderiza cada comida en un map y TrainingSessionScreen compone los ejercicios inline. No hay un contenedor compartido de sección/cabecera.

**Siguiente paso propuesto:** Crear solo el marco y slots de título, resumen, acciones y contenido; expansión opcional y controlada por el propietario.

**Fuentes:** [JSX: sección de comida (apps/mobile/screens/DietScreen.tsx:230)](../../../apps/mobile/screens/DietScreen.tsx#L230); [JSX: secciones de ejercicios (apps/mobile/screens/TrainingScreen.tsx:2594)](../../../apps/mobile/screens/TrainingScreen.tsx#L2594).

### Estado vacío — Crear

Los vacíos de rutinas y medidas son ramas JSX con icono/texto/acción. No existe una pieza EmptyState separada.

**Siguiente paso propuesto:** Crear una presentación con icono, título, descripción y acción opcionales, conservando los textos y decisiones de cada flujo.

**Fuentes:** [JSX: vacío de rutinas (apps/mobile/screens/TrainingScreen.tsx:2250)](../../../apps/mobile/screens/TrainingScreen.tsx#L2250); [JSX: vacío de medidas (apps/mobile/screens/SettingsScreen.tsx:1794)](../../../apps/mobile/screens/SettingsScreen.tsx#L1794).

### Menú contextual — Crear

La revisión confirma dos menús separados: diet-item-menu y training-template-menu. Ambos son View flotante y acciones Pressable, sin componente compartido.

**Siguiente paso propuesto:** Crear base y filas de acciones si se confirma el encaje. Aunque solo se fotografió el menú de Dieta, el código ya demuestra otro uso en Rutinas; falta comparar visualmente esa variante.

**Fuentes:** [JSX: menú del alimento (apps/mobile/screens/DietScreen.tsx:278)](../../../apps/mobile/screens/DietScreen.tsx#L278); [JSX: menú de rutina (apps/mobile/screens/TrainingScreen.tsx:2465)](../../../apps/mobile/screens/TrainingScreen.tsx#L2465).

### Insignia de metadatos — Crear

Categoría, estado de historial y músculos usan View/Text inline. No se encontró una insignia informativa común, y los chips existentes son interactivos.

**Siguiente paso propuesto:** Crear una insignia pasiva con texto/icono y tono; mantenerla separada de las opciones seleccionables.

**Fuentes:** [JSX: categoría destacada (apps/mobile/screens/HomeScreen.tsx:184)](../../../apps/mobile/screens/HomeScreen.tsx#L184); [JSX: estado del historial (apps/mobile/screens/TrainingScreen.tsx:63)](../../../apps/mobile/screens/TrainingScreen.tsx#L63); [JSX: músculos (apps/mobile/screens/CatalogOverlays.tsx:47)](../../../apps/mobile/screens/CatalogOverlays.tsx#L47).

### Pie informativo — Reutilizar

LegalFooter ya centraliza enlace de privacidad, descargo generado y fallback para abrir/copiar la URL. App lo pasa a Ajustes como legalFooter.

**Siguiente paso propuesto:** Reutilizarlo tal cual. No crear otro pie ni mover sus textos legales a componentes nuevos.

**Fuentes:** [LegalFooter (apps/mobile/LegalFooter.tsx:19)](../../../apps/mobile/LegalFooter.tsx#L19); [Uso único compartido por Ajustes (apps/mobile/App.tsx:9026)](../../../apps/mobile/App.tsx#L9026).

## Orden sugerido para una fase posterior

1. Unidades pequeñas y duplicación más directa: botones, campos, buscadores, chips, métricas, marco de gráficas, miniaturas, interruptores y barras de progreso.
2. Composiciones con contratos que acordar: filas, tarjetas de rutina, selectores, opciones, mensajes, compositor, nutrición, estados vacíos, menús y metadatos.
3. Evaluar el beneficio antes de extraer: marcos de registros, formularios y secciones, filas etiqueta/valor y filas de series. Mantener navegación, pie legal y avisos semánticos existentes.

Este orden describe la recomendación original; la fase posterior autorizada abarca solo las 12 familias adaptables. Las adaptaciones de avisos, formularios y diálogos deben preservar reglas sanitarias, permisos, validación, cifrado y comportamiento nativo/web en sus propietarios. SwipeableSetRow es un contenedor de gesto, no una fila de serie completa; SharedChatPanel incluye conversación y entrada, no un compositor aislado.

El menú contextual conserva un único ejemplo fotográfico. El código demuestra una segunda implementación en Rutinas; todavía conviene capturar esa variante para comparar su presentación antes de unificarlos.

## Comprobaciones de esta revisión

- Las 29 decisiones tienen referencias con fichero, símbolo o región JSX, línea y ancla comprobadas por el generador.
- Los 54 originales y las 208 zonas de evidencia visual permanecen intactos.
- La revisión original no cambió apps/mobile. La implementación posterior tiene su propio alcance y validación en implementation.md.
- Esta revisión no ejecuta una migración ni demuestra todavía equivalencia visual o funcional de una futura extracción.

Documento generado desde inventory.json por scripts/design-component-audit/generate.mjs.
