# Imágenes BLS por tandas

Imágenes editoriales independientes de los datos y de la app, generadas mediante
una llamada integrada de Codex por alimento. Se mantiene el estilo aprobado de
las muestras CIQUAL como referencia visual; no se reutilizan sus fotografías.
Las ilustraciones son de Gymnasia, no proporcionadas ni validadas por Max
Rubner-Institut. No prueban receta, porción de 100 g, ingredientes exactos,
alérgenos ni propiedades nutricionales. Fuente de los nombres: Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0.

## Estado

**500/7.140 imágenes registradas; 6.640 pendientes; 7,00 %.**

Las tandas `0001`, `0002`, `0003`, `0004` y `0005` contienen 100 imágenes cada una,
generadas con Codex integrado y revisadas visualmente. Consultar GitHub para el
estado de sus PRs; `pending-review` no equivale a aprobación del mantenedor.
No hay integración móvil.

- [Tanda 0001: manifiesto y prompts](0001/manifest.json).
- [Tanda 0002: manifiesto y prompts](0002/manifest.json).
- [Tanda 0003: manifiesto y prompts](0003/manifest.json).
- [Tanda 0004: manifiesto y prompts](0004/manifest.json).
- [Tanda 0005: manifiesto y prompts](0005/manifest.json).

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

## Tanda 0002: panes, crujientes y cereales

