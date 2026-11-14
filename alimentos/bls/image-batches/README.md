# Imágenes BLS por tandas

Imágenes editoriales independientes de los datos y de la app, generadas mediante
una llamada integrada de Codex por alimento. Se mantiene el estilo aprobado de
las muestras CIQUAL como referencia visual; no se reutilizan sus fotografías.
Las ilustraciones son de Gymnasia, no proporcionadas ni validadas por Max
Rubner-Institut. No prueban receta, porción de 100 g, ingredientes exactos,
alérgenos ni propiedades nutricionales. Fuente de los nombres: Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0.

## Estado

**100/7.140 imágenes registradas; 7.040 pendientes; 1,40 %.** Tanda inicial
`0001`: 100 panes y panecillos, generados el 11 de noviembre de 2026 y revisados
visualmente por Codex. La PR queda abierta; `pending-review` no equivale a
aprobación del mantenedor. No hay integración móvil.

[Manifiesto con prompts exactos, referencias, huellas y hashes](0001/manifest.json).
Cada variante tiene su propia imagen; los nombres DE/EN se conservan literales.

## Verificación y continuación

`npm run check:bls:images` verifica las tandas y calcula el inventario real.
`npm run next:bls:images -- 100` lista los siguientes pendientes sin generar ni
publicar. Leer el [relevo](../../../docs/bls-food-images-handoff.md) para preparar
la siguiente tanda o recuperar una interrupción. No modificar fichas oficiales,
agregados, erratas, traducciones ni código móvil al añadir imágenes.

## Revisión de la tanda 0001

Todos los WebP finales se revisaron en nueve hojas de contacto; abrir los casos
dudosos a tamaño completo. Estas hojas son vistas de QA; las imágenes finales
individuales carecen de texto, etiquetas, utensilios y decoración añadida.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0001-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0001-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0001-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0001-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0001-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0001-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0001-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0001-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0001-09.jpg)

