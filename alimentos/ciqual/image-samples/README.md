# Muestras de imágenes CIQUAL

Tres muestras **pendientes de revisión del mantenedor**, generadas con la
herramienta de imágenes integrada de Codex. No se han incorporado a la app ni
se ha iniciado la generación del resto de los 3.484 alimentos.

| Alimento | Imagen | Referencia de estilo |
| --- | --- | --- |
| Arroz blanco, crudo | [ciqual-9100.webp](ciqual-9100.webp) | `alimentos/images/arroz-blanco.webp` (cocido: solo estilo) |
| Manzana Golden, pulpa y piel, cruda | [ciqual-13620.webp](ciqual-13620.webp) | `alimentos/images/manzana.webp` (roja: solo estilo) |
| Lenteja verde, hervida/cocida en agua | [ciqual-20587.webp](ciqual-20587.webp) | `alimentos/images/lentejas.webp` |

La revisión debe confirmar el alimento y su preparación, el parecido con el
estilo existente y la legibilidad como miniatura: fotografía realista, sujeto
centrado, fondo carbón oscuro, luz cálida suave, margen alrededor y ausencia de
texto, marcas, manos y utensilios. Las imágenes son ilustrativas: la cantidad
visible **no representa 100 g ni una ración recomendada**. No son imágenes
proporcionadas o validadas por ANSES.

`manifest.json` registra los prompts exactos enviados, las referencias, nombres
de origen y hashes. Cada huella de origen usa el mismo algoritmo que las
traducciones CIQUAL (`ciqualNameFingerprint`); cambiar el nombre original exige
revisar la correspondencia de la imagen. Los WebP son opacos, de 1024 × 1024,
normalizados desde las salidas del generador sin sustituir imágenes anteriores.

```bash
npm run check:ciqual:images
npm run test:catalogs
```

Estos comandos solo validan: no generan imágenes, no acceden a proveedores ni
necesitan claves. Detectan nombres o hashes desactualizados, IDs duplicados,
rutas inválidas, archivos sin registrar, formatos falsos, tamaños incorrectos
y archivos dañados.

Para continuar tras la revisión: acordar primero las correcciones o la aceptación
del estilo. La incorporación al catálogo móvil y la generación completa son
pasos posteriores; este directorio no los activa. Mantener siempre separada la
procedencia editorial de las ilustraciones y la fuente nutricional oficial.