100 imágenes nuevas: panecillos, panes crujientes y extruidos, pretzels, panes
especiales, baguettes, tortillas, pan rallado y cereales en los estados crudo y
cocinado indicados por BLS. Las variedades sin gluten o lactosa, enriquecidas
y de proteína se ilustran sin símbolos ni afirmaciones visuales de esas propiedades.
Las nueve hojas revisan todos los WebP finales:

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0002-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0002-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0002-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0002-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0002-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0002-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0002-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0002-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0002-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-B531000](0002/bls-B531000.webp) | Haferbrötchen | Oat roll |
| [bls-B551000](0002/bls-B551000.webp) | Weizenmischbrötchen | Wheat-rye roll (> 50 % and < 90 % wheat) |
| [bls-B551100](0002/bls-B551100.webp) | Weizenmischbrötchen mit Kürbiskernen | Wheat-rye roll (> 50 % and < 90 % wheat) with pumpkin seeds |
| [bls-B551200](0002/bls-B551200.webp) | Weizenmischbrötchen mit Mohn | Wheat-rye roll (> 50 % and < 90 % wheat) with poppy seeds |
| [bls-B551300](0002/bls-B551300.webp) | Weizenmischbrötchen mit Ölsamen | Wheat-rye roll (> 50 % and < 90 % wheat) with oilseeds |
| [bls-B551400](0002/bls-B551400.webp) | Weizenmischbrötchen mit Sesam | Wheat-rye roll (> 50 % and < 90 % wheat) with sesame seeds |
| [bls-B551500](0002/bls-B551500.webp) | Weizenmischbrötchen mit Sonnenblumenkernen | Wheat-rye roll (> 50 % and < 90 % wheat) with sunflower seeds |
| [bls-B551600](0002/bls-B551600.webp) | Weizenmischbrötchen mit Kümmel und Salz | Wheat-rye roll (> 50 % and < 90 % wheat) with caraway seeds and salt |
| [bls-B551700](0002/bls-B551700.webp) | Weizenmischbrötchen mit Schinkenspeck | Wheat-rye roll (> 50 % and < 90 % wheat) with bacon |
| [bls-B551800](0002/bls-B551800.webp) | Weizenmischbrötchen mit Zwiebeln | Wheat-rye roll (> 50 % and < 90 % wheat) with onions |
| [bls-B561000](0002/bls-B561000.webp) | Dinkelbrötchen | Spelt roll |
| [bls-B561100](0002/bls-B561100.webp) | Dinkelbrötchen mit Kürbiskernen | Spelt roll with pumpkin seeds |
| [bls-B561200](0002/bls-B561200.webp) | Dinkelbrötchen mit Nüssen | Spelt roll with nuts |
| [bls-B561300](0002/bls-B561300.webp) | Dinkelbrötchen mit Ölsamen | Spelt roll with oilseeds |
| [bls-B561400](0002/bls-B561400.webp) | Dinkelbrötchen mit Sonnenblumenkernen | Spelt roll with sunflower seeds |
| [bls-B591000](0002/bls-B591000.webp) | Mehrkornbrötchen | Multigrain roll |
| [bls-B629000](0002/bls-B629000.webp) | Knusperbrot glutenfrei | Crackerbread gluten-free |
| [bls-B6A1000](0002/bls-B6A1000.webp) | Weizenknäckebrot mit Sesam | Wheat crispbread with sesame seeds |
| [bls-B6A1100](0002/bls-B6A1100.webp) | Weizenvollkornknäckebrot mit Käse, Ölsamen und Tomaten | Wholemeal wheat crispbread with cheese, oilseeds and tomatoes |
| [bls-B6A1200](0002/bls-B6A1200.webp) | Weizenvollkornknäckebrot mit Müslizutaten, gesüßt | Wholemeal wheat crispbread with muesli ingredients, sweetened |
| [bls-B6A1300](0002/bls-B6A1300.webp) | Weizenvollkornknäckebrot mit Ölsamen | Wholemeal wheat crispbread with oilseeds |
| [bls-B6A1400](0002/bls-B6A1400.webp) | Weizenvollkornknäckebrot mit Ölsamen und Hartkäse | Wholemeal wheat crispbread with oilseeds and hard cheese |
| [bls-B6A1500](0002/bls-B6A1500.webp) | Weizenvollkornknäckebrot mit Ölsamen, Hartkäse und Möhre | Wholemeal wheat crispbread with oilseeds, hard cheese and carrots |
| [bls-B6A1600](0002/bls-B6A1600.webp) | Weizenvollkornknäckebrot mit Ölsamen, Hartkäse und Zwiebeln | Wholemeal wheat crispbread with oilseeds, hard cheese and onions |
| [bls-B6A2000](0002/bls-B6A2000.webp) | Roggenknäckebrot | Rye crispbread |
| [bls-B6A2100](0002/bls-B6A2100.webp) | Roggenvollkornknäckebrot | Wholemeal rye crispbread |
| [bls-B6A2200](0002/bls-B6A2200.webp) | Roggenvollkornknäckebrot mit Buttermilch | Wholemeal rye crispbread with buttermilk |
| [bls-B6A2300](0002/bls-B6A2300.webp) | Roggenvollkornknäckebrot mit Milch | Wholemeal rye crispbread with milk |
| [bls-B6A2400](0002/bls-B6A2400.webp) | Roggenvollkornknäckebrot mit Dinkel | Wholemeal rye crispbread with spelt |
| [bls-B6A2500](0002/bls-B6A2500.webp) | Roggenvollkornknäckebrot mit Gerstenmalz | Wholemeal rye crispbread with barley malt |
| [bls-B6A2600](0002/bls-B6A2600.webp) | Roggenvollkornknäckebrot mit Kleie und Ölsamen | Wholemeal rye crispbread with wheat bran and oilseeds |
| [bls-B6A2700](0002/bls-B6A2700.webp) | Roggenvollkornknäckebrot mit Kümmel | Wholemeal rye crispbread with caraway seeds |
| [bls-B6A2800](0002/bls-B6A2800.webp) | Roggenvollkornknäckebrot mit Kürbiskernen | Wholemeal rye crispbread with pumpkin seeds |
| [bls-B6A2900](0002/bls-B6A2900.webp) | Roggenvollkornknäckebrot mit Leinsamen und Weizenkeimen | Wholemeal rye crispbread with linseed and wheat germ |
| [bls-B6A3000](0002/bls-B6A3000.webp) | Roggenvollkornknäckebrot mit Ölsamen | Wholemeal rye crispbread with oilseeds |
| [bls-B6A3100](0002/bls-B6A3100.webp) | Roggenvollkornknäckebrot mit Sesam | Wholemeal rye crispbread with sesame seeds |
| [bls-B6A3200](0002/bls-B6A3200.webp) | Roggenvollkornknäckebrot mit Sonnenblumenkernen | Wholemeal rye crispbread with sunflower seeds |
| [bls-B6A4000](0002/bls-B6A4000.webp) | Mehrkornvollkornknäckebrot | Multigrain wholemeal crispbread |
| [bls-B6A4100](0002/bls-B6A4100.webp) | Mehrkornvollkornknäckebrot mit Ölsamen | Multigrain wholemeal crispbread with oilseeds |
| [bls-B6A5000](0002/bls-B6A5000.webp) | Dinkelvollkornknäckebrot mit Müslizutaten, gesüßt | Wholemeal spelt criscpread with muesli ingredients, sweetened |
| [bls-B6A5100](0002/bls-B6A5100.webp) | Dinkelvollkornknäckebrot mit Ölsamen | Wholemeal spelt criscpread with oilseeds |
| [bls-B6A5200](0002/bls-B6A5200.webp) | Dinkelvollkornknäckebrot mit Ölsamen und Hartkäse | Wholemeal spelt criscpread with oilseeds and hard cheese |
| [bls-B6A6000](0002/bls-B6A6000.webp) | Knäckebrot glutenfrei, laktosefrei | Crispbread gluten-free, lactose-free |
| [bls-B710500](0002/bls-B710500.webp) | Dinkelbrot | Spelt bread |
| [bls-B710600](0002/bls-B710600.webp) | Dinkelbrot mit Kürbiskernen | Spelt bread with pumpkin seeds |
| [bls-B710700](0002/bls-B710700.webp) | Dinkelbrot mit Nüssen | Spelt bread with nuts |
| [bls-B710800](0002/bls-B710800.webp) | Dinkelbrot mit Ölsamen | Spelt bread with oilseeds |
| [bls-B710900](0002/bls-B710900.webp) | Dinkelbrot mit Sonnenblumenkernen | Spelt bread with sunflower seeds |
| [bls-B717000](0002/bls-B717000.webp) | Hirsebrot glutenfrei | Millet bread gluten-free |
| [bls-B718000](0002/bls-B718000.webp) | Kastanienbrot glutenfrei | Chestnut bread gluten-free |
| [bls-B719000](0002/bls-B719000.webp) | Rosinenbrot glutenfrei | Raisin bread gluten-free |
| [bls-B723000](0002/bls-B723000.webp) | Laugengebäck mit Hagelsalz | Pretzel salted |
| [bls-B723100](0002/bls-B723100.webp) | Laugengebäck (Hagelsalz entfernt) | Pretzel (visible salt removed) |
| [bls-B723200](0002/bls-B723200.webp) | Laugengebäck mit Kürbiskernen | Lye pastry (pretzels) with pumpkin seeds |
| [bls-B723300](0002/bls-B723300.webp) | Laugengebäck mit Sesam | Lye pastry (pretzels) with sesame seeds |
| [bls-B723400](0002/bls-B723400.webp) | Laugengebäck mit Sonnenblumenkernen | Lye pastry (pretzels) with sunflower seeds |
| [bls-B723500](0002/bls-B723500.webp) | Laugengebäck mit Käse | Lye pastry (pretzels) with cheese |
| [bls-B723600](0002/bls-B723600.webp) | Laugengebäck mit Käse und Schinkenspeck | Lye pastry (pretzels) with cheese and bacon |
| [bls-B780500](0002/bls-B780500.webp) | Pumpernickel | Pumpernickel |
| [bls-B781200](0002/bls-B781200.webp) | Weizenbaguette | Wheat baguette |
| [bls-B781300](0002/bls-B781300.webp) | Weizenbaguettebrötchen | Wheat baguette roll |
| [bls-B781400](0002/bls-B781400.webp) | Weizenbaguette mit Nüssen | Wheat baguette with nuts |
| [bls-B781500](0002/bls-B781500.webp) | Weizenvollkornbaguette | Wholemeal wheat baguette |
| [bls-B781600](0002/bls-B781600.webp) | Dinkelvollkornbaguette | Wholemeal spelt baguette |
| [bls-B782100](0002/bls-B782100.webp) | Weizenfladenbrot | Wheat flatbread |
| [bls-B783012](0002/bls-B783012.webp) | Weizentortilla | Wheat flour tortilla |
| [bls-B821000](0002/bls-B821000.webp) | Paniermehl/Semmelbrösel/Semmelmehl | Bread crumbs |
| [bls-B822000](0002/bls-B822000.webp) | Paniermehl glutenfrei | Bread crumbs gluten-free |
| [bls-B881100](0002/bls-B881100.webp) | Eiweißbrot/Proteinbrot | Protein bread |
| [bls-B881200](0002/bls-B881200.webp) | Eiweißbrötchen/Proteinbrötchen | Protein roll |
| [bls-B8A1000](0002/bls-B8A1000.webp) | Baguette glutenfrei | Baguette gluten-free |
| [bls-B8A2000](0002/bls-B8A2000.webp) | Brötchen glutenfrei | Roll gluten-free |
| [bls-B8A3000](0002/bls-B8A3000.webp) | Buchweizenbrot glutenfrei | Buckwheat bread gluten-free |
| [bls-B8A4000](0002/bls-B8A4000.webp) | Sauerteigbrot glutenfrei | Sourdough bread gluten-free |
| [bls-B8A5000](0002/bls-B8A5000.webp) | Sauerteigbrot mit Kürbiskernen, glutenfrei | Sourdough bread with pumpkin seeds, gluten-free |
| [bls-B8A6000](0002/bls-B8A6000.webp) | Sauerteigbrot mit Ölsamen, glutenfrei | Sourdough bread with oilseeds, gluten-free |
| [bls-B8A7000](0002/bls-B8A7000.webp) | Sauerteigbrot mit Sonnenblumenkernen, glutenfrei | Sourdough bread with sunflower seeds, gluten-free |
| [bls-B8A8000](0002/bls-B8A8000.webp) | Toastbrot glutenfrei | Toast gluten-free |
| [bls-B8A8072](0002/bls-B8A8072.webp) | Toastbrot glutenfrei, getoastet | Toast gluten-free, toasted |
| [bls-B8A9000](0002/bls-B8A9000.webp) | Vollkornbrot glutenfrei | Wholemeal bread gluten-free |
| [bls-B8B1000](0002/bls-B8B1000.webp) | Mehrkornknusperbrot angereichert mit Vitaminen und Spurenelementen | Multigrain crackerbread, fortified with vitamins and trace elements |
| [bls-B8B2000](0002/bls-B8B2000.webp) | Roggenknusperbrot | Rye crackerbread |
| [bls-B8B3000](0002/bls-B8B3000.webp) | Vollkornknusperbrot | Wholemeal crackerbread |
| [bls-B8B4000](0002/bls-B8B4000.webp) | Weizenknusperbrot | Wheat crackerbread |
| [bls-B8B5000](0002/bls-B8B5000.webp) | Weizenknusperbrot (mit Butter) | Wheat crackerbread (made with butter) |
| [bls-B8B6000](0002/bls-B8B6000.webp) | Dinkelknusperbrot | Spelt crackerbread |
| [bls-C111000](0002/bls-C111000.webp) | Weizen ganzes Korn, roh | Wheat whole grain, raw |
| [bls-C111032](0002/bls-C111032.webp) | Weizen ganzes Korn, gekocht | Wheat whole grain, boiled |
| [bls-C111062](0002/bls-C111062.webp) | Weizen ganzes Korn, gekocht, gebacken | Wheat whole grain, boiled, baked |
| [bls-C111082](0002/bls-C111082.webp) | Weizen ganzes Korn, gekocht, gebraten ohne Fett (Pfanne) | Wheat whole grain, boiled, fried without fat (pan) |
| [bls-C113000](0002/bls-C113000.webp) | Weizen Flocken | Wheat flakes |
| [bls-C113032](0002/bls-C113032.webp) | Weizen Flocken, gekocht | Wheat flakes, boiled |
| [bls-C114000](0002/bls-C114000.webp) | Weizen Keim | Wheat germ |
| [bls-C117000](0002/bls-C117000.webp) | Weizen Grütze | Wheat groats |
| [bls-C117032](0002/bls-C117032.webp) | Weizen Grütze, gekocht | Wheat groats, boiled |
| [bls-C118000](0002/bls-C118000.webp) | Quinoa weiß, roh | Quinoa white, raw |
| [bls-C118032](0002/bls-C118032.webp) | Quinoa weiß, gekocht | Quinoa white, boiled |
| [bls-C118100](0002/bls-C118100.webp) | Quinoa tricolore, roh | Quinoa tricolore, raw |
| [bls-C118122](0002/bls-C118122.webp) | Quinoa tricolore, gekocht | Quinoa tricolore, boiled |
| [bls-C119100](0002/bls-C119100.webp) | Bulgur (Hartweizen) roh | Bulgur (durum wheat) raw |