## Alimentos de la tanda 0001

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-B101000](0001/bls-B101000.webp) | Vollkornbrot | Wholemeal bread |
| [bls-B106000](0001/bls-B106000.webp) | Vollkornbrot mit Ölsamen | Wholemeal bread with oilseeds |
| [bls-B106500](0001/bls-B106500.webp) | Vollkornbrot mit Sonnenblumenkernen | Wholemeal bread with sunflower seeds |
| [bls-B106700](0001/bls-B106700.webp) | Vollkornbrot mit Kürbiskernen | Wholemeal bread with pumpkin seeds |
| [bls-B106800](0001/bls-B106800.webp) | Vollkornbrot mit Nüssen | Wholemeal bread with nuts |
| [bls-B107300](0001/bls-B107300.webp) | Vollkornbrot mit Buttermilch | Wholemeal bread with buttermilk |
| [bls-B107900](0001/bls-B107900.webp) | Vollkornbrot mit Quark | Wholemeal bread with quark |
| [bls-B111000](0001/bls-B111000.webp) | Weizenvollkornbrot | Wholemeal wheat bread |
| [bls-B111200](0001/bls-B111200.webp) | Weizenvollkorntoastbrot | Wholemeal wheat toast |
| [bls-B111272](0001/bls-B111272.webp) | Weizenvollkorntoastbrot getoastet | Wholemeal wheat toast toasted |
| [bls-B111300](0001/bls-B111300.webp) | Weizenvollkornbrot mit Kürbiskernen | Wholemeal wheat bread with pumpkin seeds |
| [bls-B111400](0001/bls-B111400.webp) | Weizenvollkornbrot mit Nüssen | Wholemeal wheat bread with nuts |
| [bls-B111500](0001/bls-B111500.webp) | Weizenvollkornbrot mit Ölsamen | Wholemeal wheat bread with oilseeds |
| [bls-B111600](0001/bls-B111600.webp) | Weizenvollkornbrot mit Sonnenblumenkernen | Wholemeal wheat bread with sunflower seeds |
| [bls-B111700](0001/bls-B111700.webp) | Weizenvollkornbrot mit Buttermilch | Wholemeal wheat bread with buttermilk |
| [bls-B111800](0001/bls-B111800.webp) | Weizenvollkornbrot mit Quark | Wholemeal wheat bread with quark |
| [bls-B121000](0001/bls-B121000.webp) | Roggenvollkornbrot | Wholemeal rye bread |
| [bls-B121100](0001/bls-B121100.webp) | Roggenvollkornbrot mit Kürbiskernen | Wholemeal rye bread with pumpkin seeds |
| [bls-B121200](0001/bls-B121200.webp) | Roggenvollkornbrot mit Nüssen | Wholemeal rye bread with nuts |
| [bls-B121300](0001/bls-B121300.webp) | Roggenvollkornbrot mit Ölsamen | Wholemeal rye bread with oilseeds |
| [bls-B121400](0001/bls-B121400.webp) | Roggenvollkornbrot mit Sonnenblumenkernen | Wholemeal rye bread with sunflower seeds |
| [bls-B121500](0001/bls-B121500.webp) | Roggenvollkornbrot mit Buttermilch | Wholemeal rye bread with buttermilk |
| [bls-B121600](0001/bls-B121600.webp) | Roggenvollkornbrot mit Quark | Wholemeal rye bread with quark |
| [bls-B122000](0001/bls-B122000.webp) | Roggenvollkornschrotbrot | Coarse wholemeal rye bread |
| [bls-B131000](0001/bls-B131000.webp) | Hafervollkornbrot | Wholemeal oat bread |
| [bls-B221000](0001/bls-B221000.webp) | Roggenbrot | Rye bread |
| [bls-B226000](0001/bls-B226000.webp) | Roggenbrot mit Ölsamen | Rye bread with oilseeds |
| [bls-B226500](0001/bls-B226500.webp) | Roggenbrot mit Sonnenblumenkernen | Rye bread with sunflower seeds |
| [bls-B226700](0001/bls-B226700.webp) | Roggenbrot mit Kürbiskernen | Rye bread with pumpkin seeds |
| [bls-B226800](0001/bls-B226800.webp) | Roggenbrot mit Nüssen | Rye bread with nuts |
| [bls-B227300](0001/bls-B227300.webp) | Roggenbrot mit Buttermilch | Rye bread with buttermilk |
| [bls-B227700](0001/bls-B227700.webp) | Roggenbrot mit Quark | Rye bread with quark |
| [bls-B231000](0001/bls-B231000.webp) | Haferbrot | Oat bread |
| [bls-B251000](0001/bls-B251000.webp) | Weizenmischbrot | Wheat-rye bread (> 50 % and < 90 % wheat) |
| [bls-B254000](0001/bls-B254000.webp) | Weizenmischtoastbrot | Mixed wheat toast |
| [bls-B254072](0001/bls-B254072.webp) | Weizenmischtoastbrot getoastet | Mixed wheat toast toasted |
| [bls-B255500](0001/bls-B255500.webp) | Weizenmischbrot mit Zwiebeln | Wheat-rye bread (> 50 % and < 90 % wheat) with onions |
| [bls-B255700](0001/bls-B255700.webp) | Weizenmischbrot mit Kümmel | Wheat-rye bread (> 50 % and < 90 % wheat) with caraway seeds |
| [bls-B256000](0001/bls-B256000.webp) | Weizenmischbrot mit Ölsamen | Wheat-rye bread (> 50 % and < 90 % wheat) with oilseeds |
| [bls-B256500](0001/bls-B256500.webp) | Weizenmischbrot mit Sonnenblumenkernen | Wheat-rye bread (> 50 % and < 90 % wheat) with sunflower seeds |
| [bls-B256700](0001/bls-B256700.webp) | Weizenmischbrot mit Nüssen | Wheat-rye bread (> 50 % and < 90 % wheat) with nuts |
| [bls-B257300](0001/bls-B257300.webp) | Weizenmischbrot mit Buttermilch | Wheat-rye bread (> 50 % and < 90 % wheat) with buttermilk |
| [bls-B257700](0001/bls-B257700.webp) | Weizenmischbrot mit Quark | Wheat-rye bread (> 50 % and < 90 % wheat) with quark |
| [bls-B259000](0001/bls-B259000.webp) | Weizenmischbrot mit Kürbiskernen | Wheat-rye bread (> 50 % and < 90 % wheat) with pumpkin seeds |
| [bls-B271000](0001/bls-B271000.webp) | Roggenmischbrot | Rye-wheat bread (> 50 % and < 90 % rye) |
| [bls-B275500](0001/bls-B275500.webp) | Roggenmischbrot mit Zwiebeln | Rye-wheat bread (> 50 % and < 90 % rye) with onions |
| [bls-B275700](0001/bls-B275700.webp) | Roggenmischbrot mit Kümmel | Rye-wheat bread (> 50 % and < 90 % rye) with caraway seeds |
| [bls-B276000](0001/bls-B276000.webp) | Roggenmischbrot mit Ölsamen | Rye-wheat bread (> 50 % and < 90 % rye) with oilseeds |
| [bls-B276500](0001/bls-B276500.webp) | Roggenmischbrot mit Sonnenblumenkernen | Rye-wheat bread (> 50 % and < 90 % rye) with sunflower seeds |
| [bls-B276700](0001/bls-B276700.webp) | Roggenmischbrot mit Kürbiskernen | Rye-wheat bread (> 50 % and < 90 % rye) with pumpkin seeds |
| [bls-B276800](0001/bls-B276800.webp) | Roggenmischbrot mit Nüssen | Rye-wheat bread (> 50 % and < 90 % rye) with nuts |
| [bls-B277300](0001/bls-B277300.webp) | Roggenmischbrot mit Buttermilch | Rye-wheat bread (> 50 % and < 90 % rye) with buttermilk |
| [bls-B277700](0001/bls-B277700.webp) | Roggenmischbrot mit Quark | Rye-wheat bread (> 50 % and < 90 % rye) with quark |
| [bls-B291000](0001/bls-B291000.webp) | Mehrkornbrot mit Ölsamen | Multigrain bread |
| [bls-B309000](0001/bls-B309000.webp) | Weißbrot glutenfrei | White bread gluten-free |
| [bls-B311000](0001/bls-B311000.webp) | Weizenbrot/Weißbrot | White bread/wheat bread |
| [bls-B314000](0001/bls-B314000.webp) | Weizentoastbrot/Buttertoastbrot | Wheat toast/butter toast |
| [bls-B314072](0001/bls-B314072.webp) | Weizentoastbrot/Buttertoastbrot, getoastet | Wheat toast/butter toast, toasted |
| [bls-B314100](0001/bls-B314100.webp) | Weizentoastbrot mit Roggen | Wheat toast with rye |
| [bls-B314172](0001/bls-B314172.webp) | Weizentoastbrot mit Roggen, getoastet | Wheat toast with rye, toasted |
| [bls-B314200](0001/bls-B314200.webp) | Mehrkorntoastbrot mit Ölsamen | Multigrain toast |
| [bls-B314272](0001/bls-B314272.webp) | Mehrkorntoastbrot mit Ölsamen, getoastet | Multigrain toast toasted |
| [bls-B401000](0001/bls-B401000.webp) | Vollkornbrötchen | Wholemeal roll |
| [bls-B406000](0001/bls-B406000.webp) | Vollkornbrötchen mit Ölsamen | Wholemeal roll with oilseeds |
| [bls-B406500](0001/bls-B406500.webp) | Vollkornbrötchen mit Sonnenblumenkernen | Wholemeal roll with sunflower seeds |
| [bls-B406700](0001/bls-B406700.webp) | Vollkornbrötchen mit Kürbiskernen | Wholemeal roll with pumpkin seeds |
| [bls-B406800](0001/bls-B406800.webp) | Vollkornbrötchen mit Nüssen | Wholemeal roll with nuts |
| [bls-B411000](0001/bls-B411000.webp) | Weizenvollkornbrötchen | Wholemeal wheat roll |
| [bls-B416000](0001/bls-B416000.webp) | Weizenvollkornbrötchen mit Ölsamen | Wholemeal wheat roll with oilseeds |
| [bls-B416500](0001/bls-B416500.webp) | Weizenvollkornbrötchen mit Sonnenblumenkernen | Wholemeal wheat roll with sunflower seeds |
| [bls-B416700](0001/bls-B416700.webp) | Weizenvollkornbrötchen mit Kürbiskernen | Wholemeal wheat roll with pumpkin seeds |
| [bls-B416800](0001/bls-B416800.webp) | Weizenvollkornbrötchen mit Nüssen | Wholemeal wheat roll with nuts |
| [bls-B421000](0001/bls-B421000.webp) | Roggenvollkornbrötchen | Wholemeal rye roll |
| [bls-B426000](0001/bls-B426000.webp) | Roggenvollkornbrötchen mit Ölsamen | Wholemeal rye roll with oilseeds |
| [bls-B426500](0001/bls-B426500.webp) | Roggenvollkornbrötchen mit Sonnenblumenkernen | Wholemeal rye roll with sunflower seeds |
| [bls-B426700](0001/bls-B426700.webp) | Roggenvollkornbrötchen mit Kürbiskernen | Wholemeal rye roll with pumpkin seeds |
| [bls-B426800](0001/bls-B426800.webp) | Roggenvollkornbrötchen mit Nüssen | Wholemeal rye roll with nuts |
| [bls-B491000](0001/bls-B491000.webp) | Dinkelvollkornbrötchen | Wholemeal spelt roll |
| [bls-B491100](0001/bls-B491100.webp) | Dinkelvollkornbrötchen mit Kürbiskernen | Wholemeal spelt roll with pumpkin seeds |
| [bls-B491200](0001/bls-B491200.webp) | Dinkelvollkornbrötchen mit Nüssen | Wholemeal spelt roll with nuts |
| [bls-B491300](0001/bls-B491300.webp) | Dinkelvollkornbrötchen mit Ölsamen | Wholemeal spelt roll with oilseeds |
| [bls-B491400](0001/bls-B491400.webp) | Dinkelvollkornbrötchen mit Sonnenblumenkernen | Wholemeal spelt roll with sunflower seeds |
| [bls-B511000](0001/bls-B511000.webp) | Weizenbrötchen | Wheat roll |
| [bls-B511100](0001/bls-B511100.webp) | Weizenbrötchen mit Kümmel und Salz | Wheat roll with caraway seeds and salt |
| [bls-B511200](0001/bls-B511200.webp) | Weizenbrötchen mit Schinkenspeck | Wheat roll with bacon |
| [bls-B515500](0001/bls-B515500.webp) | Weizenbrötchen mit Zwiebeln | Wheat roll with onions |
| [bls-B516000](0001/bls-B516000.webp) | Weizenbrötchen mit Ölsamen | Wheat roll with oilseeds |
| [bls-B516300](0001/bls-B516300.webp) | Weizenbrötchen mit Sesam | Wheat roll with sesame seeds |
| [bls-B516400](0001/bls-B516400.webp) | Weizenbrötchen mit Mohn | Wheat roll with poppy seeds |
| [bls-B516500](0001/bls-B516500.webp) | Weizenbrötchen mit Sonnenblumenkernen | Wheat roll with sunflower seeds |
| [bls-B516700](0001/bls-B516700.webp) | Weizenbrötchen mit Kürbiskernen | Wheat roll with pumpkin seeds |
| [bls-B517700](0001/bls-B517700.webp) | Weizenbrötchen mit Quark | Wheat roll with quark |
| [bls-B521000](0001/bls-B521000.webp) | Roggenbrötchen | Rye roll |
| [bls-B521100](0001/bls-B521100.webp) | Roggenbrötchen mit Kümmel und Salz | Rye roll with caraway seeds and salt |
| [bls-B521200](0001/bls-B521200.webp) | Roggenbrötchen mit Schinkenspeck | Rye roll with bacon |
| [bls-B526000](0001/bls-B526000.webp) | Roggenbrötchen mit Ölsamen | Rye roll with oilseeds |
| [bls-B526300](0001/bls-B526300.webp) | Roggenbrötchen mit Sesam | Rye roll with sesame seeds |
| [bls-B526400](0001/bls-B526400.webp) | Roggenbrötchen mit Mohn | Rye roll with poppy seeds |
| [bls-B526500](0001/bls-B526500.webp) | Roggenbrötchen mit Sonnenblumenkernen | Rye roll with sunflower seeds |
| [bls-B526700](0001/bls-B526700.webp) | Roggenbrötchen mit Kürbiskernen | Rye roll with pumpkin seeds |