## Tanda 0003: cereales y productos de molienda

100 imágenes nuevas de cereales crudos y cocidos, copos, harinas, almidón,
salvado, sémolas y grano partido. Una imagen independiente por código, incluso
cuando la diferencia entre tipos de harina no se aprecia en una miniatura.
Sin textos que simulen grados de molienda ni ingredientes añadidos.

Se contrastó el sentido de los términos de molienda con el
[Bayerischer Müllerbund](https://www.muellerbund.de/muellereiprodukte/mehle-aus-weizen-roggen-dinkel/)
y la identificación de Grünkern con el
[BZfE](https://www.bzfe.de/presse/pressemeldungen-archiv/getreide-abc-dinkel).
Son apoyos para la interpretación editorial, no fuentes de imágenes. En
`bls-C341000`, el grano seco es una inferencia de la propia ficha BLS
(11,192 g de agua y 336 kcal por 100 g), conservada sin modificar.

Las nueve hojas muestran todos los WebP finales revisados:

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0003-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0003-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0003-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0003-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0003-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0003-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0003-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0003-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0003-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-C119132](0003/bls-C119132.webp) | Bulgur (Hartweizen) gekocht | Bulgur (durum wheat) boiled |
| [bls-C119200](0003/bls-C119200.webp) | Couscous (Hartweizen) roh | Couscous (durum wheat) raw |
| [bls-C119232](0003/bls-C119232.webp) | Couscous (Hartweizen) gekocht | Couscous (durum wheat) boiled |
| [bls-C121000](0003/bls-C121000.webp) | Roggen ganzes Korn, roh | Rye whole grain, raw |
| [bls-C121032](0003/bls-C121032.webp) | Roggen ganzes Korn, gekocht | Rye whole grain, boiled |
| [bls-C123000](0003/bls-C123000.webp) | Roggen Flocken | Rye flakes |
| [bls-C123032](0003/bls-C123032.webp) | Roggen Flocken, gekocht | Rye flakes, boiled |
| [bls-C126000](0003/bls-C126000.webp) | Roggen Grieß | Rye semolina |
| [bls-C130032](0003/bls-C130032.webp) | Hafer ganzes Korn, gekocht | Oat whole grain, boiled |
| [bls-C131000](0003/bls-C131000.webp) | Hafer ganzes Korn, roh | Oat whole grain, raw |
| [bls-C133000](0003/bls-C133000.webp) | Hafer Flocken | Oat flakes |
| [bls-C133032](0003/bls-C133032.webp) | Hafer Flocken, gekocht | Oat flakes, boiled |
| [bls-C136000](0003/bls-C136000.webp) | Hafer Grieß | Oat semolina |
| [bls-C137000](0003/bls-C137000.webp) | Hafer Grütze | Oat groats |
| [bls-C137032](0003/bls-C137032.webp) | Hafer Grütze, gekocht | Oat groats, boiled |
| [bls-C138000](0003/bls-C138000.webp) | Hafer Kleie | Oat bran flakes |
| [bls-C141000](0003/bls-C141000.webp) | Gerste ganzes Korn, roh | Barley whole grain, raw |
| [bls-C141032](0003/bls-C141032.webp) | Gerste ganzes Korn, gekocht | Barley whole grain, boiled |
| [bls-C143000](0003/bls-C143000.webp) | Gerste Flocken | Barley flakes |
| [bls-C143032](0003/bls-C143032.webp) | Gerste Flocken, gekocht | Barley flakes, boiled |
| [bls-C146000](0003/bls-C146000.webp) | Gerste Grieß | Barley semolina |
| [bls-C147000](0003/bls-C147000.webp) | Gerste Grütze | Barley groats |
| [bls-C147032](0003/bls-C147032.webp) | Gerste Grütze, gekocht | Barley groats, boiled |
| [bls-C148000](0003/bls-C148000.webp) | Gerste Graupen | Pearl barley |
| [bls-C148032](0003/bls-C148032.webp) | Gerste Graupen, gekocht | Pearl barley, boiled |
| [bls-C211000](0003/bls-C211000.webp) | Weizen Vollkornmehl | Wheat wholemeal flour |
| [bls-C211100](0003/bls-C211100.webp) | Weizen Vollkornschrot | Wheat coarse meal |
| [bls-C211132](0003/bls-C211132.webp) | Weizen Vollkornschrot, gekocht | Wheat coarse meal, boiled |
| [bls-C212000](0003/bls-C212000.webp) | Weizen Backschrot, Type 1700 | Wheat coarse meal, Type 1700 |
| [bls-C212032](0003/bls-C212032.webp) | Weizen Backschrot, Type 1700, gekocht | Wheat coarse meal, Type 1700, boiled |
| [bls-C213100](0003/bls-C213100.webp) | Weizen Mehl, Type 812 | Wheat flour, Type 812 |
| [bls-C213200](0003/bls-C213200.webp) | Weizen Mehl, Type 1050 | Wheat flour, Type 1050 |
| [bls-C213500](0003/bls-C213500.webp) | Weizen Mehl, Type 1600 | Wheat flour, Type 1600 |
| [bls-C214100](0003/bls-C214100.webp) | Weizen Mehl, Type 405 | Wheat flour, Type 405 |
| [bls-C214200](0003/bls-C214200.webp) | Weizen Mehl, Type 550 | Wheat flour, Type 550 |
| [bls-C215000](0003/bls-C215000.webp) | Weizen Dunst | Wheat middlings (dunst) |
| [bls-C216000](0003/bls-C216000.webp) | Weizen Stärke | Wheat starch |
| [bls-C217000](0003/bls-C217000.webp) | Weizen Kleie | Wheat bran |
| [bls-C218000](0003/bls-C218000.webp) | Weichweizen Grieß | Soft wheat semolina |
| [bls-C218032](0003/bls-C218032.webp) | Weichweizen Grieß, gekocht | Soft wheat semolina, boiled |
| [bls-C219000](0003/bls-C219000.webp) | Hartweizen Vollkornmehl | Durum wheat wholemeal flour |
| [bls-C219100](0003/bls-C219100.webp) | Hartweizen Vollkorngrieß | Durum wheat wholemeal semolina |
| [bls-C219132](0003/bls-C219132.webp) | Hartweizen Vollkorngrieß, gekocht | Durum wheat wholemeal semolina, boiled |
| [bls-C219200](0003/bls-C219200.webp) | Hartweizen ganzes Korn, roh | Durum wheat whole grain, raw |
| [bls-C219232](0003/bls-C219232.webp) | Hartweizen ganzes Korn, gekocht | Durum wheat whole grain, boiled |
| [bls-C219300](0003/bls-C219300.webp) | Hartweizen Grieß | Durum wheat semolina |
| [bls-C219332](0003/bls-C219332.webp) | Hartweizen Grieß, gekocht | Durum wheat semolina, boiled |
| [bls-C221000](0003/bls-C221000.webp) | Roggen Vollkornmehl | Rye wholemeal flour |
| [bls-C221100](0003/bls-C221100.webp) | Roggen Vollkornschrot | Rye coarse meal |
| [bls-C221132](0003/bls-C221132.webp) | Roggen Vollkornschrot, gekocht | Rye coarse meal, boiled |
| [bls-C222000](0003/bls-C222000.webp) | Roggen Backschrot, Type 1800 | Rye coarse meal, Type 1800 |
| [bls-C222032](0003/bls-C222032.webp) | Roggen Backschrot, Type 1800, gekocht | Rye coarse meal, Type 1800, boiled |
| [bls-C223100](0003/bls-C223100.webp) | Roggen Mehl, Type 815 | Rye flour, Type 815 |
| [bls-C223200](0003/bls-C223200.webp) | Roggen Mehl, Type 997 | Rye flour, Type 997 |
| [bls-C223300](0003/bls-C223300.webp) | Roggen Mehl, Type 1150 | Rye flour, Type 1150 |
| [bls-C223400](0003/bls-C223400.webp) | Roggen Mehl, Type 1370 | Rye flour, Type 1370 |
| [bls-C223600](0003/bls-C223600.webp) | Roggen Mehl, Type 1740 | Rye flour, Type 1740 |
| [bls-C232000](0003/bls-C232000.webp) | Hafer Schrot | Oat coarse meal |
| [bls-C232032](0003/bls-C232032.webp) | Hafer Schrot, gekocht | Oat coarse meal, boiled |
| [bls-C233000](0003/bls-C233000.webp) | Hafer Mehl | Oat flour |
| [bls-C234000](0003/bls-C234000.webp) | Dinkel Mehl, Type 630 | Spelt flour, Type 630 |
| [bls-C234100](0003/bls-C234100.webp) | Dinkel Mehl, Type 812 | Spelt flour, Type 812 |
| [bls-C234200](0003/bls-C234200.webp) | Dinkel Mehl, Type 1050 | Spelt flour, Type 1050 |
| [bls-C235000](0003/bls-C235000.webp) | Dinkel Vollkornmehl | Spelt wholemeal flour |
| [bls-C235100](0003/bls-C235100.webp) | Dinkel Vollkornschrot | Spelt coarse meal |
| [bls-C235132](0003/bls-C235132.webp) | Dinkel Vollkornschrot, gekocht | Spelt coarse meal, boiled |
| [bls-C236000](0003/bls-C236000.webp) | Dinkel ganzes Korn, roh | Spelt whole grain, raw |
| [bls-C236032](0003/bls-C236032.webp) | Dinkel ganzes Korn, gekocht | Spelt whole grain, boiled |
| [bls-C236100](0003/bls-C236100.webp) | Dinkel Flocken | Spelt flakes |
| [bls-C237000](0003/bls-C237000.webp) | Dinkel Kleie | Spelt bran |
| [bls-C238000](0003/bls-C238000.webp) | Dinkel Grieß | Spelt semolina |
| [bls-C238032](0003/bls-C238032.webp) | Dinkel Grieß, gekocht | Spelt semolina, boiled |
| [bls-C240000](0003/bls-C240000.webp) | Emmer Vollkornmehl | Emmer wheat wholemeal flour |
| [bls-C240100](0003/bls-C240100.webp) | Emmer ganzes Korn, roh | Emmer wheat whole grain, raw |
| [bls-C240132](0003/bls-C240132.webp) | Emmer ganzes Korn, gekocht | Emmer wheat whole grain, boiled |
| [bls-C240200](0003/bls-C240200.webp) | Emmer Flocken | Emmer wheat flakes |
| [bls-C241000](0003/bls-C241000.webp) | Einkorn Vollkornmehl | Einkorn wheat wholemeal flour |
| [bls-C241100](0003/bls-C241100.webp) | Einkorn ganzes Korn, roh | Einkorn wheat whole grain, raw |
| [bls-C241132](0003/bls-C241132.webp) | Einkorn ganzes Korn, gekocht | Einkorn wheat whole grain, boiled |
| [bls-C241200](0003/bls-C241200.webp) | Einkorn Flocken | Einkorn wheat flakes |
| [bls-C242000](0003/bls-C242000.webp) | Gerste Schrot | Barley coarse meal |
| [bls-C242032](0003/bls-C242032.webp) | Gerste Schrot, gekocht | Barley coarse meal, boiled |
| [bls-C243000](0003/bls-C243000.webp) | Gerste Mehl | Barley flour |
| [bls-C311000](0003/bls-C311000.webp) | Grünkern ganzes Korn, roh | Green spelt whole grain, raw |
| [bls-C311032](0003/bls-C311032.webp) | Grünkern ganzes Korn, gekocht | Green spelt whole grain, boiled |
| [bls-C317000](0003/bls-C317000.webp) | Grünkern Grütze | Green spelt groats |
| [bls-C317032](0003/bls-C317032.webp) | Grünkern Grütze, gekocht | Green spelt groats, boiled |
| [bls-C320032](0003/bls-C320032.webp) | Buchweizen gekocht | Buckwheat boiled |
| [bls-C322000](0003/bls-C322000.webp) | Buchweizen roh | Buckwheat raw |
| [bls-C326000](0003/bls-C326000.webp) | Buchweizen Grieß | Buckwheat semolina |
| [bls-C326032](0003/bls-C326032.webp) | Buchweizen Grieß, gekocht | Buckwheat semolina, boiled |
| [bls-C327000](0003/bls-C327000.webp) | Buchweizen Grütze | Buckwheat groats |
| [bls-C327032](0003/bls-C327032.webp) | Buchweizen Grütze, gekocht | Buckwheat groats, boiled |
| [bls-C332000](0003/bls-C332000.webp) | Hirse roh | Millet raw |
| [bls-C333100](0003/bls-C333100.webp) | Hirse Flocken | Millet wholegrain flakes |
| [bls-C333132](0003/bls-C333132.webp) | Hirse Flocken, gekocht | Millet wholegrain flakes, boiled |
| [bls-C334032](0003/bls-C334032.webp) | Hirse gekocht | Millet boiled |
| [bls-C335000](0003/bls-C335000.webp) | Amaranth roh | Amaranth raw |
| [bls-C335032](0003/bls-C335032.webp) | Amaranth gekocht | Amaranth boiled |
| [bls-C341000](0003/bls-C341000.webp) | Mais roh | Maize raw |

## Tanda 0004: arroz, harinas y cereales de desayuno

100 imágenes nuevas de maíz, arroz, productos de molienda, muesli, cornflakes,
polenta, cereales inflados, chocolate con arroz y tortitas de arroz y maíz.
Cada código tiene su propia imagen y conserva ambos nombres oficiales completos.
Las diferencias invisibles de fortificación, gluten, sal o grado de molienda
no se representan con etiquetas ni símbolos.

Los mueslis se muestran como mezcla seca, sin leche ni yogur. La fruta seca,
los frutos secos, el chocolate, el glaseado y los rellenos solo aparecen cuando
corresponden al nombre. Para las categorías con varios sabores o rellenos se
usó una representación genérica de la categoría, sin afirmar una receta exacta.
Las tortitas son discos de cereal inflado; las variantes de polenta respetan
el estado cocido, horneado o dorado en sartén sin grasa adicional.

Se regeneraron dos imágenes durante la revisión: `bls-C413000` para representar
la harina fina de Grünkern, y `bls-C512000` para eliminar fruta seca de una mezcla
que la excluye expresamente. El manifiesto conserva los motivos, la resolución,
el prompt anterior y el SHA-256 del PNG anterior en `review.corrections`; cada
entrada de `images` contiene el prompt y el hash de la imagen final revisada.

Las nueve hojas muestran todos los WebP finales revisados:

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0004-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0004-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0004-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0004-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0004-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0004-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0004-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0004-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0004-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-C341032](0004/bls-C341032.webp) | Mais gekocht | Maize boiled |
| [bls-C341162](0004/bls-C341162.webp) | Mais gekocht, gebacken | Maize boiled, baked |
| [bls-C346000](0004/bls-C346000.webp) | Mais Grieß | Maize semolina |
| [bls-C346032](0004/bls-C346032.webp) | Mais Grieß, gekocht | Maize semolina, boiled |
| [bls-C347000](0004/bls-C347000.webp) | Mais Grütze | Maize grits |
| [bls-C347032](0004/bls-C347032.webp) | Mais Grütze, gekocht | Maize grits, boiled |
| [bls-C350042](0004/bls-C350042.webp) | Reis poliert, geschmort ohne Fett | White rice braised without fat |
| [bls-C350222](0004/bls-C350222.webp) | Reis poliert, gedämpft | White rice steamed |
| [bls-C351000](0004/bls-C351000.webp) | Reis unpoliert, roh | Brown rice raw |
| [bls-C351032](0004/bls-C351032.webp) | Reis unpoliert, gekocht | Brown rice boiled |
| [bls-C351082](0004/bls-C351082.webp) | Reis unpoliert, gekocht, gebraten ohne Fett (Pfanne) | Brown rice boiled, fried without fat (pan) |
| [bls-C352000](0004/bls-C352000.webp) | Reis poliert, roh | White rice raw |
| [bls-C352032](0004/bls-C352032.webp) | Reis poliert, gekocht | White rice boiled |
| [bls-C352082](0004/bls-C352082.webp) | Reis poliert, gekocht, gebraten ohne Fett (Pfanne) | White rice boiled, fried without fat (pan) |
| [bls-C353100](0004/bls-C353100.webp) | Wildreis roh | Wild rice raw |
| [bls-C353132](0004/bls-C353132.webp) | Wildreis gekocht | Wild rice boiled |
| [bls-C353182](0004/bls-C353182.webp) | Wildreis gekocht, gebraten ohne Fett (Pfanne) | Wild rice boiled, fried without fat (pan) |
| [bls-C354100](0004/bls-C354100.webp) | Reismischung mit Wildreis, roh | Rice mix with wild rice, raw |
| [bls-C354132](0004/bls-C354132.webp) | Reismischung mit Wildreis, gekocht | Rice mix with wild rice, boiled |
| [bls-C356000](0004/bls-C356000.webp) | Reis Grieß | Rice semolina |
| [bls-C356032](0004/bls-C356032.webp) | Reis Grieß, gekocht | Rice grits, boiled |
| [bls-C359000](0004/bls-C359000.webp) | Reis parboiled, poliert, roh | Rice parboiled, raw |
| [bls-C359032](0004/bls-C359032.webp) | Reis parboiled, poliert, gekocht | Rice parboiled, boiled |
| [bls-C359042](0004/bls-C359042.webp) | Reis parboiled, poliert, geschmort ohne Fett | Rice parboiled, braised without fat |
| [bls-C359082](0004/bls-C359082.webp) | Reis parboiled, poliert, gekocht, gebraten ohne Fett (Pfanne) | Rice parboiled, boiled, fried without fat (pan) |
| [bls-C412000](0004/bls-C412000.webp) | Grünkern Vollkornschrot | Green spelt coarse meal |
| [bls-C412032](0004/bls-C412032.webp) | Grünkern Vollkornschrot, gekocht | Green spelt coarse meal, boiled |
| [bls-C412182](0004/bls-C412182.webp) | Grünkern Vollkornschrot gekocht, gebraten ohne Fett (Pfanne) | Green spelt coarse meal, boiled, fried without fat (pan) |
| [bls-C413000](0004/bls-C413000.webp) | Grünkern Vollkornmehl | Green spelt flour |
| [bls-C414000](0004/bls-C414000.webp) | Mehlmischung eiweißarm, glutenfrei, natriumarm | Flour mix low protein, gluten-free, low sodium |
| [bls-C414100](0004/bls-C414100.webp) | Mehlmischung glutenfrei | Flour mix gluten-free |
| [bls-C415000](0004/bls-C415000.webp) | Mehlmischung für Brot glutenfrei | Flour mix for bread gluten-free |
| [bls-C416000](0004/bls-C416000.webp) | Mehlmischung für Kuchen glutenfrei | Flour mix for cake gluten-free |
| [bls-C421000](0004/bls-C421000.webp) | Buchweizen Vollkornmehl | Buckwheat wholemeal flour |
| [bls-C422000](0004/bls-C422000.webp) | Buchweizen Schrot | Buckwheat coarse meal |
| [bls-C422032](0004/bls-C422032.webp) | Buchweizen Schrot, gekocht | Buckwheat coarse meal, boiled |
| [bls-C424000](0004/bls-C424000.webp) | Buchweizen Mehl | Buckwheat flour |
| [bls-C432000](0004/bls-C432000.webp) | Hirse Schrot | Millet coarse meal |
| [bls-C432032](0004/bls-C432032.webp) | Hirse Schrot, gekocht | Millet coarse meal, boiled |
| [bls-C433000](0004/bls-C433000.webp) | Hirse Mehl | Millet flour |
| [bls-C433100](0004/bls-C433100.webp) | Braunhirse Mehl | Brown millet flour |
| [bls-C443000](0004/bls-C443000.webp) | Mais Mehl | Maize flour |
| [bls-C446000](0004/bls-C446000.webp) | Mais Stärke | Maize starch |
| [bls-C453000](0004/bls-C453000.webp) | Reis Mehl | Rice flour |
| [bls-C456000](0004/bls-C456000.webp) | Reis Stärke | Rice starch |
| [bls-C457000](0004/bls-C457000.webp) | Reis Kleie | Rice bran |
| [bls-C492000](0004/bls-C492000.webp) | Mehrkornschrot | Grain mix coarse meal |
| [bls-C492032](0004/bls-C492032.webp) | Mehrkornschrot gekocht | Grain mix coarse meal, boiled |
| [bls-C492062](0004/bls-C492062.webp) | Mehrkornschrot gekocht, gebacken | Grain mix coarse meal, boiled, baked |
| [bls-C492082](0004/bls-C492082.webp) | Mehrkornschrot gekocht, gebraten ohne Fett (Pfanne) | Grain mix coarse meal, boiled, fried without fat (pan) |
| [bls-C512000](0004/bls-C512000.webp) | Müsli Basismischung (ohne Trockenfrüchte) ungesüßt | Muesli basic mix (without dried fruit) unsweetened |
| [bls-C512300](0004/bls-C512300.webp) | Müslimischung mit Trockenfrüchten, ungesüßt | Muesli mix with dried fruit, unsweetened |
| [bls-C512600](0004/bls-C512600.webp) | Müslimischung Bircher Art (mit Trockenfrüchten und Nüssen) ungesüßt | Muesli mix Bircher style (with dried fruit and nuts) unsweetened |
| [bls-C512700](0004/bls-C512700.webp) | Müslimischung mit Trockenfrüchten, glutenfrei, gesüßt | Muesli mix with dried fruit, gluten-free, sweetened |
| [bls-C512800](0004/bls-C512800.webp) | Müslimischung mit Schokolade, glutenfrei, gesüßt | Muesli mix with chocolate, gluten-free, sweetenend |
| [bls-C513300](0004/bls-C513300.webp) | Müslimischung mit Schokolade, gesüßt | Muesli mix with chocolate, sweetened |
| [bls-C514200](0004/bls-C514200.webp) | Knuspermüslimischung, klassisch, gesüßt | Crunchy muesli mix, classic, sweetened |
| [bls-C514300](0004/bls-C514300.webp) | Knuspermüslimischung, klassisch, gesüßt, angereichert mit Vitaminen und Mineralstoffen | Crunchy muesli mix, classic, sweetened, fortified with vitamins and minerals |
| [bls-C514400](0004/bls-C514400.webp) | Knuspermüslimischung mit Trockenfrüchten, gesüßt | Crunchy muesli mix with dried fruit, sweetened |
| [bls-C514500](0004/bls-C514500.webp) | Knuspermüslimischung mit Trockenfrüchten, gesüßt, angereichert mit Vitaminen und Mineralstoffen | Crunchy muesli mix with dried fruit, sweetened, fortified with vitamins and minerals |
| [bls-C514600](0004/bls-C514600.webp) | Knuspermüslimischung mit Schokolade, gesüßt | Crunchy muesli mix with chocolate, sweetened |
| [bls-C514700](0004/bls-C514700.webp) | Knuspermüslimischung mit Schokolade, gesüßt, angereichert mit Vitaminen und Mineralstoffen | Crunchy muesli mix with chocolate, sweetened, fortified with vitamins and minerals |
| [bls-C515000](0004/bls-C515000.webp) | Cornflakes gesüßt | Cornflakes sweetened |
| [bls-C515100](0004/bls-C515100.webp) | Cornflakes gesüßt, angereichert mit Vitaminen | Cornflakes sweetened, fortified with vitamins |
| [bls-C515200](0004/bls-C515200.webp) | Cornflakes gesüßt, mit Zuckerglasur und Erdnüssen, angereichert mit Vitaminen und Mineralstoffen | Cornflakes sweetened, sugar frosted, with peanuts, fortified with vitamins and minerals |
| [bls-C515300](0004/bls-C515300.webp) | Cornflakes gesüßt, mit Zuckerglasur und Erdnüssen | Cornflakes sweetened, sugar frosted, with peanuts |
| [bls-C515400](0004/bls-C515400.webp) | Cornflakes ungesüßt | Cornflakes unsweetened |
| [bls-C515600](0004/bls-C515600.webp) | Cornflakes gesüßt, mit Zuckerglasur | Cornflakes sweetened, sugar frosted |
| [bls-C518000](0004/bls-C518000.webp) | Popcorn gesalzen | Popcorn salty |
| [bls-C519000](0004/bls-C519000.webp) | Popcorn gesüßt | Popcorn sweet |
| [bls-C522000](0004/bls-C522000.webp) | Getreideflakes gesüßt | Cereal flakes sweetened |
| [bls-C522100](0004/bls-C522100.webp) | Getreideflakes gesüßt, angereichert mit Vitaminen und Mineralstoffen | Cereal flakes sweetened, fortified with vitamins and minerals |
| [bls-C522200](0004/bls-C522200.webp) | Getreideflakes gesüßt, mit Trockenfrüchten | Cereal flakes sweetened, with dried fruit |
| [bls-C522300](0004/bls-C522300.webp) | Getreideflakes gesüßt, mit Trockenfrüchten, angereichert mit Vitaminen und Mineralstoffen | Cereal flakes sweetened, with dried fruit, fortified with vitamins and minerals |
| [bls-C522400](0004/bls-C522400.webp) | Getreideflakes gesüßt, mit Nüssen | Cereal flakes sweetened, with nuts |
| [bls-C522500](0004/bls-C522500.webp) | Getreideflakes gesüßt, mit Nüssen, angereichert mit Vitaminen und Mineralstoffen | Cereal flakes sweetened, with nuts, fortified with vitamins and minerals |
| [bls-C522600](0004/bls-C522600.webp) | Getreideflakes gesüßt, mit Schokolade | Cereal flakes sweetened, with chocolate |
| [bls-C522700](0004/bls-C522700.webp) | Getreideflakes gesüßt, mit Schokolade, angereichert mit Vitaminen und Mineralstoffen | Cereal flakes sweetened, with chocolate, fortified with vitamins and minerals |
| [bls-C526000](0004/bls-C526000.webp) | Polenta (Maisgrieß mit Wasser, Fett und Salz) gekocht | Polenta (Maize semolina prepared with water, fat and salt) boiled |
| [bls-C526062](0004/bls-C526062.webp) | Polenta (Maisgrieß mit Wasser, Fett und Salz) gekocht, gebacken | Polenta (Maize semolina prepared with water, fat and salt) boiled, baked |
| [bls-C526082](0004/bls-C526082.webp) | Polenta (Maisgrieß mit Wasser, Fett und Salz) gekocht, gebraten ohne Fett (Pfanne) | Polenta (Maize semolina prepared with water, fat and salt) boiled, fried without fat (pan) |
| [bls-C530100](0004/bls-C530100.webp) | Amaranth gepufft, ungesüßt | Amaranth puffed, unsweetened |
| [bls-C530200](0004/bls-C530200.webp) | Quinoa gepufft, ungesüßt | Quinoa puffed, unsweetened |
| [bls-C531000](0004/bls-C531000.webp) | Weizen gepufft, ungesüßt | Wheat puffed, unsweetened |
| [bls-C532000](0004/bls-C532000.webp) | Reis gepufft, ungesüßt | Rice puffed, unsweetened |
| [bls-C532100](0004/bls-C532100.webp) | Vollmilchschokolade mit Puffreis und Crispies | Whole milk chocolate with puffed rice and crispies |
| [bls-C532200](0004/bls-C532200.webp) | Weiße Schokolade mit Puffreis und Crispies | White chocolate with puffed rice and crispies |
| [bls-C532700](0004/bls-C532700.webp) | Reiswaffeln ungesalzen | Puffed rice waffles unsalted |
| [bls-C532800](0004/bls-C532800.webp) | Reiswaffeln gesalzen | Puffed rice waffles salted |
| [bls-C532900](0004/bls-C532900.webp) | Reiswaffeln schokoliert | Puffed rice waffles chocolate coated |
| [bls-C533000](0004/bls-C533000.webp) | Popcorn ungesüßt | Popcorn unsweetened |
| [bls-C533100](0004/bls-C533100.webp) | Maiswaffeln gesalzen | Puffed maize waffles salted |
| [bls-C534100](0004/bls-C534100.webp) | Cerealien extrudiert, gesüßt, ungefüllt, mit Zimtgeschmack | Extruded cereals sweetened, unfilled, cinnamon flavoured |
| [bls-C534200](0004/bls-C534200.webp) | Cerealien extrudiert, gesüßt, ungefüllt, mit Zimtgeschmack, angereichert mit Vitaminen und Mineralstoffen | Extruded cereals sweetened, unfilled, cinnamon flavoured, fortified with vitamins and minerals |
| [bls-C534300](0004/bls-C534300.webp) | Cerealien extrudiert, gesüßt, ungefüllt, mit Frucht-/Honig-/Karamell-/Schokogeschmack | Extruded cereals sweetened, unfilled, fruit/honey/caramel/chocolate flavoured |
| [bls-C534400](0004/bls-C534400.webp) | Cerealien extrudiert, gesüßt, ungefüllt, mit Frucht-/Honig-/Karamell-/Schokogeschmack, angereichert mit Vitaminen und Mineralstoffen | Extruded cereals sweetened, unfilled, fruit/honey/caramel/chocolate flavoured, fortified with vitamins and minerals |
| [bls-C534500](0004/bls-C534500.webp) | Cerealien extrudiert, gesüßt, divers gefüllt | Extruded cereals sweetened, variously filled |
| [bls-C534600](0004/bls-C534600.webp) | Cerealien extrudiert, gesüßt, divers gefüllt, angereichert mit Vitaminen und Mineralstoffen | Extruded cereals sweetened, variously filled, fortified with vitamins and minerals |
| [bls-C537000](0004/bls-C537000.webp) | Weizenpops/Weizen gepufft, gesüßt | Wheat pops/wheat puffed, sweetened |
| [bls-C538000](0004/bls-C538000.webp) | Müslimischung mit Trockenfrüchten, gesüßt | Muesli mix with dried fruit, sweetened |

## Tanda 0005: bebidas vegetales, masas y repostería

100 imágenes nuevas de cereales y aperitivos, extracto de malta, gluten seco,
sustitutos de carne hidratados, fideos de arroz, bebidas vegetales, biscotes,
masas crudas y horneadas, bases de bizcocho y tartas. Una imagen independiente
por código, con nombres DE/EN literales y atribución de origen en el manifiesto.

Las bebidas se muestran en vaso sin envase ni marca. La fortificación y las
propiedades invisibles no se representan con símbolos. Las variantes aromatizadas
sin sabor especificado mantienen una apariencia neutra. El extracto de malta
se interpreta como jarabe por los 24,2 g de agua por 100 g de la ficha BLS; el
gluten y su mezcla seca se muestran como polvo (8,2 y 8 g de agua), y los
sustitutos hidratados como piezas. Estas inferencias visuales no cambian las fichas.

Las masas respetan su estado crudo u horneado. Las bases no llevan relleno ni
cobertura; los rollos de bizcocho sin rellenar muestran solo masa enrollada.
En los pasteles se distinguen la masa quebrada, la masa batida y la masa con
levadura, así como fruta, crumble, glaseado, crema y merengue cuando corresponden.
La tarta de queso y manzana sin base no tiene corteza de galleta ni masa.

Para interpretar nombres concretos se consultaron el
[Spiegeleikuchen de la cocina de Dr. Oetker](https://www.oetker.de/rezepte/r/spiegeleikuchen),
con albaricoque sobre crema; su
[Holländer-Kirsch-Torte](https://www.oetker.de/rezepte/r/hollaender-kirsch-torte),
con hojaldre, cereza y nata; y el material formativo de la asociación de panadería
sobre [masa de almendrado (Makronenmasse)](https://www.back-dir-deine-zukunft.de/fileadmin/Dokumente/AzubiCampus_Skripte_DE/Makronenmasse.pdf).
Son apoyos de interpretación editorial, no fuentes de imágenes ni recetas
atribuidas a BLS. La Makronentorte usa una representación genérica de masa de
almendra sobre masa quebrada, sin añadir frutas ni macarons franceses de colores.

Los 100 WebP finales se revisaron en nueve hojas; seis casos se abrieron también
a tamaño completo. No se necesitaron regeneraciones en esta tanda. Los prompts
y hashes finales se conservan en el manifiesto.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0005-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0005-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0005-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0005-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0005-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0005-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0005-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0005-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0005-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-C539100](0005/bls-C539100.webp) | Cerealien aus Vollkornweizenschrot, gesüßt, ungefüllt, Natur/Frucht/Schokolade | Wholemeal wheat cereals sweetened, unfilled, basic/fruit/chocolate |
| [bls-C539200](0005/bls-C539200.webp) | Cerealien aus Vollkornweizenschrot, gesüßt, ungefüllt, Natur/Frucht/Schokolade, angereichert mit Vitaminen und Mineralstoffen | Wholemeal wheat cereals sweetened, unfilled, basic/fruit/chocolate, fortified with vitamins and minerals |
| [bls-C546000](0005/bls-C546000.webp) | Tortillachips (Nachos) | Tortilla chips (Nachos) |
| [bls-C549000](0005/bls-C549000.webp) | Gerstenmalzextrakt | Barley malt extract |
| [bls-C551000](0005/bls-C551000.webp) | Weizenkleber/Weizengluten | Gluten (from wheat) |
| [bls-C552000](0005/bls-C552000.webp) | Mehrkornflocken | Multigrain flakes |
| [bls-C556000](0005/bls-C556000.webp) | Weizenglutenfertigmischung, Trockenprodukt | Wheat gluten mix, dried product |
| [bls-C557000](0005/bls-C557000.webp) | Fleischersatz gluten-, milch- und sojahaltig | Meat substitute containing gluten, milk and soya |
| [bls-C558000](0005/bls-C558000.webp) | Fleischersatz glutenhaltig (Seitan) | Meat substitute containing gluten (seitan) |
| [bls-C559000](0005/bls-C559000.webp) | Reisnudeln roh | Rice noodles raw |
| [bls-C559032](0005/bls-C559032.webp) | Reisnudeln gekocht | Rice noodles boiled |
| [bls-C650000](0005/bls-C650000.webp) | Reisdrink ungesüßt | Rice drink unsweetened |
| [bls-C650200](0005/bls-C650200.webp) | Reisdrink ungesüßt, angereichert mit Vitaminen und Calcium | Rice drink unsweetened, fortified with vitamins and calcium |
| [bls-C660000](0005/bls-C660000.webp) | Haferdrink ungesüßt | Oat drink unsweetened |
| [bls-C660200](0005/bls-C660200.webp) | Haferdrink ungesüßt, angereichert mit Vitaminen, Calcium und Jod | Oat drink unsweetened, fortified with vitamins, calcium and iodine |
| [bls-C660300](0005/bls-C660300.webp) | Haferdrink gesüßt, aromatisiert | Oat drink sweetened, flavoured |
| [bls-C660500](0005/bls-C660500.webp) | Haferdrink gesüßt, aromatisiert, angereichert mit Vitaminen, Calcium und Jod | Oat drink sweetened, flavoured, fortified with vitamins, calcium and iodine |
| [bls-D011000](0005/bls-D011000.webp) | Backerbsen | Soup pearls |
| [bls-D024000](0005/bls-D024000.webp) | Dinkelzwieback ungesüßt | Spelt rusk unsweetened |
| [bls-D025000](0005/bls-D025000.webp) | Vollkornzwieback ungesüßt | Wholemeal rusk unsweetened |
| [bls-D026000](0005/bls-D026000.webp) | Vollkornzwieback | Wholemeal rusk |
| [bls-D032000](0005/bls-D032000.webp) | Nährzwieback | Fortified rusk |
| [bls-D034000](0005/bls-D034000.webp) | Schokozwieback | Chocolate rusk |
| [bls-D035000](0005/bls-D035000.webp) | Kokoszwieback | Coconut rusk |
| [bls-D036000](0005/bls-D036000.webp) | Butterzwieback | Butter rusk |
| [bls-D038000](0005/bls-D038000.webp) | Zwieback eifrei | Rusk egg-free |
| [bls-D039000](0005/bls-D039000.webp) | Zwieback glutenfrei | Rusk gluten-free |
| [bls-D041000](0005/bls-D041000.webp) | Erdnussflips | Peanut puffs |
| [bls-D050000](0005/bls-D050000.webp) | Cracker | Crackers |
| [bls-D064000](0005/bls-D064000.webp) | Salzbrezeln/Salzstangen (Laugendauergebäck) | Salted pretzels/pretzel sticks (snack) |
| [bls-D071000](0005/bls-D071000.webp) | Ausbackteig (mit Milch) gesüßt, roh | Frying batter (with milk) sweetened, raw |
| [bls-D072000](0005/bls-D072000.webp) | Blätterteig eifrei, roh | Puff pastry egg-free, raw |
| [bls-D072062](0005/bls-D072062.webp) | Blätterteig eifrei, gebacken | Puff pastry egg-free, baked |
| [bls-D073000](0005/bls-D073000.webp) | Brandmasse/Brandteig, roh | Choux pastry raw |
| [bls-D076000](0005/bls-D076000.webp) | Ausbackteig (mit Bier) ungesüßt, roh | Frying batter (with beer) unsweetened, raw |
| [bls-D077002](0005/bls-D077002.webp) | Biskuitboden | Sponge cake base |
| [bls-D079000](0005/bls-D079000.webp) | Pizzateig (mit Hefe) roh | Pizza dough with yeast, raw |
| [bls-D079062](0005/bls-D079062.webp) | Pizzateig (mit Hefe) gebacken | Pizza dough with yeast, baked |
| [bls-D083000](0005/bls-D083000.webp) | Sachertortenboden | Sacher cake base |
| [bls-D085000](0005/bls-D085000.webp) | Wiener Tortenboden (hell) | Viennese sponge cake base (light) |
| [bls-D086000](0005/bls-D086000.webp) | Biskuitrolle/Biskuitroulade, ungefüllt | Sponge cake roll unfilled |
| [bls-D087000](0005/bls-D087000.webp) | Schokobiskuitboden | Chocolate sponge cake base |
| [bls-D088000](0005/bls-D088000.webp) | Wiener Tortenboden kakaohaltig (dunkel) | Viennese sponge cake base containing cocoa (dark) |
| [bls-D089000](0005/bls-D089000.webp) | Schokobiskuitrolle/Schokobiskuitroulade, ungefüllt | Chocolate sponge cake roll unfilled |
| [bls-D096000](0005/bls-D096000.webp) | Zwiebelkuchen mit Speck (Hefeteig) | Onion cake (yeast dough) with bacon |
| [bls-D0A1000](0005/bls-D0A1000.webp) | Buchweizen-Wasserbiskuitboden | Buckwheat water sponge cake base |
| [bls-D0A2000](0005/bls-D0A2000.webp) | Mandelbiskuitboden | Almond sponge cake base |
| [bls-D0A2100](0005/bls-D0A2100.webp) | Schoko-Mandelbiskuitboden | Chocolate-almond sponge cake base |
| [bls-D0A2200](0005/bls-D0A2200.webp) | Mandelboden (mit Eiklar zubereitet) | Almond cake base (prepared with egg white) |
| [bls-D0A3000](0005/bls-D0A3000.webp) | Nussbiskuitboden | Nut sponge cake base |
| [bls-D0A3100](0005/bls-D0A3100.webp) | Nuss-Wasserbiskuitboden | Nut water sponge cake base |
| [bls-D0A3200](0005/bls-D0A3200.webp) | Nussboden (mit Eiklar zubereitet) | Nut cake base (prepared with egg white) |
| [bls-D0A4000](0005/bls-D0A4000.webp) | Wasserbiskuitboden | Water sponge cake base |
| [bls-D0A4100](0005/bls-D0A4100.webp) | Schoko-Wasserbiskuitboden | Chocolate water sponge cake base |
| [bls-D0A5000](0005/bls-D0A5000.webp) | Hefeteig (einfacher) gebacken | Yeast dough (simple) baked |
| [bls-D0A5100](0005/bls-D0A5100.webp) | Hefeteig (feiner) gebacken | Yeast dough (fine) baked |
| [bls-D0A6000](0005/bls-D0A6000.webp) | Kuchenboden/Tortenboden (Mürbeteig, einfacher) | Cake base/torte base (shortcrust pastry, simple) |
| [bls-D0A6100](0005/bls-D0A6100.webp) | Kuchenboden/Tortenboden, kakaohaltig (Mürbeteig, einfacher) | Cake base/torte base, containing cocoa (shortcrust pastry, simple) |
| [bls-D0A7000](0005/bls-D0A7000.webp) | Kuchenboden/Tortenboden (Rührmasse) | Cake base/torte base (cake batter) |
| [bls-D0A8000](0005/bls-D0A8000.webp) | Quicheboden (Mürbeteig) | Quiche base (shortcrust pastry) |
| [bls-D130100](0005/bls-D130100.webp) | Apfelkuchen (Sandmasse) | Apple pie (sand cake batter) |
| [bls-D131200](0005/bls-D131200.webp) | Apfelkuchen (Rührmasse) | Apple pie (cake batter) |
| [bls-D132100](0005/bls-D132100.webp) | Spiegeleierkuchen (Rührmasse) | Apricot cheese cake (cake batter) |
| [bls-D181300](0005/bls-D181300.webp) | Apfelkuchen gedeckt (Mürbeteig) | Covered apple sheet cake (shortcrust pastry) |
| [bls-D187200](0005/bls-D187200.webp) | Apfel-Streuselkuchen (Mürbeteig) | Apple crumble tart (shortcrust pastry) |
| [bls-D187300](0005/bls-D187300.webp) | Apfel-Streuselkuchen (Rührmasse) | Apple crumble tart (cake batter) |
| [bls-D188400](0005/bls-D188400.webp) | Apfelkuchen gedeckt mit Mandelbelag (Mürbeteig) | Apple cake with bee sting cake topping (shortcrust pastry) |
| [bls-D1A1000](0005/bls-D1A1000.webp) | Apfel-Streuselkuchen (Hefeteig) | Apple crumble cake (yeast dough) |
| [bls-D1A1100](0005/bls-D1A1100.webp) | Apfelkuchen mit Puddingcreme (Hefeteig) | Apple cake with pudding (yeast dough) |
| [bls-D1A1200](0005/bls-D1A1200.webp) | Rhabarber-Streuselkuchen (Hefeteig) | Rhubarb crumble cake (yeast dough) |
| [bls-D1A1300](0005/bls-D1A1300.webp) | Zwetschgen-Streuselkuchen (Hefeteig) | Blue plum crumble cake (yeast dough) |
| [bls-D1A2000](0005/bls-D1A2000.webp) | Aprikosenkuchen (Mürbeteig) mit Rahmguss | Apricot cake (shortcrust pastry) with cream topping |
| [bls-D1A2100](0005/bls-D1A2100.webp) | Kirsch-Streuselkuchen (Mürbeteig) | Cherry crumble cake (shortcrust pastry) |
| [bls-D1A2200](0005/bls-D1A2200.webp) | Kuchenboden (Mürbeteig) belegt mit Früchten, Pudding und Klarguss | Shortcrust pastry base with fruit, pudding and gelatin glaze |
| [bls-D1A2300](0005/bls-D1A2300.webp) | Rhabarber-Streuselkuchen (Mürbeteig) | Rhubarb crumble cake (shortcrust pastry) |
| [bls-D1A3000](0005/bls-D1A3000.webp) | Apfelkuchen (Quark-Öl-Teig) | Apple cake (quark oil dough) |
| [bls-D1A3100](0005/bls-D1A3100.webp) | Zwetschgenkuchen (Quark-Öl-Teig) | Blue plum cake (quark oil dough) |
| [bls-D1A4000](0005/bls-D1A4000.webp) | Apfelkuchen vegan (Rührmasse) | Apple cake vegan (cake batter) |
| [bls-D1A4100](0005/bls-D1A4100.webp) | Kuchenboden (Rührmasse) belegt mit Früchten, Pudding und Klarguss | Cake base with fruit, pudding and gelatin glaze |
| [bls-D1A4200](0005/bls-D1A4200.webp) | Stachelbeerkuchen (Rührmasse) mit Baiser | Gooseberry cake (cake batter) with meringue |
| [bls-D200300](0005/bls-D200300.webp) | Erdbeerkuchen (Rührmasse) mit Klarguss | Strawberry cake (cake batter) with gelatin glaze |
| [bls-D208700](0005/bls-D208700.webp) | Apfel-Quarktorte (ohne Boden) | Apple cheese torte (without cake base) |
| [bls-D237100](0005/bls-D237100.webp) | Rhabarberkuchen (Rührmasse) mit Baiser | Rhubarb cake (cake batter) with meringue |
| [bls-D238500](0005/bls-D238500.webp) | Aprikosen-Nuss-Torte (Rührmasse) | Apricot torte with nuts (cake batter) |
| [bls-D281100](0005/bls-D281100.webp) | Kirschtorte (Mürbeteig und Rührmasse) | Cherry torte (shortcrust pastry and cake batter) |
| [bls-D283000](0005/bls-D283000.webp) | Pfirsichtörtchen (Mürbeteig) mit Klarguss und Sahne | Peach tartlet (shortcrust pastry) with gelatin glaze and whipped cream |
| [bls-D288100](0005/bls-D288100.webp) | Pfirsichtorte (Mürbeteig) mit Klarguss | Peach torte (shortcrust pastry) with gelatin glaze |
| [bls-D288200](0005/bls-D288200.webp) | Apfeltorte gedeckt (Mürbeteig) | Covered apple torte (shortcrust pastry) |
| [bls-D288300](0005/bls-D288300.webp) | Apfel-Mohntorte (Mürbeteig) | Poppy seed apple torte (shortcrust pastry) |
| [bls-D2A1000](0005/bls-D2A1000.webp) | Himbeertörtchen (Mürbeteig) mit Sahne und Mandelblättchen | Raspberry tartlet (shortcrust pastry) with whipped cream and almond flakes |
| [bls-D2A2000](0005/bls-D2A2000.webp) | Johannisbeertorte mit Baiser/Träublestorte (Mürbeteig) | Red currant torte (shortcrust pastry) with meringue |
| [bls-D300200](0005/bls-D300200.webp) | Sachertorte (Rührmasse) | Sacher torte (cake batter) |
| [bls-D300400](0005/bls-D300400.webp) | Nuss-Sahnetorte (Biskuit) | Nut cream torte (sponge cake) |
| [bls-D300500](0005/bls-D300500.webp) | Linzer Torte (Mürbeteig) | Linzer torte (shortcrust pastry) |
| [bls-D300600](0005/bls-D300600.webp) | Schwarzwälder Kirschtorte (Schokobiskuit) mit Alkohol | Black forest torte (chocolate sponge cake) with alcohol |
| [bls-D301000](0005/bls-D301000.webp) | Marzipan-Walnuss-Sahnetorte (Biskuit und Mürbeteig) | Marzipan walnut torte (sponge cake and shortcrust pastry) |
| [bls-D301300](0005/bls-D301300.webp) | Französische Schokoladentorte (Rührmasse) | French chocolate torte (cake batter) |
| [bls-D302100](0005/bls-D302100.webp) | Makronentorte (Mürbeteig) | Macaroon torte (shortcrust pastry) |
| [bls-D302200](0005/bls-D302200.webp) | Baiser-Schokosahnetorte (Mürbeteig) | Meringue chocolate cream torte (shortcrust pastry) |
| [bls-D305000](0005/bls-D305000.webp) | Holländische Kirsch-Sahneschnitten/Kirsch-Sahnetorte (Blätterteig) | Dutch cherry cream torte/squares (puff pastry) |
