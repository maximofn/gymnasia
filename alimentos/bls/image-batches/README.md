# Imágenes BLS por tandas

Imágenes editoriales independientes de los datos y de la app, generadas mediante
una llamada integrada de Codex por alimento. Se mantiene el estilo aprobado de
las muestras CIQUAL como referencia visual; no se reutilizan sus fotografías.
Las ilustraciones son de Gymnasia, no proporcionadas ni validadas por Max
Rubner-Institut. No prueban receta, porción de 100 g, ingredientes exactos,
alérgenos ni propiedades nutricionales. Fuente de los nombres: Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0.

## Estado

**1.900/7.140 imágenes registradas; 5.240 pendientes; 26,61 %.**

Las tandas `0001` a `0019` contienen 100 imágenes cada una, generadas con Codex
integrado y revisadas visualmente. Consultar GitHub para el estado de sus PRs;
`pending-review` no equivale a aprobación del mantenedor. No hay integración móvil.

- [Tanda 0001: manifiesto y prompts](0001/manifest.json).
- [Tanda 0002: manifiesto y prompts](0002/manifest.json).
- [Tanda 0003: manifiesto y prompts](0003/manifest.json).
- [Tanda 0004: manifiesto y prompts](0004/manifest.json).
- [Tanda 0005: manifiesto y prompts](0005/manifest.json).
- [Tanda 0006: manifiesto y prompts](0006/manifest.json).
- [Tanda 0007: manifiesto y prompts](0007/manifest.json).
- [Tanda 0008: manifiesto y prompts](0008/manifest.json).
- [Tanda 0009: manifiesto y prompts](0009/manifest.json).
- [Tanda 0010: manifiesto y prompts](0010/manifest.json).
- [Tanda 0011: manifiesto y prompts](0011/manifest.json).
- [Tanda 0012: manifiesto y prompts](0012/manifest.json).
- [Tanda 0013: manifiesto y prompts](0013/manifest.json).
- [Tanda 0014: manifiesto y prompts](0014/manifest.json).
- [Tanda 0015: manifiesto y prompts](0015/manifest.json).
- [Tanda 0016: manifiesto y prompts](0016/manifest.json).
- [Tanda 0017: manifiesto y prompts](0017/manifest.json).
- [Tanda 0018: manifiesto y prompts](0018/manifest.json).
- [Tanda 0019: manifiesto y prompts](0019/manifest.json).

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

## Tanda 0006: tartas, bizcochos y bollería

100 imágenes nuevas, una por código pendiente, de tartas de nata y mantequilla,
rollos de bizcocho rellenos, tartas de fruta, chocolate y queso, muffins, masas
crudas, bizcochos, barquillos, stollen y bollería de levadura o quark y aceite.
Los nombres oficiales DE/EN se conservan literales y cada imagen tiene su prompt,
referencia de estilo, huella del nombre de origen y SHA-256 en el manifiesto.

Las representaciones respetan el tipo de masa, el estado crudo u horneado y los
rellenos y coberturas indicados. El pastel de melocotón sin crema lleva solo
fruta y glaseado sobre el bizcocho; la base de masa quebrada permanece vacía.
La tarta de queso sin hornear tiene superficie clara sin dorado. Los muffins
ingleses son panes planos dorados en sartén. Las dos masas crudas se muestran
en cuenco. La nata, el quark, los frutos secos y el alcohol incorporados no se
acompañan de ingredientes sueltos, botellas o símbolos.

Para interpretar especialidades se consultaron fuentes de sus elaboradores o
recetarios: la [Herrentorte de Trölsch](https://www.troelsch.de/produkte/herrentorte/),
con capas claras, crema de vino y cobertura de chocolate; la
[Zuger Kirschtorte de Treichler](https://www.treichler-zuger-kirschtorte.ch/onlineshop/zuger-kirschtorten-gga/),
con almendrado Japonais, bizcocho y crema al kirsch, sin cerezas rojas añadidas;
la [Prinzregententorte del recetario de Baviera](https://www.genusserbe.bayern.de/350579/index.php),
con capas finas de bizcocho y crema de chocolate; y la
[elaboración del Baumkuchen del obrador de Salzwedel](https://www.salzwedelerbaumkuchen.de/herstellung),
con capas alrededor del eje. La versión editorial de Ottilienkuchen toma como
apoyo la [receta de Nami-Nami](https://nami-nami.ee/retsept/24261/ottilienkuchen),
con almendra, chocolate y pequeños trozos de cítricos confitados incorporados.
Son apoyos para una ilustración genérica, no recetas ni imágenes atribuidas a
BLS, ni una prueba de ingredientes exactos, alérgenos o raciones. No se copiaron
fotografías de esas fuentes. Las únicas referencias visuales son las muestras
aprobadas de CIQUAL, utilizadas solo para el estilo.

Los 100 WebP finales se revisaron en nueve hojas de contacto y ocho casos se
abrieron también a tamaño completo. Hubo una regeneración: `bls-D431500`
(Baumkuchen), cuya primera salida combinaba anillos con estratos laterales
incoherentes. La salida final muestra una rodaja anular baja con los anillos en
su cara de corte. El manifiesto conserva el motivo, la resolución, el prompt
anterior y el SHA-256 del PNG anterior; los originales de Codex se conservan.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0006-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0006-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0006-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0006-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0006-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0006-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0006-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0006-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0006-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-D306000](0006/bls-D306000.webp) | Flocken-Sahnetorte (Brandmasse und Mürbeteig) | Cream torte (choux and shortcrust pastry) |
| [bls-D307000](0006/bls-D307000.webp) | Herrentorte (Mürbeteig und Wiener Boden hell) mit Apfel-Weincreme | Dark chocolate torte (shortcrust pastry and Viennese sponge cake light) with apple wine-cream |
| [bls-D310300](0006/bls-D310300.webp) | Käsesahnetorte (Wasserbiskuit) | Cheese cream torte (sponge cake) |
| [bls-D310400](0006/bls-D310400.webp) | Biskuitrolle/Biskuitroulade, mit Konfitüre | Sponge cake roll, filled with jam |
| [bls-D310600](0006/bls-D310600.webp) | Biskuitrolle/Biskuitroulade, mit Joghurtsahne | Sponge cake roll, filled with yogurt-cream |
| [bls-D310700](0006/bls-D310700.webp) | Biskuitrolle/Biskuitroulade, mit Zitronensahnecreme | Sponge cake roll, filled with lemon-cream |
| [bls-D310800](0006/bls-D310800.webp) | Biskuitrolle/Biskuitroulade, mit Erdbeersahnecreme | Sponge cake roll, filled with strawberry-cream |
| [bls-D310900](0006/bls-D310900.webp) | Biskuitrolle/Biskuitroulade, mit Mandarinensahnecreme | Sponge cake roll, filled with mandarin-cream |
| [bls-D311200](0006/bls-D311200.webp) | Buttercremetorte (Biskuit) | Butter cream torte (sponge cake) |
| [bls-D312300](0006/bls-D312300.webp) | Aprikosen-Sahnetorte (Wasserbiskuit) | Apricot cream torte (sponge cake) |
| [bls-D312500](0006/bls-D312500.webp) | Zuger Kirschtorte (Biskuit und Nussboden) mit Alkohol | "Zuger Kirschtorte" cherry torte (sponge cake and nut sponge cake) with alcohol |
| [bls-D312600](0006/bls-D312600.webp) | Buchweizentorte (Wasserbiskuit) mit Heidelbeersahnecreme | Buckwheat flour torte (water sponge cake) with blueberry-cream |
| [bls-D312700](0006/bls-D312700.webp) | Möhren-Nusstorte/Rüblitorte (Biskuit) | Carrot nut cake (sponge cake) |
| [bls-D312800](0006/bls-D312800.webp) | Mokkasahnetorte (Wasserbiskuit) mit Alkohol | Mocha cream torte (water sponge cake) with alcohol |
| [bls-D312900](0006/bls-D312900.webp) | Trüffeltorte (Schoko-Wasserbiskuit) | Truffle torte (chocolate water sponge cake) |
| [bls-D313100](0006/bls-D313100.webp) | Mokkacreme-Marzipan-Torte (Wasserbiskuit) | Mocha-cream marzipan torte (water sponge cake) |
| [bls-D313300](0006/bls-D313300.webp) | Erdbeersahnetorte (Wasserbiskuit) | Strawberry cream torte (water sponge cake) |
| [bls-D313400](0006/bls-D313400.webp) | Schokosahnetorte (Schoko-Wasserbiskuit) | Chocolate cream torte (chocolate water sponge cake) |
| [bls-D313500](0006/bls-D313500.webp) | Zitronensahnetorte (Wasserbiskuit) | Lemon cream torte (water sponge cake) |
| [bls-D313600](0006/bls-D313600.webp) | Orangencremetorte (Wiener Boden dunkel) mit Schokosahne | Orange cream torte (Viennese sponge cake dark) with chocolate-cream |
| [bls-D314200](0006/bls-D314200.webp) | Mokkabuttercremetorte (Biskuit) mit Alkohol | Mocha butter cream torte (sponge cake) with alcohol |
| [bls-D314300](0006/bls-D314300.webp) | Schokobuttercremetorte (Biskuit) | Chocolate butter cream torte (sponge cake) |
| [bls-D314400](0006/bls-D314400.webp) | Buttercremetorte (Schokobiskuit) mit Canacheüberzug | Butter cream torte (chocolate sponge cake) with chocolate icing |
| [bls-D314500](0006/bls-D314500.webp) | Schokoladentorte (Rührmasse) mit Canacheüberzug | Chocolate torte (cake batter) with chocolate icing |
| [bls-D314600](0006/bls-D314600.webp) | Pfirsichtorte (Biskuit) mit Klarguss (ohne Sahne/Creme) | Peach torte (sponge cake) with gelatin glaze (without cream) |
| [bls-D320100](0006/bls-D320100.webp) | Buttercremetorte (Wiener Boden hell) | Butter cream torte (Viennese sponge cake light) |
| [bls-D321000](0006/bls-D321000.webp) | Joghurtsahnetorte (Biskuit und Mürbeteig) | Yogurt cream torte (sponge cake and shortcrust pastry) |
| [bls-D330100](0006/bls-D330100.webp) | Buttercremetorte (Rührmasse) | Butter cream torte (cake batter) |
| [bls-D330300](0006/bls-D330300.webp) | Schokoladentorte (Rührmasse) | Chocolate torte (cake batter) |
| [bls-D330400](0006/bls-D330400.webp) | Prinzregententorte (Biskuit) | "Prinzregententorte" torte (sponge cake) |
| [bls-D330500](0006/bls-D330500.webp) | Schokoladen-Nusstorte (Rührmasse) | Chocolate nut torte (cake batter) |
| [bls-D340100](0006/bls-D340100.webp) | Buttercremetorte (Sandmasse) | Butter cream torte (sand cake batter) |
| [bls-D340200](0006/bls-D340200.webp) | Traubentorte (Sandmasse) mit Vanillecreme und Klarguss | Grape torte (sand cake batter) with vanilla cream and gelatin glaze |
| [bls-D380200](0006/bls-D380200.webp) | Käsetorte (Mürbeteig) | Cheese torte (shortcrust pastry) |
| [bls-D380900](0006/bls-D380900.webp) | Kuchenboden/Tortenboden (Mürbeteig, feiner) | Cake base/torte base (shortcrust pastry, fine) |
| [bls-D3A1000](0006/bls-D3A1000.webp) | Biskuitrolle/Biskuitroulade, mit Himbeersahnecreme | Sponge cake roll, filled with raspberry-cream |
| [bls-D3A2000](0006/bls-D3A2000.webp) | Erdbeer-Charlotte mit Joghurtsahne (Biskuit) | Strawberry Charlotte Royale Cake (sponge cake) |
| [bls-D3A3000](0006/bls-D3A3000.webp) | Erdbeer-Sahnecremetorte (Wasserbiskuit) | Strawberry-cream torte (water sponge cake) |
| [bls-D3A4000](0006/bls-D3A4000.webp) | Nussbiskuitrolle/Nussbiskuitroulade, mit Himbeeren und Sahne | Nut sponge cake roll, filled with raspberries and whipped cream |
| [bls-D3A5000](0006/bls-D3A5000.webp) | Schwarz-Weiß-Buttercremetorte (Wasserbiskuit) | Black-and-white chequerboard torte (water sponge cake) |
| [bls-D3A6000](0006/bls-D3A6000.webp) | Frischkäse-Torte (ohne Backen) | Cheesecake (without baking) |
| [bls-D3A7000](0006/bls-D3A7000.webp) | Eierlikörtorte (Schoko-Mandelbiskuit) | Egg liqueur torte (chocolate-almond sponge cake) |
| [bls-D400400](0006/bls-D400400.webp) | Schokoladen-Muffins (Rührmasse) | Chocolate muffins (cake batter) |
| [bls-D400700](0006/bls-D400700.webp) | Englische Muffins/Toasties (Hefeteig) gebraten ohne Fett (Pfanne) | English muffins/toasties (yeast dough) fried without fat (pan) |
| [bls-D400800](0006/bls-D400800.webp) | Heidelbeer-Muffins (Rührmasse) | Blueberry muffins (cake batter) |
| [bls-D401100](0006/bls-D401100.webp) | Kartoffelkuchen (Rührmasse) | Potato cake (cake batter) |
| [bls-D401400](0006/bls-D401400.webp) | Honigkuchen | Gingerbread cake |
| [bls-D410100](0006/bls-D410100.webp) | Biskuitschnitte mit Vanillebuttercreme | Sponge cake square with vanilla butter cream |
| [bls-D410300](0006/bls-D410300.webp) | Baumstamm/Bismarckeiche (Wasserbiskuit) mit Mokkabuttercreme | "Bismarck-Eiche" chocolate log cake (water sponge cake) with mocha butter cream |
| [bls-D411100](0006/bls-D411100.webp) | Mandarinen-Omelettes (Wiener Boden hell) mit Sahne | Viennese sponge cake roll filled with whipped cream and mandarins |
| [bls-D411200](0006/bls-D411200.webp) | Rehrücken (Wiener Boden hell) | Mock saddle of venison cake (Viennese sponge cake light) |
| [bls-D420000](0006/bls-D420000.webp) | Feines Früchtebrot (mit Roggenbrotteig zubereitet) | Fruitcake (prepared with rye bread dough) |
| [bls-D421000](0006/bls-D421000.webp) | Sandmasse/Sandteig, roh | Sand cake batter raw |
| [bls-D422000](0006/bls-D422000.webp) | Rührmasse/Rührteig, roh | Cake batter raw |
| [bls-D422600](0006/bls-D422600.webp) | Kuchen aus Rührmasse/Rührkuchen | Pound cake (cake batter) |
| [bls-D430400](0006/bls-D430400.webp) | Napfkuchen mit Sultaninen und Zitronat (Rührmasse) | Ring cake with sultanas and candied lemon peel (cake batter) |
| [bls-D430500](0006/bls-D430500.webp) | Nusskuchen (Rührmasse) | Nut cake (cake batter) |
| [bls-D430600](0006/bls-D430600.webp) | Rosinenkuchen (Rührmasse) | Raisin cake (cake batter) |
| [bls-D431100](0006/bls-D431100.webp) | Marmorkuchen (Rührmasse) | Marble cake (cake batter) |
| [bls-D431200](0006/bls-D431200.webp) | Mandelkuchen (Rührmasse) | Almond cake (cake batter) |
| [bls-D431300](0006/bls-D431300.webp) | Makronenkuchen (Rührmasse) | Macaroon cake (cake batter) |
| [bls-D431400](0006/bls-D431400.webp) | Donauwellen (Rührmasse) | "Donau-Wellen" cake (cake batter) |
| [bls-D431500](0006/bls-D431500.webp) | Baumkuchen/Grillkuchen/Schichtkuchen (Rührmasse) | Layer cake (cake batter) |
| [bls-D431700](0006/bls-D431700.webp) | Orangenkuchen (Rührmasse) | Orange cake (cake batter) |
| [bls-D431800](0006/bls-D431800.webp) | Ananas-Marzipan-Kuchen (Rührmasse) | Pineapple marzipan cake (cake batter) |
| [bls-D431900](0006/bls-D431900.webp) | Ottilienkuchen (Rührmasse) | "Ottilienkuchen" cake (cake batter) |
| [bls-D432100](0006/bls-D432100.webp) | Rehrücken gebacken (Sandmasse) | Mock saddle of venison cake (sand cake batter) |
| [bls-D432200](0006/bls-D432200.webp) | Eiserkuchen (Rührmasse) | Hollow wafer sticks (cake batter) |
| [bls-D432300](0006/bls-D432300.webp) | Früchtekuchen (ohne Fett zubereitet) | Fruitcake (prepared without fat) |
| [bls-D432400](0006/bls-D432400.webp) | Quarkstollen (Rührmasse) | Quark stollen (cake batter) |
| [bls-D433200](0006/bls-D433200.webp) | Quarknapfkuchen (Rührmasse) | Quark ring cake (cake batter) |
| [bls-D433300](0006/bls-D433300.webp) | Schokoladenkuchen (Rührmasse) | Chocolate cake (cake batter) |
| [bls-D433400](0006/bls-D433400.webp) | Gewürzkuchen (Rührmasse) | Spice cake (cake batter) |
| [bls-D433600](0006/bls-D433600.webp) | Baumstamm (Rührmasse) mit Schokobuttercreme | Log cake (cake batter) filled with chocolate butter cream |
| [bls-D440300](0006/bls-D440300.webp) | Kuchen aus Sandmasse/Sandkuchen | Sand cake |
| [bls-D440500](0006/bls-D440500.webp) | Nusskuchen (Sandmasse) | Nut cake (sand cake batter) |
| [bls-D440700](0006/bls-D440700.webp) | Englischer Kuchen (Sandmasse) mit Alkohol | English cake (sand cake batter) with alcohol |
| [bls-D440800](0006/bls-D440800.webp) | Königskuchen (Rührmasse) mit Alkohol | Candied fruit cake (cake batter) with alcohol |
| [bls-D441300](0006/bls-D441300.webp) | Frankfurter Kranz (Sandmasse) | Frankfurt crown cake (sand cake batter) |
| [bls-D441400](0006/bls-D441400.webp) | Wiener Sandtorte | Viennese sand torte |
| [bls-D461200](0006/bls-D461200.webp) | Käsekuchen/Quarkkuchen (Hefeteig) | Cheesecake (yeast dough) |
| [bls-D461300](0006/bls-D461300.webp) | Bienenstich (Hefeteig) | Bee sting cake (yeast dough) |
| [bls-D461400](0006/bls-D461400.webp) | Gugelhupf mit Rosinen (Hefeteig) | Ring cake with raisins (yeast dough) |
| [bls-D461500](0006/bls-D461500.webp) | Streuselkuchen (Hefeteig) | Crumb cake (yeast dough) |
| [bls-D461602](0006/bls-D461602.webp) | Brioches (Hefeteig) ungefüllt | Brioches (yeast dough) without filling |
| [bls-D461700](0006/bls-D461700.webp) | Butterkuchen/Zuckerkuchen (Hefeteig) | German butter cake (yeast dough) |
| [bls-D462700](0006/bls-D462700.webp) | Mandelkuchen (Hefeteig) | Almond cake (yeast dough) |
| [bls-D462800](0006/bls-D462800.webp) | Schneckennudeln/Rosenkuchen (Hefeteig) | Yeast rose cake |
| [bls-D463100](0006/bls-D463100.webp) | Dresdner Stollen (Hefeteig) mit Alkohol | Dresden stollen (yeast dough) with alcohol |
| [bls-D463500](0006/bls-D463500.webp) | Mohnstollen/Mohnstriezel (Hefeteig) | Poppy seed stollen (yeast dough) |
| [bls-D463700](0006/bls-D463700.webp) | Marzipanstollen (Hefeteig) | Marzipan stollen (yeast dough) |
| [bls-D464200](0006/bls-D464200.webp) | Nusskranz (Hefeteig) | Nut ring cake (yeast dough) |
| [bls-D464300](0006/bls-D464300.webp) | Mandelkranz (Hefeteig) | Almond ring cake (yeast dough) |
| [bls-D465300](0006/bls-D465300.webp) | Thüringer Obstkuchen (Hefeteig) | Thuringian fruit flan (yeast dough) |
| [bls-D466100](0006/bls-D466100.webp) | Apfelkuchen gedeckt (Hefeteig) | Apple pie (yeast dough) |
| [bls-D470100](0006/bls-D470100.webp) | Käsekuchen/Quarkkuchen (Quark-Öl-Teig) | Cheesecake (quark oil dough) |
| [bls-D470200](0006/bls-D470200.webp) | Nusskranz (Quark-Öl-Teig) | Nut ring cake (quark oil dough) |
| [bls-D470300](0006/bls-D470300.webp) | Butterkuchen/Zuckerkuchen (Quark-Öl-Teig) | German butter cake (quark oil dough) |
| [bls-D471600](0006/bls-D471600.webp) | Gerollte Marzipan-Nuss-Schnitten (Quark-Öl-Teig) | Swiss roll, filled with marzipan and nuts (quark oil dough) |
| [bls-D471700](0006/bls-D471700.webp) | Quarktaschen (Quark-Öl-Teig) | Turnover (quark oil dough) filled with quark |

## Tanda 0007: strudel, gofres, galletas y panes de especias

100 imágenes nuevas, una por código pendiente, desde `bls-D477100` hasta
`bls-D6A6000`: tartas de queso, bizcochos, strudel, merengues, galletas sin
gluten, gofres dulces y salados, barquillos, Lebkuchen, pastas de almendra y coco
y especialidades con chocolate. Los nombres DE/EN se conservan literales.
El manifiesto contiene el prompt exacto, la referencia de estilo y su hash,
la huella del nombre de origen y el SHA-256 del WebP de cada alimento.

Se distinguen masa quebrada, hojaldre, masa fina de strudel y masa de quark y
aceite. El hojaldre de quark incorpora el quark a la masa; la tarta sin base
carece de corteza inferior. La Eierschecke muestra base de levadura, quark y
capa de crema de huevo. Los conos están vacíos y los gofres no llevan toppings
añadidos. Las letras de Russisch-Brot son la forma del propio alimento, sin
formar palabras ni llevar texto impreso. Las obleas son discos comestibles.
Las Makronen tienen textura rugosa; los Baumkuchenspitzen muestran capas finas
curvadas en el corte y las florentinas, almendra caramelizada y base de chocolate.

Como apoyo editorial se consultaron fuentes de sus elaboradores o recetarios:
la [Eierschecke de Groschupf](https://baeckerei-groschupf.de/produkte/details/eierschecke),
el [Mazarinkuchen del recetario de GU](https://www.kuechengoetter.de/rezepte/download/Mazarinkuchen-10637.pdf),
los [Wespennester de Dr. Oetker](https://www.oetker.de/rezepte/r/wespennester),
los [Dominosteine de Dr. Quendt](https://www.dr-quendt.de/produkte/dominosteine/),
los [Basler Läckerli de su fabricante](https://www.laeckerli-huus.ch/de/content/ueber-uns/portrait)
y las [florentinas de Confiserie Bosch](https://www.confiserie-bosch.de/product/florentiner-zb-125g/).
Son referencias para ilustraciones genéricas, no recetas oficiales BLS ni una
garantía de ingredientes, alérgenos o cantidades. No se copiaron sus fotografías.
La muestra aprobada de CIQUAL se adjuntó únicamente como referencia de estilo.

Revisión: los 100 WebP finales en nueve hojas y nueve casos a tamaño completo.
No fue necesaria ninguna regeneración. El estado sigue siendo
`pending-review` hasta la revisión del mantenedor. No hay integración móvil.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0007-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0007-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0007-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0007-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0007-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0007-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0007-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0007-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0007-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-D477100](0007/bls-D477100.webp) | Schinkenhörnchen (Quark-Öl-Teig) | Ham rolls (quark oil dough) |
| [bls-D480200](0007/bls-D480200.webp) | Käsekuchen/Quarkkuchen (Mürbeteig) | Cheesecake (shortcrust pastry) |
| [bls-D480300](0007/bls-D480300.webp) | Käsekuchen mit Streuseln (Mürbeteig) | Cheesecake with crumbles (shortcrust pastry) |
| [bls-D482200](0007/bls-D482200.webp) | Zwetschgenkuchen (Mürbeteig) | Blue plum tart (shortcrust pastry) |
| [bls-D483200](0007/bls-D483200.webp) | Haselnusszopf (Mürbeteig) | Braided hazelnut bread (shortcrust pastry) |
| [bls-D483400](0007/bls-D483400.webp) | Apfelstrudel (Mürbeteig) | Apple strudel (shortcrust pastry) |
| [bls-D490100](0007/bls-D490100.webp) | Quarkblätterteig gebacken | Puff pastry with quark, baked |
| [bls-D490300](0007/bls-D490300.webp) | Blätterteig (mit Ei) gebacken | Puff pastry with egg, baked |
| [bls-D490500](0007/bls-D490500.webp) | Französische Apfeltarte (Blätterteig) | French apple tart (puff pastry) |
| [bls-D4A1000](0007/bls-D4A1000.webp) | Apfelstrudel (Blätterteig) | Apple strudel (puff pastry) |
| [bls-D4A1100](0007/bls-D4A1100.webp) | Kirschstrudel (Blätterteig) | Cherry strudel (puff pastry) |
| [bls-D4A2000](0007/bls-D4A2000.webp) | Brownies | Brownies |
| [bls-D4A3000](0007/bls-D4A3000.webp) | Käsekuchen ohne Boden | Cheesecake (without cake base) |
| [bls-D4A4000](0007/bls-D4A4000.webp) | Kürbis-Mandel-Kuchen (Biskuitmasse) | Pumpkin almond cake (sponge cake) |
| [bls-D4A5100](0007/bls-D4A5100.webp) | Schwedischer Mandel-Marzipan-Kuchen/Mazarinkuchen (Mürbeteig) | Swedish almond marzipan cake (shortcrust pastry) |
| [bls-D4A6000](0007/bls-D4A6000.webp) | Eierschecke (Hefeteig) | "Eierschecke" cheesecake (yeast dough) with egg cream |
| [bls-D4A6100](0007/bls-D4A6100.webp) | Hefezopf mit Sultaninen | Braided yeast bread with sultanas |
| [bls-D4A6200](0007/bls-D4A6200.webp) | Mohnstollen (Hefemürbteig) | Poppy seed stollen (shortcrust pastry with yeast) |
| [bls-D4A6300](0007/bls-D4A6300.webp) | Thüringer Mohnkuchen (Hefeteig) | Thuringian poppy seed cake (yeast dough) |
| [bls-D4A7000](0007/bls-D4A7000.webp) | Käse-Schinken-Hörnchen (Quark-Öl-Teig) | Cheese-ham crescent (quark oil dough) |
| [bls-D4A7100](0007/bls-D4A7100.webp) | Mandarinen-Schmand-Kuchen (Quark-Öl-Teig) | Mandarin heavy sour cream cake (quark oil dough) |
| [bls-D4A7200](0007/bls-D4A7200.webp) | Mohnkranz (Quark-Öl-Teig) | Poppy seed ring cake (quark oil dough) |
| [bls-D4A8000](0007/bls-D4A8000.webp) | Ananas-Kranz gefüllt (Rührmasse) | Filled pineapple ring cake (cake batter) |
| [bls-D4A8100](0007/bls-D4A8100.webp) | Kokoskuchen (Rührmasse) | Coconut cake (cake batter) |
| [bls-D4A8200](0007/bls-D4A8200.webp) | Kürbis-Kuchen (Rührmasse) | Pumpkin cake (cake batter) |
| [bls-D4A8300](0007/bls-D4A8300.webp) | Marmorkuchen mit Kirschen (Rührmasse) | Marble cake (cake batter) with cherries |
| [bls-D4A8400](0007/bls-D4A8400.webp) | Möhren-Nuss-Kuchen (Rührmasse) | Carrot nut cake (cake batter) |
| [bls-D4A8500](0007/bls-D4A8500.webp) | Nusskuchen vegan (Rührmasse) | Nut cake vegan (cake batter) |
| [bls-D4A8600](0007/bls-D4A8600.webp) | Rotweinkuchen (Rührmasse) | Red wine cake (cake batter) |
| [bls-D4A8700](0007/bls-D4A8700.webp) | Zitronenkuchen (Rührmasse) | Lemon cake (cake batter) |
| [bls-D4A8800](0007/bls-D4A8800.webp) | Zitronenkuchen vegan (Rührmasse) | Lemon cake vegan (cake batter) |
| [bls-D540100](0007/bls-D540100.webp) | Wiener Apfelstrudel (Strudelteig) | Viennese apple strudel (strudel dough) |
| [bls-D540200](0007/bls-D540200.webp) | Apfelstrudel (Strudelteig) | Apple strudel (strudel dough) |
| [bls-D540300](0007/bls-D540300.webp) | Kirschstrudel (Strudelteig) | Cherry strudel (strudel dough) |
| [bls-D540400](0007/bls-D540400.webp) | Quarkstrudel (Strudelteig) | Quark strudel (strudel dough) |
| [bls-D610100](0007/bls-D610100.webp) | Russisch-Brot (Eiklarmasse) | Russian bread letter-shaped biscuits (meringue) |
| [bls-D610200](0007/bls-D610200.webp) | Baiser | Meringue |
| [bls-D610300](0007/bls-D610300.webp) | Schokoladenbaiser | Chocolate meringue |
| [bls-D610500](0007/bls-D610500.webp) | Zimtsterne (Eiklarmasse) | Cinnamon stars (meringue) |
| [bls-D610600](0007/bls-D610600.webp) | Zuckerlis (Eiklarmasse) | "Zuckerlis" almond meringue |
| [bls-D610700](0007/bls-D610700.webp) | Wespennester (Eiklarmasse) | "Wasp nests" almond meringue |
| [bls-D610800](0007/bls-D610800.webp) | Baiser mit Schoko-Nougatfüllung | Meringue with chocolate-nougat filling |
| [bls-D611000](0007/bls-D611000.webp) | Maiskekse glutenfrei | Maize biscuits gluten-free |
| [bls-D612000](0007/bls-D612000.webp) | Schokokekse glutenfrei | Chocolate biscuits gluten-free |
| [bls-D613000](0007/bls-D613000.webp) | Zitronenkekse glutenfrei | Lemon biscuits gluten-free |
| [bls-D614000](0007/bls-D614000.webp) | Müslikekse glutenfrei | Muesli biscuits gluten-free |
| [bls-D615000](0007/bls-D615000.webp) | Löffelbiskuits glutenfrei | Sponge fingers gluten-free |
| [bls-D616000](0007/bls-D616000.webp) | Haselnussplätzchen glutenfrei | Hazelnut biscuits gluten-free |
| [bls-D617000](0007/bls-D617000.webp) | Waffeln (Rührmasse) glutenfrei  | Waffles (cake batter) gluten-free |
| [bls-D618000](0007/bls-D618000.webp) | Gewürzplätzchen glutenfrei | Spiced biscuits gluten-free |
| [bls-D621000](0007/bls-D621000.webp) | Waffeln, einfache (Rührmasse) | Waffles (cake batter) |
| [bls-D621100](0007/bls-D621100.webp) | Eiswaffeln/Waffelhörnchen (Rührmasse) | Ice cream cones |
| [bls-D621200](0007/bls-D621200.webp) | Waffelkekse | Waffle biscuits |
| [bls-D621300](0007/bls-D621300.webp) | Waffelkekse schokoliert | Waffle biscuits with chocolate icing |
| [bls-D621800](0007/bls-D621800.webp) | Sahnewaffeln (Rührmasse) | Cream waffle (cake batter) |
| [bls-D623000](0007/bls-D623000.webp) | Marmorwaffeln (Rührmasse) | Marble waffles (cake batter) |
| [bls-D623100](0007/bls-D623100.webp) | Sandwaffeln (Rührmasse) | Waffles (sand cake batter) |
| [bls-D623200](0007/bls-D623200.webp) | Apfelwaffeln (Rührmasse) | Apple waffles (cake batter) |
| [bls-D623400](0007/bls-D623400.webp) | Schinkenwaffeln (Rührmasse) | Ham waffles (cake batter) |
| [bls-D623500](0007/bls-D623500.webp) | Käsewaffeln salzig (Rührmasse) | Cheese waffles salted (cake batter) |
| [bls-D630400](0007/bls-D630400.webp) | Butterkekse/Butterplätzchen (Mürbeteig) | Shortbread biscuits |
| [bls-D630500](0007/bls-D630500.webp) | Butterkekse/Butterplätzchen (Mürbeteig) schokoliert | Shortbread biscuits, with chocolate icing |
| [bls-D630600](0007/bls-D630600.webp) | Doppelkekse mit Kakaocremefüllung | Shortcake biscuits sandwiched with cocoa-cream filling |
| [bls-D630700](0007/bls-D630700.webp) | Waffelkekse mit Nougatfüllung | Wafer biscuits with nougat filling |
| [bls-D630800](0007/bls-D630800.webp) | Waffelkekse mit Nuss-Nougatcremefüllung, schokoliert | Waffle biscuits with chocolate nut filling and chocolate icing |
| [bls-D650100](0007/bls-D650100.webp) | Dominosteine | Domino dices (petit fours) |
| [bls-D650200](0007/bls-D650200.webp) | Weiße Lebkuchen | White gingerbread |
| [bls-D650400](0007/bls-D650400.webp) | Elisenlebkuchen | Elisen gingerbread (with at least 25 % almonds and hazelnuts) |
| [bls-D650500](0007/bls-D650500.webp) | Feine Oblaten-Lebkuchen | Gingerbread on baking wafers |
| [bls-D650600](0007/bls-D650600.webp) | Lebkuchen schokoliert | Chocolate gingerbread |
| [bls-D651300](0007/bls-D651300.webp) | Printen | "Printen" brown gingerbread biscuits |
| [bls-D651400](0007/bls-D651400.webp) | Nussprinten schokoliert | Nut printen with chocolate icing |
| [bls-D651500](0007/bls-D651500.webp) | Printen schokoliert | Chocolate printen |
| [bls-D651700](0007/bls-D651700.webp) | Backoblaten | Round baking wafers |
| [bls-D652300](0007/bls-D652300.webp) | Pfeffernüsse | "Pfeffernusse" spiced gingerbread biscuits with sugar icing |
| [bls-D652400](0007/bls-D652400.webp) | Nürnberger Lebkuchen | Nuremberg gingerbread |
| [bls-D653100](0007/bls-D653100.webp) | Liegnitzer | "Liegnitzer" filled gingerbread with chocolate icing |
| [bls-D655100](0007/bls-D655100.webp) | Feiner Honigkuchen | Fine gingerbread cake |
| [bls-D655200](0007/bls-D655200.webp) | Ostpreußischer Honigkuchen | East-Prussian gingerbread cake |
| [bls-D655400](0007/bls-D655400.webp) | Dicker Honigkuchen | Thick gingerbread cake |
| [bls-D655500](0007/bls-D655500.webp) | Pfefferkuchen | Spiced gingerbread |
| [bls-D655600](0007/bls-D655600.webp) | Sirupkuchen | Syrup cake |
| [bls-D657100](0007/bls-D657100.webp) | Kathrinchen (Honigteigplätzchen) | "Kathrinchen" honey gingerbread biscuits |
| [bls-D657200](0007/bls-D657200.webp) | Honigkuchenplätzchen | Gingerbread cake biscuits |
| [bls-D657300](0007/bls-D657300.webp) | Pflastersteine | "Pflastersteine" thick convex gingerbread biscuits |
| [bls-D657400](0007/bls-D657400.webp) | Honigkuchenhäufchen | Gingerbread cake mounds |
| [bls-D660100](0007/bls-D660100.webp) | Makronen/Mandelmakronen | Macaroons |
| [bls-D660200](0007/bls-D660200.webp) | Marzipanmakronen | Marzipan macaroons |
| [bls-D660300](0007/bls-D660300.webp) | Kokosmakronen | Coconut macaroons |
| [bls-D660500](0007/bls-D660500.webp) | Kokosmakronen schokoliert | Chocolate coconut macaroons |
| [bls-D660600](0007/bls-D660600.webp) | Schokoladen-Haselnussmakronen | Chocolate hazelnut macaroons |
| [bls-D660700](0007/bls-D660700.webp) | Haselnussmakronen | Hazelnut macaroons |
| [bls-D660800](0007/bls-D660800.webp) | Schokoladen-Makronen | Chocolate macaroons |
| [bls-D661100](0007/bls-D661100.webp) | Marzipan-Monde | Marzipan moons |
| [bls-D6A1000](0007/bls-D6A1000.webp) | Basler Leckerli | Basler Leckerli (hard spice biscuit) |
| [bls-D6A2000](0007/bls-D6A2000.webp) | Baumkuchenspitzen | Spit cake tips |
| [bls-D6A3000](0007/bls-D6A3000.webp) | Braune Lebkuchen unglasiert | Brown gingerbread without icing |
| [bls-D6A4000](0007/bls-D6A4000.webp) | Florentiner (Mandelmasse) | Florentine biscuits (almond mass) |
| [bls-D6A5000](0007/bls-D6A5000.webp) | Honigkuchen schokoliert | Gingerbread cake with chocolate icing |
| [bls-D6A6000](0007/bls-D6A6000.webp) | Lebkuchen mit Fruchtfüllung, schokoliert | Gingerbread with fruit filling and chocolate icing |

## Tanda 0008: galletas, choux y bollería

100 imágenes nuevas desde `bls-D6A7000` hasta `bls-D7A4000`: galletas de avena,
almendra y bizcocho; fruta rebozada, choux, pastas de masa quebrada, bollería
de levadura y hojaldre, cruasanes rellenos, cookies, scones y muffins.
Se conservan los nombres oficiales DE/EN y se registra cada prompt exacto,
referencia, huella de nombre y SHA-256 de la imagen final. Cada alimento tiene
su propia generación integrada de Codex.

Las variantes sin relleno se muestran vacías; las rellenas presentan el corte.
Se distinguen las masas quebrada, choux, levadura, hojaldre y hojaldre de levadura.
No se representan propiedades invisibles como gluten, proteína o veganismo
mediante símbolos. El aspecto es ilustrativo: no acredita una receta BLS,
alérgenos, composición exacta ni una ración de 100 g. No hay integración móvil.

Apoyo editorial para las formas menos conocidas: [Zedernbrot](https://www.oetker.de/rezepte/r/zedernbrot),
[Springerle](https://www.oetker.de/rezepte/r/springerle),
[Flockentorte](https://www.oetker.de/rezepte/r/flockentorte) y
[Heidesand](https://www.oetker.de/rezepte/r/heidesand) de Dr. Oetker;
[Raspeli de su autor](https://www.kochbar.de/rezept/453496/Raspeli.html),
[Dreispitze de su autora](https://www.chefkoch.de/rezepte/3597641541005149/Haselnuss-Dreispitze-fuer-den-Adventskaffee.html) y
[Hobelspäne de Kaufland](https://filiale.kaufland.de/rezepte/rezeptsuche/rezept.hobelspaene.r_id%3DDE_KO-R-24-25.html).
Estas fuentes sirven para una interpretación visual genérica, no para sustituir
los nombres oficiales ni trasladar ingredientes de recetas externas al catálogo.
No se copiaron sus fotografías. La muestra CIQUAL es solo referencia de estilo.

Revisión: todos los WebP finales en nueve hojas y nueve casos a tamaño completo.
Se regeneraron el cuerno de frutos secos `bls-D740500` y la espiral con crumble
`bls-D750200`: las primeras salidas parecían hojaldre y las finales muestran
miga de bollo y corteza lisa, acordes con la masa de levadura de sus nombres.
Los prompts anteriores y los hashes de sus PNG constan en el manifiesto.
El estado sigue siendo `pending-review` hasta la revisión del mantenedor.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0008-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0008-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0008-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0008-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0008-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0008-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0008-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0008-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0008-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-D6A7000](0008/bls-D6A7000.webp) | Mandelbrot (mit Eiklar, ohne Fett zubereitet) | Almond bread (prepared with egg white, without fat) |
| [bls-D6A8000](0008/bls-D6A8000.webp) | Biskuitboden glutenfrei | Sponge cake base gluten-free |
| [bls-D6A9000](0008/bls-D6A9000.webp) | Englischer Teekuchen glutenfrei | English tea cake gluten-free |
| [bls-D701400](0008/bls-D701400.webp) | Zedernbrot | "Zedernbrot" lemon almond biscuits |
| [bls-D701500](0008/bls-D701500.webp) | Raspeli | "Raspeli" meringue with cocoa powder and coconut |
| [bls-D701600](0008/bls-D701600.webp) | Haferflockenplätzchen | Oatmeal biscuits |
| [bls-D701700](0008/bls-D701700.webp) | Haferflocken-Nussplätzchen | Oatmeal-nut biscuits |
| [bls-D701800](0008/bls-D701800.webp) | Springerle | "Springerle" anise biscuits |
| [bls-D702000](0008/bls-D702000.webp) | Baklava | "Baklava" filled puff pastry |
| [bls-D705200](0008/bls-D705200.webp) | Aprikosen im Ausbackteig frittiert | Apricots in frying batter deep-fried |
| [bls-D705300](0008/bls-D705300.webp) | Apfelküchlein/Apfelringe im Ausbackteig, frittiert | Apple slices in frying batter, deep-fried |
| [bls-D705400](0008/bls-D705400.webp) | Bananen im Ausbackteig frittiert | Bananas in frying batter deep-fried |
| [bls-D710100](0008/bls-D710100.webp) | Schokoladen-Biskuitplätzchen | Chocolate sponge biscuits |
| [bls-D710200](0008/bls-D710200.webp) | Löffelbiskuits | Sponge fingers |
| [bls-D710300](0008/bls-D710300.webp) | Biskuitplätzchen | Small sponge biscuits |
| [bls-D710500](0008/bls-D710500.webp) | Anisplätzchen (Biskuitmasse) | Anise sponge biscuits |
| [bls-D710700](0008/bls-D710700.webp) | Schokoladen-Biskuitplätzchen mit Nougatfüllung | Chocolate sponge biscuits with nougat filling |
| [bls-D710800](0008/bls-D710800.webp) | Schokoladen-Haselnuss-Cookies | Chocolate-hazelnut cookies |
| [bls-D711100](0008/bls-D711100.webp) | Orangenbiskuitplätzchen | Orange sponge biscuits |
| [bls-D712000](0008/bls-D712000.webp) | Kekse/Plätzchen, eiweißarm | Biscuits low protein |
| [bls-D720200](0008/bls-D720200.webp) | Sahne-Windbeutel (Brandmasse) | Cream puff (choux pastry) |
| [bls-D720300](0008/bls-D720300.webp) | Sahne-Eclairs (Brandmasse) | Cream éclairs (choux pastry) |
| [bls-D720400](0008/bls-D720400.webp) | Brandmasse/Brandteig, gebacken | Choux pastry baked |
| [bls-D720500](0008/bls-D720500.webp) | Sahne-Windbeutel (Brandmasse) mit Kirschen | Cream puff (choux pastry) filled with cherries |
| [bls-D720600](0008/bls-D720600.webp) | Flockentorte (Brandmasse und Mürbeteig) | "Flockentorte" layer torte (choux pastry) |
| [bls-D720700](0008/bls-D720700.webp) | Preiselbeer-Stracciatella-Sahne-Kranz (Brandmasse) | Lingonberry-stracciatella-cream ring cake (choux pastry) |
| [bls-D720800](0008/bls-D720800.webp) | Käsewindbeutel salzig (Brandmasse) ungefüllt | Cheese puffs salted (choux pastry) unfilled |
| [bls-D721100](0008/bls-D721100.webp) | Eberswalder Spritzkuchen (Brandmasse) frittiert | "Eberswalder" french crullers (choux pastry) deep-fried |
| [bls-D730300](0008/bls-D730300.webp) | Spritzgebäck mit Mandeln (Rührmasse) | Spritz biscuits with almonds (cake batter) |
| [bls-D730600](0008/bls-D730600.webp) | Spekulatius (Mürbeteig) | "Spekulatius" spiced almond biscuits (shortcrust pastry) |
| [bls-D730700](0008/bls-D730700.webp) | Käseplätzchen salzig (Mürbeteig) | Shortcake cheese biscuits salted |
| [bls-D730800](0008/bls-D730800.webp) | Teegebäck (Mürbeteig) | Tea biscuits (shortcrust pastry) |
| [bls-D730900](0008/bls-D730900.webp) | Fettgebäck (Mürbeteig) frittiert | Pastries (shortcrust pastry) deep-fried |
| [bls-D731200](0008/bls-D731200.webp) | Apple-Pie (Mürbeteig) | Apple pie (shortcrust pastry) |
| [bls-D732100](0008/bls-D732100.webp) | Vanille-Mürbchen (Mürbeteig) | Vanilla shortcrust pastry biscuit |
| [bls-D733100](0008/bls-D733100.webp) | Nusstaler (Mürbeteig) | Nut rounds (shortcrust pastry) |
| [bls-D733200](0008/bls-D733200.webp) | Streuselplätzchen (Mürbeteig) | Crumble biscuits (shortcrust pastry) |
| [bls-D733500](0008/bls-D733500.webp) | Schwarz-Weiß-Gebäck (Mürbeteig) | Black-and-white chequerboard biscuits (shortcrust pastry) |
| [bls-D733600](0008/bls-D733600.webp) | Nussecken (Mürbeteig) | Nut triangles (shortcrust pastry) |
| [bls-D733800](0008/bls-D733800.webp) | Mandelgebäck (Mürbeteig) | Almond biscuits (shortcrust pastry) |
| [bls-D734600](0008/bls-D734600.webp) | Buttergebäck (Mürbeteig) | Butter biscuits (shortcrust pastry) |
| [bls-D734700](0008/bls-D734700.webp) | Husarenkrapfen (Mürbeteig) | "Husaren" biscuits (shortcrust pastry) filled with jam |
| [bls-D734800](0008/bls-D734800.webp) | Haselnusskugeln (Mürbeteig) | Hazelnut balls (shortcrust pastry) |
| [bls-D734900](0008/bls-D734900.webp) | Nussstangen (Mürbeteig) | Nut sticks (shortcrust pastry) |
| [bls-D735100](0008/bls-D735100.webp) | Spitzbuben (Mürbeteig) | "Spitzbuben" sandwich biscuit (shortcrust pastry) filled with jam |
| [bls-D735200](0008/bls-D735200.webp) | Orangentäschchen (Mürbeteig) | Small orange turnovers (shortcrust pastry) |
| [bls-D735300](0008/bls-D735300.webp) | Haselnuss-Dreispitz (Mürbeteig) | "Dreispitz" hazelnut biscuits (shortcrust pastry) |
| [bls-D736100](0008/bls-D736100.webp) | Käseknusperchen salzig (Mürbeteig) | Crispy cheese biscuits salted (shortcrust pastry) |
| [bls-D740100](0008/bls-D740100.webp) | Mandel-Marzipan-Donuts (Hefeteig) frittiert | Almond-marzipan doughnuts (yeast dough) deep-fried |
| [bls-D740400](0008/bls-D740400.webp) | Kartoffelhörnchen (Mürbeteig) | Potato crescent roll (shortcrust pastry) |
| [bls-D740500](0008/bls-D740500.webp) | Nusshörnchen (Hefeteig) | Nut crescent roll (yeast dough) |
| [bls-D740600](0008/bls-D740600.webp) | Wiener Hörnchen (Hefeteig) | Viennese crescent roll (yeast dough) |
| [bls-D741000](0008/bls-D741000.webp) | Donut (Hefeteig) frittiert, mit Schokoladenglasur | Doughnut (yeast dough) deep-fried, with chocolate icing |
| [bls-D741400](0008/bls-D741400.webp) | Buchteln (Hefeteig) | "Buchteln" baked yeast buns |
| [bls-D741600](0008/bls-D741600.webp) | Donut (Hefeteig) frittiert | Doughnut (yeast dough) deep-fried |
| [bls-D750100](0008/bls-D750100.webp) | Amerikaner (Rührmasse) | "Amerikaner" moist shortbread biscuit (cake batter) with sugar icing |
| [bls-D750200](0008/bls-D750200.webp) | Streuselschnecken (Hefeteig) | Danish swirl (yeast dough) with crumbles |
| [bls-D750300](0008/bls-D750300.webp) | Ausgezogene Nudeln/Knienudeln (Hefeteig) frittiert | Bavarian doughnuts (yeast dough) deep-fried |
| [bls-D750600](0008/bls-D750600.webp) | Heidesand (Mürbeteig) | "Heidesand" biscuits (shortcrust pastry) |
| [bls-D750700](0008/bls-D750700.webp) | Marzipanstangen (Rührmasse) | Marzipan sticks (cake batter) |
| [bls-D751100](0008/bls-D751100.webp) | Hobelspäne/Räderkuchen (Rührmasse) frittiert | "Hobelspäne" pastry (cake batter) deep-fried |
| [bls-D752100](0008/bls-D752100.webp) | Rosinen-Mandel-Schnecken (Hefeteig) | Danish swirl (yeast dough) with raisins and almonds |
| [bls-D753100](0008/bls-D753100.webp) | Nuss-Spritzgebäck (Rührmasse) | Nut spritz biscuits (cake batter) |
| [bls-D753200](0008/bls-D753200.webp) | Kokosschnitten (Rührmasse) | Coconut square (cake batter) |
| [bls-D753500](0008/bls-D753500.webp) | Vanillehörnchen/Vanillekipferl (Mürbeteig) | Vanilla crescents (shortcrust pastry) |
| [bls-D753600](0008/bls-D753600.webp) | Mandel-Zitronen-Herzen (ohne Fett und Mehl) | Heart-shaped almond lemon biscuits (without fat and flour) |
| [bls-D754100](0008/bls-D754100.webp) | Rheinische Mutzen (Nudelteig) frittiert | "Rheinische Mutzen" pastry (pasta dough) deep-fried |
| [bls-D755200](0008/bls-D755200.webp) | Mandelkränzchen (Rührmasse) | Almond ring cake (cake batter) |
| [bls-D755300](0008/bls-D755300.webp) | Mandelhörnchen (Rührmasse) | Almond crescent roll (cake batter) |
| [bls-D770100](0008/bls-D770100.webp) | Mohnschnecken (Blätterteig) | Danish swirl (puff pastry) with poppy seeds |
| [bls-D770200](0008/bls-D770200.webp) | Käsegebäck salzig (Quarkmürbeteig) | Cheese pastry salted (shortcrust pastry with quark) |
| [bls-D770300](0008/bls-D770300.webp) | Schweineohren/Schweinsohren (Blätterteig) | Pig ear pastry (puff pastry) |
| [bls-D770400](0008/bls-D770400.webp) | Feingebäck (Blätterteig) schokoliert | Fine pastry (puff pastry) with chocolate icing |
| [bls-D770800](0008/bls-D770800.webp) | Kaffeegebäck (Quarkblätterteig) | Coffee pastry (puff pastry with quark) |
| [bls-D771100](0008/bls-D771100.webp) | Erdbeer-Sahneschnitten (Blätterteig) | Strawberry-cream square (puff pastry) |
| [bls-D771200](0008/bls-D771200.webp) | Aprikosenteilchen (Blätterteig) | Apricot pastry (puff pastry) |
| [bls-D771300](0008/bls-D771300.webp) | Pasteten (Blätterteig) mit Himbeersahne | Raspberry cream in vol-au-vent (puff pastry) |
| [bls-D771400](0008/bls-D771400.webp) | Schuhsohlen (Blätterteig) mit Mokkasahne | Oblong mocha-cream filled pastry (puff pastry) |
| [bls-D771500](0008/bls-D771500.webp) | Hörnchen (Blätterteig) | Crescent roll (puff pastry) |
| [bls-D771600](0008/bls-D771600.webp) | Croissant (Hefeblätterteig/Plunderteig) | Danish pastry croissant |
| [bls-D771700](0008/bls-D771700.webp) | Croissant (Hefeblätterteig/Plunderteig) gefüllt mit Nuss-Nougat-Creme | Danish pastry croissant, filled with nut nougat cream |
| [bls-D771800](0008/bls-D771800.webp) | Croissant (Hefeblätterteig/Plunderteig) gefüllt mit Marzipan | Danish pastry croissant, filled with marzipan |
| [bls-D771900](0008/bls-D771900.webp) | Brötchen (Blätterteig) | Puff pastry roll |
| [bls-D772100](0008/bls-D772100.webp) | Schinkenhörnchen (Quarkblätterteig) | Ham crescent (puff pastry) |
| [bls-D780300](0008/bls-D780300.webp) | Nuss-Plunder | Hazelnut Danish pastry |
| [bls-D780500](0008/bls-D780500.webp) | Marzipan-Plunder | Danish pastry with marzipan |
| [bls-D790100](0008/bls-D790100.webp) | Kekse/Plätzchen, salzig (Vollkornmürbeteig) | Wholemeal biscuits, salted |
| [bls-D790300](0008/bls-D790300.webp) | Kekse/Plätzchen (Vollkornmürbeteig) schokoliert | Wholemeal biscuits with chocolate icing |
| [bls-D790700](0008/bls-D790700.webp) | Kekse/Plätzchen (Vollkornmürbeteig) | Wholemeal biscuits |
| [bls-D793100](0008/bls-D793100.webp) | Müslikekse (Vollkornmürbeteig) | Wholemeal muesli biscuits (shortcrust pastry) |
| [bls-D7A1000](0008/bls-D7A1000.webp) | Biskuitplätzchen mit Fruchtfüllung schokoliert | Sponge cake biscuits with fruit filling and chocolate icing |
| [bls-D7A1100](0008/bls-D7A1100.webp) | Biskuitplätzchen mit Nougatfüllung | Sponge cake biscuits with nougat filling |
| [bls-D7A1200](0008/bls-D7A1200.webp) | Biskuitplätzchen schokoliert | Sponge cake biscuits with chocolate icing |
| [bls-D7A2000](0008/bls-D7A2000.webp) | Cookies mit Schokoladenstückchen | Chocolate chip cookies |
| [bls-D7A2100](0008/bls-D7A2100.webp) | Schokoladen-Mandel-Cookies vegan | Chocolate almond cookies vegan |
| [bls-D7A2200](0008/bls-D7A2200.webp) | Erdnussplätzchen (Mürbeteig) | Peanut biscuits (shortcrust pastry) |
| [bls-D7A2300](0008/bls-D7A2300.webp) | Schokoladenbrezeln (Mürbeteig) | Chocolate pretzels (shortcrust pastry) |
| [bls-D7A3000](0008/bls-D7A3000.webp) | Scones (britisches Kleingebäck) | Scones (British) |
| [bls-D7A3100](0008/bls-D7A3100.webp) | Muffins vegan (Rührmasse) | Muffins vegan (cake batter) |
| [bls-D7A4000](0008/bls-D7A4000.webp) | Käsewindbeutel (Brandmasse) gefüllt mit Frischkäsezubereitung | Salty cheese puff (choux pastry) filled with cream cheese |

## Tanda 0009: bollería, masas integrales y huevos

100 imágenes nuevas desde `bls-D7A5000` hasta `bls-E113100`: bollería de
levadura, Berliner con distintos rellenos, Plunder, galletas rellenas y bañadas,
masas y repostería integrales, huevos de codorniz y gallina, claras y yemas.
Cada alimento tiene su propia generación integrada de Codex. El manifiesto
conserva nombres oficiales DE/EN literales, prompt exacto, referencia, huella
de nombres y SHA-256 del WebP final.

Se distinguen las masas crudas, mates y sin corteza, de sus variantes horneadas.
La bollería de levadura tiene miga de bollo; Plunder y hojaldre tienen capas
laminadas. Los Berliner vacíos se muestran sin relleno y los rellenos, con corte.
Las variantes integrales muestran salvado; no se usan símbolos para propiedades
invisibles. Claras y yemas aparecen separadas cuando lo indica el nombre, y
polvo fino y yema seca en escamas tienen texturas diferentes.

Como apoyo editorial se consultaron [Franzbrötchen](https://www.oetker.de/rezepte/r/franzbroetchen)
y [Kalter Hund](https://www.oetker.de/rezepte/r/kalter-hund) de Dr. Oetker y
[Friesenkekse de Diamant](https://www.diamant-zucker.de/alle-rezepte/backen/kekse/friesenkekse).
Estas recetas orientan formas genéricas; no sustituyen los nombres BLS ni
acreditan ingredientes, alérgenos, composición o una ración de 100 g. No se
copiaron sus fotografías. Las referencias CIQUAL se usan solo para el estilo.

Revisión: todos los WebP finales en nueve láminas; 10 casos a tamaño completo.
Correcciones registradas: 0. El estado sigue siendo `pending-review`
hasta la revisión del mantenedor. BLS permanece fuera de la app.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0009-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0009-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0009-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0009-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0009-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0009-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0009-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0009-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0009-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-D7A5000](0009/bls-D7A5000.webp) | Apfeltaschen (Hefeteig) | Turnover (yeast dough) filled with apples |
| [bls-D7A5100](0009/bls-D7A5100.webp) | Nuss-Schnecken (Hefeteig) | Danish swirl (yeast dough) with nuts |
| [bls-D7A5200](0009/bls-D7A5200.webp) | Puddingschnecken (Hefeteig) | Danish swirl (yeast dough) with pudding |
| [bls-D7A5300](0009/bls-D7A5300.webp) | Zimtschnecken (Hefeteig) | Danish swirl (yeast dough) with cinnamon |
| [bls-D7A5400](0009/bls-D7A5400.webp) | Milchbrötchen (Hefeteig) | Milk roll (yeast dough) |
| [bls-D7A5500](0009/bls-D7A5500.webp) | Rosinenbrötchen (Hefeteig) | Roll with raisins (yeast dough) |
| [bls-D7A5600](0009/bls-D7A5600.webp) | Schokobrötchen (Hefeteig) | Roll with chocolate chips (yeast dough) |
| [bls-D7A6000](0009/bls-D7A6000.webp) | Berliner/Pfannkuchen/Krapfen (Hefeteig) frittiert, ungefüllt | "Berliner" doughnut (yeast dough) deep-fried, unfilled |
| [bls-D7A6100](0009/bls-D7A6100.webp) | Berliner/Pfannkuchen/Krapfen (Hefeteig) frittiert, gefüllt mit Eierlikörcreme | "Berliner" doughnut (yeast dough) deep-fried, filled with egg liqueur cream |
| [bls-D7A6200](0009/bls-D7A6200.webp) | Berliner/Pfannkuchen/Krapfen (Hefeteig) frittiert, gefüllt mit Konfitüre | "Berliner" doughnut (yeast dough) deep-fried, filled with jam |
| [bls-D7A6300](0009/bls-D7A6300.webp) | Berliner/Pfannkuchen/Krapfen (Hefeteig) frittiert, gefüllt mit Nuss-Nougat-Creme | "Berliner" doughnut (yeast dough) deep-fried, filled with nut nougat cream |
| [bls-D7A6400](0009/bls-D7A6400.webp) | Berliner/Pfannkuchen/Krapfen (Hefeteig) frittiert, gefüllt mit Pflaumenmus | "Berliner" doughnut (yeast dough) deep-fried, filled with plum jam |
| [bls-D7A6500](0009/bls-D7A6500.webp) | Berliner/Pfannkuchen/Krapfen (Hefeteig) frittiert, gefüllt mit Pudding | "Berliner" doughnut (yeast dough) deep-fried, filled with pudding |
| [bls-D7A6600](0009/bls-D7A6600.webp) | Quarkbällchen (Hefeteig) frittiert | Quark balls (yeast dough) deep-fried |
| [bls-D7A6700](0009/bls-D7A6700.webp) | Langos (Hefeteig) frittiert, ungefüllt | Langos (yeast dough) deep-fried, unfilled |
| [bls-D7A7000](0009/bls-D7A7000.webp) | Plunderteig roh | Danish pastry raw |
| [bls-D7A7100](0009/bls-D7A7100.webp) | Plunderteig gebacken | Danish pastry baked |
| [bls-D7A7200](0009/bls-D7A7200.webp) | Franzbrötchen (Plunderteig) | "Franzbrötchen" Danish pastry, filled with cinnamon-sugar |
| [bls-D7A7300](0009/bls-D7A7300.webp) | Mohn-Plunder | Danish pastry with poppy seeds |
| [bls-D7A7400](0009/bls-D7A7400.webp) | Pudding-Plunder | Danish pastry with pudding |
| [bls-D7A7410](0009/bls-D7A7410.webp) | Pudding-Frucht-Plunder | Danish pastry with pudding and fruit |
| [bls-D7A7420](0009/bls-D7A7420.webp) | Pudding-Plunder belegt mit Früchten und Klarguss | Danish pastry with pudding, fruit and gelatin glaze |
| [bls-D7A7430](0009/bls-D7A7430.webp) | Pudding-Plunder belegt mit Früchten, Klarguss und Sahne | Danish pastry with pudding, fruit, gelatin glaze and whipped cream |
| [bls-D7A7500](0009/bls-D7A7500.webp) | Quark-Plunder | Danish pastry with quark |
| [bls-D7A7510](0009/bls-D7A7510.webp) | Quark-Frucht-Plunder | Danish pastry with quark and fruit |
| [bls-D7A7600](0009/bls-D7A7600.webp) | Schoko-Plunder | Danish pastry with chocolate |
| [bls-D7A7700](0009/bls-D7A7700.webp) | Kalter Hund (Kekskuchen ohne Backen) | "Kalter Hund" biscuits cake without baking |
| [bls-D7A7800](0009/bls-D7A7800.webp) | Apfeltasche (Blätterteig) | Turnover (puff pastry) filled with apples |
| [bls-D7A7810](0009/bls-D7A7810.webp) | Kirschtasche (Blätterteig) | Turnover (puff pastry) filled with cherries |
| [bls-D7B1000](0009/bls-D7B1000.webp) | Buttergebäck (Mürbeteig) mit Cremefüllung | Butter biscuits (shortcrust pastry) with cream filling |
| [bls-D7B1100](0009/bls-D7B1100.webp) | Buttergebäck kakaohaltig (Mürbeteig) | Butter biscuits containing cocoa (shortcrust pastry) |
| [bls-D7B2000](0009/bls-D7B2000.webp) | Butterkekse/Butterplätzchen (Mürbeteig) mit Nougatfüllung | Shortbread biscuits with nougat filling |
| [bls-D7B2100](0009/bls-D7B2100.webp) | Butterkekse/Butterplätzchen (Mürbeteig) mit Nougatfüllung, schokoliert | Shortbread biscuits with nougat filling and chocolate icing |
| [bls-D7B3000](0009/bls-D7B3000.webp) | Butterkekse/Butterplätzchen, kakaohaltig (Mürbeteig) | Shortbread biscuits, containing cocoa |
| [bls-D7B3100](0009/bls-D7B3100.webp) | Butterkekse/Butterplätzchen, kakaohaltig (Mürbeteig) mit Nougatfüllung | Shortbread biscuits, containing cocoa, with nougat filling |
| [bls-D7B3200](0009/bls-D7B3200.webp) | Butterkekse/Butterplätzchen, kakaohaltig (Mürbeteig) mit Nougatfüllung, schokoliert | Shortbread biscuits, containing cocoa, with nougat filling and chocolate icing |
| [bls-D7B4000](0009/bls-D7B4000.webp) | Friesenkekse (Mürbeteig) | "Friesenkekse" biscuits (shortrcrust pastry) |
| [bls-D7B5000](0009/bls-D7B5000.webp) | Kekse/Plätzchen, kakaohaltig (Rührmasse) | Biscuits, containig cocoa (cake batter) |
| [bls-D7B5100](0009/bls-D7B5100.webp) | Kekse/Plätzchen, kakaohaltig (Rührmasse) schokoliert | Biscuits, containig cocoa (cake batter) with chocolate icing |
| [bls-D7B5200](0009/bls-D7B5200.webp) | Kekse/Plätzchen, kakaohaltig (Rührmasse) mit Nougatfüllung | Biscuits, containig cocoa (cake batter) with nougat filling |
| [bls-D7B5300](0009/bls-D7B5300.webp) | Kekse/Plätzchen, kakaohaltig (Rührmasse) mit Nougatfüllung, schokoliert | Biscuits, containig cocoa (cake batter) with nougat filling and chocolate icing |
| [bls-D7B6000](0009/bls-D7B6000.webp) | Mürbchen (Mürbeteig) schokoliert | Shortcrust pastry biscuit with chocolate icing |
| [bls-D7B6100](0009/bls-D7B6100.webp) | Mürbchen (Mürbeteig) mit Nougatfüllung | Shortcrust pastry biscuit with nougat filling |
| [bls-D7B6200](0009/bls-D7B6200.webp) | Mürbchen (Mürbeteig) mit Nougatfüllung, schokoliert | Shortcrust pastry biscuit with nougat filling and chocolate icing |
| [bls-D7B7000](0009/bls-D7B7000.webp) | Nuss-Spritzgebäck (Rührmasse) schokoliert | Nut spritz biscuits (cake batter) with chocolate icing |
| [bls-D7B7100](0009/bls-D7B7100.webp) | Nuss-Spritzgebäck (Rührmasse) mit Nougatfüllung | Nut spritz biscuits (cake batter) with nougat filling |
| [bls-D7B7200](0009/bls-D7B7200.webp) | Nuss-Spritzgebäck (Rührmasse) mit Nougatfüllung, schokoliert | Nut spritz biscuits (cake batter) with nougat filling and chocolate icing |
| [bls-D7B8000](0009/bls-D7B8000.webp) | Spritzgebäck (Rührmasse) | Spritz biscuits (cake batter) |
| [bls-D7B8100](0009/bls-D7B8100.webp) | Spritzgebäck (Rührmasse) schokoliert | Spritz biscuits (cake batter) with chocolate icing |
| [bls-D7B8200](0009/bls-D7B8200.webp) | Spritzgebäck (Rührmasse) mit Nougatfüllung | Spritz biscuits (cake batter) with nougat filling |
| [bls-D7B8300](0009/bls-D7B8300.webp) | Spritzgebäck (Rührmasse) mit Nougatfüllung, schokoliert | Spritz biscuits (cake batter) with nougat filling and chocolate icing |
| [bls-D9A1000](0009/bls-D9A1000.webp) | Vollkornblätterteig eifrei, roh | Wholemeal puff pastry egg-free, raw |
| [bls-D9A1100](0009/bls-D9A1100.webp) | Vollkornblätterteig eifrei, gebacken | Wholemeal puff pastry egg-free, baked |
| [bls-D9A2000](0009/bls-D9A2000.webp) | Vollkornhefeteig süß roh | Wholemeal yeast dough, sweetened, raw |
| [bls-D9A2100](0009/bls-D9A2100.webp) | Vollkornhefeteig süß gebacken | Wholemeal yeast dough, sweetened, baked |
| [bls-D9A2200](0009/bls-D9A2200.webp) | Apfel-Streuselkuchen (Vollkornhefeteig) | Wholemeal apple crumble cake (yeast dough) |
| [bls-D9A2300](0009/bls-D9A2300.webp) | Käsekuchen (Vollkornhefeteig) | Wholemeal cheesecake (yeast dough) |
| [bls-D9A2400](0009/bls-D9A2400.webp) | Stollen (Vollkornhefeteig) | Wholemeal yeast stollen |
| [bls-D9A2500](0009/bls-D9A2500.webp) | Vollkornhefezopf | Wholemeal braided yeast bread |
| [bls-D9A3000](0009/bls-D9A3000.webp) | Vollkornmürbeteig süß roh | Wholemeal shortcrust pastry, sweetened, raw |
| [bls-D9A3100](0009/bls-D9A3100.webp) | Vollkornmürbeteig süß gebacken | Wholemeal shortcrust pastry, sweetened, baked |
| [bls-D9A3200](0009/bls-D9A3200.webp) | Apfelkuchen gedeckt (Vollkornmürbeteig) | Wholemeal apple pie (shortcrust pastry) |
| [bls-D9A3300](0009/bls-D9A3300.webp) | Käsekuchen (Vollkornmürbeteig) | Wholemeal cheesecake (shortcrust pastry) |
| [bls-D9A4000](0009/bls-D9A4000.webp) | Vollkornplunderteig roh | Wholemeal Danish pastry dough, raw |
| [bls-D9A4100](0009/bls-D9A4100.webp) | Vollkornplunderteig gebacken | Wholemeal Danish pastry dough, baked |
| [bls-D9A4200](0009/bls-D9A4200.webp) | Marzipan-Vollkornplunder | Wholemeal Danish pastry with marzipan |
| [bls-D9A4300](0009/bls-D9A4300.webp) | Mohn-Vollkornplunder | Wholemeal Danish pastry with poppy seed |
| [bls-D9A4400](0009/bls-D9A4400.webp) | Pudding-Vollkornplunder | Wholemeal Danish pastry with pudding |
| [bls-D9A4500](0009/bls-D9A4500.webp) | Pudding-Frucht-Vollkornplunder | Wholemeal Danish pastry with pudding and fruit |
| [bls-D9A4600](0009/bls-D9A4600.webp) | Pudding-Vollkornplunder belegt mit Früchten und Klarguss | Wholemeal Danish pastry with pudding, fruit and gelatin glaze |
| [bls-D9A4700](0009/bls-D9A4700.webp) | Quark-Vollkornplunder | Wholemeal Danish pastry with quark |
| [bls-D9A4800](0009/bls-D9A4800.webp) | Quark-Frucht-Vollkornplunder | Wholemeal Danish pastry with quark and fruit |
| [bls-D9A4900](0009/bls-D9A4900.webp) | Vollkorncroissant (Plunderteig) | Wholemeal Danish pastry croissant |
| [bls-D9A5000](0009/bls-D9A5000.webp) | Vollkornhaselnusskuchen (Rührmasse) | Wholemeal hazelnut cake (cake batter) |
| [bls-D9A5100](0009/bls-D9A5100.webp) | Vollkorn-Marmorkuchen (Rührmasse) | Wholemeal marble cake (cake batter) |
| [bls-D9A5200](0009/bls-D9A5200.webp) | Vollkornsandkuchen (Rührmasse) | Wholemeal sand cake |
| [bls-D9A5300](0009/bls-D9A5300.webp) | Vollkorn-Schoko-Mandelkuchen (Rührmasse) | Wholemeal chocolate almond cake (cake batter) |
| [bls-D9B1000](0009/bls-D9B1000.webp) | Butterkekse/Butterplätzchen, kakaohaltig (Vollkornmürbeteig) | Wholemeal shortbread biscuits, containing cocoa |
| [bls-D9B1100](0009/bls-D9B1100.webp) | Butterkekse/Butterplätzchen, kakaohaltig (Vollkornmürbeteig) mit Nougatfüllung | Wholemeal shortbread biscuits, containing cocoa, with nougat filling |
| [bls-D9B1200](0009/bls-D9B1200.webp) | Kekse/Plätzchen (Vollkornmürbeteig) mit Nougatfüllung | Wholemeal biscuits (shortcrust pastry) with nougat filling |
| [bls-D9B1300](0009/bls-D9B1300.webp) | Kekse/Plätzchen (Vollkornmürbeteig) mit Nougatfüllung, schokoliert | Wholemeal biscuits (shortcrust pastry) with nougat filling and chocolate icing |
| [bls-D9B1400](0009/bls-D9B1400.webp) | Müslikekse/Müsliplätzchen (Vollkornmürbeteig) schokoliert | Wholemeal muesli biscuits (shortcrust pastry) with chocolate icing |
| [bls-D9B1500](0009/bls-D9B1500.webp) | Schoko-Müslikekse/Schoko-Müsliplätzchen (Vollkornmürbeteig) | Wholemeal chocolate muesli biscuits (shortcrust pastry) |
| [bls-E101132](0009/bls-E101132.webp) | Wachtelei gekocht | Quail egg boiled |
| [bls-E105182](0009/bls-E105182.webp) | Wachtelei gebraten ohne Fett (Pfanne) | Quail egg fried without fat (pan) |
| [bls-E106100](0009/bls-E106100.webp) | Wachtelei roh | Quail egg raw |
| [bls-E107122](0009/bls-E107122.webp) | Hühnerei pochiert | Chicken egg poached |
| [bls-E108122](0009/bls-E108122.webp) | Hühnerei Eiklar, pochiert | Chicken egg white, poached |
| [bls-E111100](0009/bls-E111100.webp) | Hühnerei roh | Chicken egg raw |
| [bls-E111132](0009/bls-E111132.webp) | Hühnerei gekocht | Chicken egg boiled |
| [bls-E111162](0009/bls-E111162.webp) | Hühnerei gebacken | Chicken egg baked |
| [bls-E111182](0009/bls-E111182.webp) | Hühnerei gebraten ohne Fett (Pfanne) | Chicken egg fried without fat (pan) |
| [bls-E111500](0009/bls-E111500.webp) | Hühnerei Pulver | Chicken egg powder |
| [bls-E112100](0009/bls-E112100.webp) | Hühnerei Eigelb, roh | Chicken egg yolk, raw |
| [bls-E112132](0009/bls-E112132.webp) | Hühnerei Eigelb, gekocht | Chicken egg yolk, boiled |
| [bls-E112162](0009/bls-E112162.webp) | Hühnerei Eigelb, gebacken | Chicken egg yolk, baked |
| [bls-E112182](0009/bls-E112182.webp) | Hühnerei Eigelb, gebraten ohne Fett (Pfanne) | Chicken egg yolk, fried without fat (pan) |
| [bls-E112400](0009/bls-E112400.webp) | Hühnerei Eigelb, getrocknet | Chicken egg yolk, dried |
| [bls-E112500](0009/bls-E112500.webp) | Hühnerei Eigelb, Pulver | Chicken egg yolk, powder |
| [bls-E113100](0009/bls-E113100.webp) | Hühnerei Eiklar, roh | Chicken egg white, raw |

## Tanda 0010: huevos, pastas, Knödel, zumos y ruibarbo

100 imágenes nuevas desde `bls-E113132` hasta `bls-F081100`: claras, huevos de
pato, oca y pavo, pastas secas y frescas, ravioli y tortellini, Schupfnudeln,
Knödel, zumos, néctares, smoothies y ruibarbo crudo. Cada código tiene su propia
generación integrada de Codex. El manifiesto conserva nombres oficiales DE/EN
literales, prompt exacto, referencia y huellas de nombres y WebP.

Las pastas secas tienen bordes firmes y mates; las frescas crudas son flexibles
y mates; las cocidas están hidratadas. El horneado se distingue por bordes secos
y tostados y el paso por sartén por sus zonas de contacto doradas. No se añade
queso ni salsa a los alimentos que no los nombran. Los ravioli de conserva sí
muestran su salsa de tomate. Los rellenos se ven en cortes. Los Knödel crudos,
secos, rehidratados y cocinados conservan su estado; las claras aparecen sin yema.

Los zumos, néctares y smoothies se muestran en un vaso sencillo, sin envases,
frutas decorativas ni símbolos para vitaminas, minerales o edulcorantes. Estas
propiedades y la ausencia de huevo o gluten no se pueden verificar en la imagen.
Cada variante visualmente parecida se ha generado de forma independiente.

Como apoyo editorial de las formas se consultaron [Schupfnudeln de Küchengötter](https://www.kuechengoetter.de/rezepte/schupfnudeln-63452),
[Böhmische Knödel de REWE](https://www.rewe.de/rezepte/boehmische-knoedel/) y
[Grießklößchen de Dr. Oetker Professional](https://www.oetker-professional.de/produkte/suppeneinlagen/suppeneinlagen-vegetarisch/griesskloesschen-tiefgefroren-1-39-275055).
Son orientación editorial, no la receta de las fichas BLS; no se copiaron sus
fotografías. Las referencias CIQUAL se usan solo para el estilo. Ninguna imagen
acredita ingredientes, alérgenos, composición o una ración de 100 g.

Revisión: todos los WebP finales en nueve láminas; 10 casos a tamaño completo.
Correcciones registradas: 0. El estado sigue siendo `pending-review`
hasta la revisión del mantenedor. BLS permanece fuera de la app.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0010-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0010-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0010-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0010-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0010-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0010-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0010-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0010-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0010-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-E113132](0010/bls-E113132.webp) | Hühnerei Eiklar, gekocht | Chicken egg white, boiled |
| [bls-E113162](0010/bls-E113162.webp) | Hühnerei Eiklar, gebacken | Chicken egg white, baked |
| [bls-E113182](0010/bls-E113182.webp) | Hühnerei Eiklar, gebraten ohne Fett (Pfanne) | Chicken egg white, fried without fat (pan) |
| [bls-E113400](0010/bls-E113400.webp) | Hühnerei Eiklar, getrocknet | Chicken egg white, dried |
| [bls-E113500](0010/bls-E113500.webp) | Hühnerei Eiklar, Pulver | Chicken egg white, powder |
| [bls-E131100](0010/bls-E131100.webp) | Entenei roh | Duck egg raw |
| [bls-E131132](0010/bls-E131132.webp) | Entenei gekocht | Duck egg boiled |
| [bls-E141100](0010/bls-E141100.webp) | Gänseei roh | Goose egg raw |
| [bls-E141132](0010/bls-E141132.webp) | Gänseei gekocht | Goose egg boiled |
| [bls-E151100](0010/bls-E151100.webp) | Putenei roh | Turkey egg raw |
| [bls-E151132](0010/bls-E151132.webp) | Putenei gekocht | Turkey egg boiled |
| [bls-E401000](0010/bls-E401000.webp) | Teigwaren eifrei, roh | Pasta egg-free, raw |
| [bls-E401032](0010/bls-E401032.webp) | Teigwaren eifrei, gekocht | Pasta egg-free, boiled |
| [bls-E401062](0010/bls-E401062.webp) | Teigwaren eifrei, gekocht, gebacken | Pasta egg-free, boiled, baked |
| [bls-E401082](0010/bls-E401082.webp) | Teigwaren eifrei, gekocht, gebraten ohne Fett (Pfanne) | Pasta egg-free, boiled, fried without fat (pan) |
| [bls-E430062](0010/bls-E430062.webp) | Eierteigwaren gekocht, gebacken | Egg pasta boiled, baked |
| [bls-E430082](0010/bls-E430082.webp) | Eierteigwaren gekocht, gebraten ohne Fett (Pfanne) | Egg pasta boiled, fried without fat (pan) |
| [bls-E432000](0010/bls-E432000.webp) | Eierteigwaren roh | Egg pasta raw |
| [bls-E432032](0010/bls-E432032.webp) | Eierteigwaren gekocht | Egg pasta boiled |
| [bls-E438000](0010/bls-E438000.webp) | Eier-Frischteigwaren roh | Fresh egg pasta raw |
| [bls-E438032](0010/bls-E438032.webp) | Eier-Frischteigwaren gekocht | Fresh egg pasta boiled |
| [bls-E438062](0010/bls-E438062.webp) | Eier-Frischteigwaren gekocht, gebacken | Fresh egg pasta boiled, baked |
| [bls-E438082](0010/bls-E438082.webp) | Eier-Frischteigwaren gekocht, gebraten ohne Fett (Pfanne) | Fresh egg pasta boiled, fried without fat (pan) |
| [bls-E470000](0010/bls-E470000.webp) | Eier-Frischteigwaren Ravioli (Gemüsefüllung) roh | Fresh egg pasta Ravioli (vegetable filling) raw |
| [bls-E470032](0010/bls-E470032.webp) | Eier-Frischteigwaren Ravioli (Gemüsefüllung) gekocht | Fresh egg pasta Ravioli (vegetable filling) boiled |
| [bls-E470042](0010/bls-E470042.webp) | Eier-Frischteigwaren Ravioli (Gemüsefüllung) gedämpft | Fresh egg pasta Ravioli (vegetable filling) steamed |
| [bls-E470082](0010/bls-E470082.webp) | Eier-Frischteigwaren Ravioli (Gemüsefüllung) gekocht, gebraten ohne Fett (Pfanne) | Fresh egg pasta Ravioli (vegetable filling) boiled, fried without fat (pan) |
| [bls-E470162](0010/bls-E470162.webp) | Eier-Frischteigwaren Ravioli (Gemüsefüllung) gekocht, gebacken | Fresh egg pasta Ravioli (vegetable filling) boiled, baked |
| [bls-E500032](0010/bls-E500032.webp) | Vollkornteigwaren eifrei, gekocht | Wholemeal pasta egg-free, boiled |
| [bls-E500062](0010/bls-E500062.webp) | Vollkornteigwaren eifrei, gekocht, gebacken | Wholemeal pasta egg-free, boiled, baked |
| [bls-E500082](0010/bls-E500082.webp) | Vollkornteigwaren eifrei, gekocht, gebraten ohne Fett (Pfanne) | Wholemeal pasta egg-free, boiled, fried without fat (pan) |
| [bls-E510000](0010/bls-E510000.webp) | Vollkornteigwaren eifrei, roh | Wholemeal pasta egg-free, raw |
| [bls-E530000](0010/bls-E530000.webp) | Vollkorneierteigwaren roh | Wholemeal egg pasta raw |
| [bls-E530032](0010/bls-E530032.webp) | Vollkorneierteigwaren gekocht | Wholemeal egg pasta boiled |
| [bls-E530062](0010/bls-E530062.webp) | Vollkorneierteigwaren gekocht, gebacken | Wholemeal egg pasta boiled, baked |
| [bls-E530082](0010/bls-E530082.webp) | Vollkorneierteigwaren gekocht, gebraten ohne Fett (Pfanne) | Wholemeal egg pasta boiled, fried without fat (pan) |
| [bls-E603000](0010/bls-E603000.webp) | Eier-Frischteigwaren Ravioli (Fleischfüllung) roh | Fresh egg pasta Ravioli (meat filling) raw |
| [bls-E603022](0010/bls-E603022.webp) | Eier-Frischteigwaren Ravioli (Fleischfüllung) gedämpft | Fresh egg pasta Ravioli (meat filling) steamed |
| [bls-E603032](0010/bls-E603032.webp) | Eier-Frischteigwaren Ravioli (Fleischfüllung) gekocht | Fresh egg pasta Ravioli (meat filling) boiled |
| [bls-E603062](0010/bls-E603062.webp) | Eier-Frischteigwaren Ravioli (Fleischfüllung) gekocht, gebacken | Fresh egg pasta Ravioli (meat filling) boiled, baked |
| [bls-E603082](0010/bls-E603082.webp) | Eier-Frischteigwaren Ravioli (Fleischfüllung) gekocht, gebraten ohne Fett (Pfanne) | Fresh egg pasta Ravioli (meat filling) boiled, fried without fat (pan) |
| [bls-E604300](0010/bls-E604300.webp) | Eierteigwaren mit Weizenkeimen, roh | Egg pasta with wheat germ, raw |
| [bls-E604332](0010/bls-E604332.webp) | Eierteigwaren mit Weizenkeimen, gekocht | Egg pasta with wheat germ, boiled |
| [bls-E605000](0010/bls-E605000.webp) | Kartoffel-Schupfnudeln roh | Potato noodles (Schupfnudeln) raw |
| [bls-E605032](0010/bls-E605032.webp) | Kartoffel-Schupfnudeln gekocht | Potato noodles (Schupfnudeln) boiled |
| [bls-E605062](0010/bls-E605062.webp) | Kartoffel-Schupfnudeln gekocht, gebacken | Potato noodles (Schupfnudeln) boiled, baked |
| [bls-E605082](0010/bls-E605082.webp) | Kartoffel-Schupfnudeln gekocht, gebraten ohne Fett (Pfanne) | Potato noodles (Schupfnudeln) boiled, fried without fat (pan) |
| [bls-E605200](0010/bls-E605200.webp) | Schupfnudeln schwäbisch, roh | Finger-shaped pasta Swabian style, raw |
| [bls-E605232](0010/bls-E605232.webp) | Schupfnudeln schwäbisch, gekocht | Finger-shaped pasta Swabian style, boiled |
| [bls-E605300](0010/bls-E605300.webp) | Schupfnudeln eifrei, roh | Finger-shaped pasta egg-free, raw |
| [bls-E605332](0010/bls-E605332.webp) | Schupfnudeln eifrei, gekocht | Finger-shaped pasta egg-free, boiled |
| [bls-E606000](0010/bls-E606000.webp) | Semmelknödel roh | White bread dumplings raw |
| [bls-E606022](0010/bls-E606022.webp) | Semmelknödel gedämpft | White bread dumplings steamed |
| [bls-E606032](0010/bls-E606032.webp) | Semmelknödel gekocht | White bread dumplings boiled |
| [bls-E606062](0010/bls-E606062.webp) | Semmelknödel gekocht, gebacken | White bread dumplings boiled, baked |
| [bls-E606082](0010/bls-E606082.webp) | Semmelknödel gekocht, gebraten ohne Fett (Pfanne) | White bread dumplings boiled, fried without fat (pan) |
| [bls-E606200](0010/bls-E606200.webp) | Semmelknödel getrocknet | White bread dumplings dried |
| [bls-E606232](0010/bls-E606232.webp) | Semmelknödel getrocknet, gekocht | White bread dumplings dried, boiled |
| [bls-E606282](0010/bls-E606282.webp) | Semmelknödel getrocknet, gekocht, gebraten ohne Fett (Pfanne) | White bread dumplings dried, boiled, fried without fat (pan) |
| [bls-E607000](0010/bls-E607000.webp) | Grießklößchen roh | Semolina dumplings raw |
| [bls-E607032](0010/bls-E607032.webp) | Grießklößchen gekocht | Semolina dumplings boiled |
| [bls-E607100](0010/bls-E607100.webp) | Grießklößchen getrocknet | Semolina dumplings dried |
| [bls-E607132](0010/bls-E607132.webp) | Grießklößchen getrocknet, gekocht | Semolina dumplings dried, boiled |
| [bls-E607182](0010/bls-E607182.webp) | Grießklößchen getrocknet, gekocht, gebraten ohne Fett (Pfanne) | Semolina dumplings dried, boiled, fried without fat (pan) |
| [bls-E608000](0010/bls-E608000.webp) | Böhmische Knödel roh | Bohemian dumplings raw |
| [bls-E608032](0010/bls-E608032.webp) | Böhmische Knödel gekocht | Bohemian dumplings boiled |
| [bls-E608082](0010/bls-E608082.webp) | Böhmische Knödel gekocht, gebraten ohne Fett (Pfanne) | Bohemian dumplings boiled, fried without fat (pan) |
| [bls-E609100](0010/bls-E609100.webp) | Eierteigwaren Tortelloni (Ricotta-Spinat-Füllung) getrocknet | Egg pasta Tortelloni (ricotta and spinach filling) dried |
| [bls-E609132](0010/bls-E609132.webp) | Eierteigwaren Tortelloni (Ricotta-Spinat-Füllung) getrocknet, gekocht | Egg pasta Tortelloni (ricotta and spinach filling) dried, boiled |
| [bls-E609200](0010/bls-E609200.webp) | Eierteigwaren Tortellini (Fleischfüllung) getrocknet | Egg pasta Tortellini (meat filling) dried |
| [bls-E609232](0010/bls-E609232.webp) | Eierteigwaren Tortellini (Fleischfüllung) getrocknet, gekocht | Egg pasta Tortellini (meat filling) dried, boiled |
| [bls-E612000](0010/bls-E612000.webp) | Teigwaren eifrei, glutenfrei, roh | Pasta egg-free, gluten-free, raw |
| [bls-E612032](0010/bls-E612032.webp) | Teigwaren eifrei, glutenfrei, gekocht | Pasta egg-free, gluten-free, boiled |
| [bls-E612100](0010/bls-E612100.webp) | Eierteigwaren glutenfrei, roh | Egg pasta gluten-free, raw |
| [bls-E612132](0010/bls-E612132.webp) | Eierteigwaren glutenfrei, gekocht | Egg pasta gluten-free, boiled |
| [bls-E632000](0010/bls-E632000.webp) | Dinkelteigwaren eifrei, roh | Spelt pasta egg-free, raw |
| [bls-E632032](0010/bls-E632032.webp) | Dinkelteigwaren eifrei, gekocht | Spelt pasta egg-free, boiled |
| [bls-E632100](0010/bls-E632100.webp) | Dinkeleierteigwaren roh | Spelt egg pasta raw |
| [bls-E632132](0010/bls-E632132.webp) | Dinkeleierteigwaren gekocht | Spelt egg pasta boiled |
| [bls-E632200](0010/bls-E632200.webp) | Dinkelvollkornteigwaren eifrei, roh | Wholemeal spelt pasta egg-free, raw |
| [bls-E632232](0010/bls-E632232.webp) | Dinkelvollkornteigwaren eifrei, gekocht | Wholemeal spelt pasta egg-free, boiled |
| [bls-E632300](0010/bls-E632300.webp) | Dinkelvollkorneierteigwaren roh | Wholemeal spelt egg pasta raw |
| [bls-E632332](0010/bls-E632332.webp) | Dinkelvollkorneierteigwaren gekocht | Wholemeal spelt egg pasta boiled |
| [bls-E811000](0010/bls-E811000.webp) | Frischteigwaren eifrei, roh | Fresh pasta egg-free, raw |
| [bls-E811032](0010/bls-E811032.webp) | Frischteigwaren eifrei, gekocht | Fresh pasta egg-free, boiled |
| [bls-E901000](0010/bls-E901000.webp) | Teigwaren eifrei, Ravioli (Fleischfüllung) in Tomatensoße, Konserve | Pasta egg-free, Ravioli (meat filling) in tomato sauce, canned |
| [bls-E911000](0010/bls-E911000.webp) | Teigwaren eifrei, Ravioli (Gemüsefüllung) in Tomatensoße, Konserve | Pasta egg-free, Ravioli (vegetable filling) in tomato sauce, canned |
| [bls-F010600](0010/bls-F010600.webp) | Mehrfruchtsaft | Multi-fruit juice |
| [bls-F012700](0010/bls-F012700.webp) | Mehrfruchtnektar | Mixed fruit nectar |
| [bls-F013700](0010/bls-F013700.webp) | Mehrfruchtnektar mit Süßungsmitteln | Mixed fruit nectar with artificial sweeteners |
| [bls-F014600](0010/bls-F014600.webp) | Mehrfruchtsaft angereichert mit Vitaminen (Multivitaminsaft) | Multi-fruit juice fortified with vitamins (multivitamin juice) |
| [bls-F016600](0010/bls-F016600.webp) | Mehrfruchtsaft angereichert mit Vitaminen und Mineralstoffen | Multi-fruit juice fortified with vitamins and minerals |
| [bls-F020600](0010/bls-F020600.webp) | Roter Mehrfruchtsaft | Red multi-fruit juice |
| [bls-F021600](0010/bls-F021600.webp) | Roter Mehrfruchtsaft angereichert mit Vitaminen (Roter Multivitaminsaft) | Red multi-fruit juice fortified with vitamins (red multivitamin juice) |
| [bls-F022700](0010/bls-F022700.webp) | Mehrfruchtnektar, angereichert mit Vitaminen (Multivitaminnektar) | Mixed fruit nectar, fortified with vitamins (multivitamin nectar) |
| [bls-F023700](0010/bls-F023700.webp) | Mehrfruchtnektar mit Süßungsmitteln, angereichert mit Vitaminen (Multivitaminnektar) | Mixed fruit nectar with artificial sweeteners, fortified with vitamins (multivitamin nectar) |
| [bls-F032600](0010/bls-F032600.webp) | Smoothie purpur (Früchte) | Smoothie of purple fruits |
| [bls-F033600](0010/bls-F033600.webp) | Smoothie gelb (Früchte) | Smoothie of yellow fruits |
| [bls-F034600](0010/bls-F034600.webp) | Smoothie grün (Früchte/Gemüse) | Smoothie of green fruits and vegetables |
| [bls-F081100](0010/bls-F081100.webp) | Rhabarber roh | Rhubarb raw |

## Tanda 0011: frutas, conservas y zumos

100 imágenes nuevas desde `bls-F081600` hasta `bls-F303902`: ruibarbo, mezclas
de fruta, manzana, pera, membrillo, níspero europeo, albaricoque, nectarina,
melocotón, cerezas, ciruelas y bayas, con sus variantes y bebidas. Cada código
tiene su propia generación integrada de Codex. El manifiesto conserva los
nombres oficiales DE/EN literales, el prompt exacto, la referencia y las huellas
de nombres y WebP.

La fruta cruda mantiene su textura firme; la cocida aparece blanda y sin dorado.
Las variantes secas tienen superficie deshidratada y arrugada; las conservas
escurridas no muestran un charco de líquido ni su envase. Las manzanas peladas
no tienen piel; las no peladas mantienen su borde de piel cuando se cortan.
Los zumos y néctares se muestran en un vaso sencillo, sin fruta decorativa.
Los edulcorantes, las vitaminas y la presencia o ausencia de azúcar en las
conservas no se identifican con símbolos ni ingredientes añadidos. La mezcla
cruda azucarada sí admite una capa ligera de azúcar. Las variantes parecidas
se generaron de forma independiente.

Para evitar confundir `Mispel` con el níspero japonés se consultó la
[ficha de Mespilus germanica de RHS](https://www.rhs.org.uk/plants/11088/mespilus-germanica-f/details):
se representa el fruto marrón del níspero europeo, con su cáliz abierto. Es una
orientación editorial, no una validación de BLS; no se copiaron fotografías.
Las referencias CIQUAL se usan solo para el estilo. Ninguna imagen acredita
receta, ingredientes exactos, alérgenos, composición o una ración de 100 g.

Revisión: todos los WebP finales en nueve láminas; 13 casos a tamaño completo.
Correcciones registradas: 3. El estado sigue siendo `pending-review`
hasta la revisión del mantenedor. BLS permanece fuera de la app.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0011-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0011-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0011-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0011-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0011-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0011-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0011-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0011-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0011-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-F081600](0011/bls-F081600.webp) | Rhabarbersaft | Rhubarb juice |
| [bls-F081902](0011/bls-F081902.webp) | Rhabarber gezuckert, Konserve, abgetropft | Rhubarb sugared, canned, drained |
| [bls-F083902](0011/bls-F083902.webp) | Rhabarber ungesüßt, Konserve, abgetropft | Rhubarb unsweetened, canned, drained |
| [bls-F090100](0011/bls-F090100.webp) | Fruchtmischung gezuckert, roh | Mixed fruit sugared, raw |
| [bls-F090400](0011/bls-F090400.webp) | Fruchtmischung getrocknet (Trockenfrucht-Mix) | Mixed fruit dried |
| [bls-F090902](0011/bls-F090902.webp) | Fruchtmischung/Fruchtcocktail, gezuckert, Konserve, abgetropft | Fruit mix/fruit cocktail, sugared, canned, drained |
| [bls-F091100](0011/bls-F091100.webp) | Fruchtmischung ungesüßt, roh | Mixed fruit unsweetened |
| [bls-F091902](0011/bls-F091902.webp) | Fruchtmischung/Fruchtcocktail, in Fruchtsaft, Konserve, abgetropft | Fruit mix/fruit cocktail, in juice, canned, drained |
| [bls-F092100](0011/bls-F092100.webp) | Beerenmischung mit Sauerkirschen, ungesüßt, roh | Berry mix with sour cherries, unsweetened, raw |
| [bls-F092152](0011/bls-F092152.webp) | Beerenmischung mit Sauerkirschen, ungesüßt, gedünstet | Berry mix with sour cherries, unsweetened, stewed |
| [bls-F092902](0011/bls-F092902.webp) | Fruchtmischung/Fruchtcocktail, mit Süßungsmitteln, Konserve, abgetropft | Fruit mix/fruit cocktail, with artificial sweeteners, canned, drained |
| [bls-F093902](0011/bls-F093902.webp) | Fruchtmischung/Fruchtcocktail, ungesüßt, Konserve, abgetropft | Fruit mix/fruit cocktail, unsweetened, canned, drained |
| [bls-F110100](0011/bls-F110100.webp) | Apfel roh | Apple raw |
| [bls-F110152](0011/bls-F110152.webp) | Apfel gedünstet | Apple stewed |
| [bls-F110400](0011/bls-F110400.webp) | Apfel getrocknet | Apple dried |
| [bls-F110600](0011/bls-F110600.webp) | Apfelsaft | Apple juice |
| [bls-F110700](0011/bls-F110700.webp) | Apfelnektar | Apple nectar |
| [bls-F112600](0011/bls-F112600.webp) | Apfelsaft angereichert mit Vitamin C | Apple juice fortified with vitamin C |
| [bls-F116600](0011/bls-F116600.webp) | Apfelnektar mit Süßungsmitteln | Apple nectar with artificial sweeteners |
| [bls-F119902](0011/bls-F119902.webp) | Apfel ungesüßt, Konserve, abgetropft | Apple unsweetened, canned, drained |
| [bls-F120100](0011/bls-F120100.webp) | Apfel geschält, roh | Apple peeled, raw |
| [bls-F120152](0011/bls-F120152.webp) | Apfel geschält, gedünstet | Apple peeled, stewed |
| [bls-F120400](0011/bls-F120400.webp) | Apfel geschält, getrocknet | Apple peeled, dried |
| [bls-F130100](0011/bls-F130100.webp) | Birne roh | Pear raw |
| [bls-F130152](0011/bls-F130152.webp) | Birne gedünstet | Pear stewed |
| [bls-F130400](0011/bls-F130400.webp) | Birne getrocknet | Pear dried |
| [bls-F130600](0011/bls-F130600.webp) | Birnensaft | Pear juice |
| [bls-F130902](0011/bls-F130902.webp) | Birne gezuckert, Konserve, abgetropft | Pear sugared, canned, drained |
| [bls-F131902](0011/bls-F131902.webp) | Birne ungesüßt, Konserve, abgetropft | Pear unsweetened, canned, drained |
| [bls-F133902](0011/bls-F133902.webp) | Birne mit Süßungsmitteln, Konserve, abgetropft | Pear with artificial sweeteners, canned, drained |
| [bls-F134902](0011/bls-F134902.webp) | Birne in Fruchtsaft, Konserve, abgetropft | Pear in juice, canned, drained |
| [bls-F140100](0011/bls-F140100.webp) | Quitte roh | Quince raw |
| [bls-F140132](0011/bls-F140132.webp) | Quitte gekocht | Quince boiled |
| [bls-F140152](0011/bls-F140152.webp) | Quitte gedünstet | Quince stewed |
| [bls-F140600](0011/bls-F140600.webp) | Quittensaft | Quince juice |
| [bls-F150100](0011/bls-F150100.webp) | Mispel roh | Medlar raw |
| [bls-F201100](0011/bls-F201100.webp) | Aprikose roh | Apricot raw |
| [bls-F201152](0011/bls-F201152.webp) | Aprikose gedünstet | Apricot stewed |
| [bls-F201400](0011/bls-F201400.webp) | Aprikose getrocknet | Apricot dried |
| [bls-F201600](0011/bls-F201600.webp) | Aprikosensaft | Apricot juice |
| [bls-F201902](0011/bls-F201902.webp) | Aprikose gezuckert, Konserve, abgetropft | Apricot sugared, canned, drained |
| [bls-F202100](0011/bls-F202100.webp) | Nektarine roh | Nectarine raw |
| [bls-F202152](0011/bls-F202152.webp) | Nektarine gedünstet | Nectarine stewed |
| [bls-F203100](0011/bls-F203100.webp) | Pfirsich roh | Peach raw |
| [bls-F203152](0011/bls-F203152.webp) | Pfirsich gedünstet | Peach stewed |
| [bls-F203400](0011/bls-F203400.webp) | Pfirsich getrocknet | Peach dried |
| [bls-F203700](0011/bls-F203700.webp) | Pfirsichnektar | Peach nectar |
| [bls-F203902](0011/bls-F203902.webp) | Pfirsich gezuckert, Konserve, abgetropft | Peach sugared, canned, drained |
| [bls-F206902](0011/bls-F206902.webp) | Pfirsich in Fruchtsaft, Konserve, abgetropft | Peach in juice, canned, drained |
| [bls-F207902](0011/bls-F207902.webp) | Pfirsich mit Süßungsmitteln, Konserve, abgetropft | Peach with artificial sweeteners, canned, drained |
| [bls-F208902](0011/bls-F208902.webp) | Pfirsich ungesüßt, Konserve, abgetropft | Peach unsweetened, canned, drained |
| [bls-F210902](0011/bls-F210902.webp) | Süßkirsche ungesüßt, Konserve, abgetropft | Sweet cherry unsweetened, canned, drained |
| [bls-F211100](0011/bls-F211100.webp) | Süßkirsche roh | Sweet cherry raw |
| [bls-F211152](0011/bls-F211152.webp) | Süßkirsche gedünstet | Sweet cherry stewed |
| [bls-F211400](0011/bls-F211400.webp) | Süßkirsche getrocknet | Sweet cherry dried |
| [bls-F211600](0011/bls-F211600.webp) | Süßkirschsaft | Sweet cherry juice |
| [bls-F211902](0011/bls-F211902.webp) | Süßkirsche gezuckert, Konserve, abgetropft | Sweet cherry sugared, canned, drained |
| [bls-F212100](0011/bls-F212100.webp) | Sauerkirsche roh | Sour cherry raw |
| [bls-F212152](0011/bls-F212152.webp) | Sauerkirsche gedünstet | Sour cherry stewed |
| [bls-F212600](0011/bls-F212600.webp) | Sauerkirschsaft | Sour cherry juice |
| [bls-F212700](0011/bls-F212700.webp) | Sauerkirschnektar | Sour cherry nectar |
| [bls-F212902](0011/bls-F212902.webp) | Sauerkirsche gezuckert, Konserve, abgetropft | Sour cherry sugared, canned, drained |
| [bls-F213902](0011/bls-F213902.webp) | Sauerkirsche ungesüßt, Konserve, abgetropft | Sour cherry unsweetened, canned, drained |
| [bls-F217902](0011/bls-F217902.webp) | Sauerkirsche mit Süßungsmitteln, Konserve, abgetropft | Sour cherry with artificial sweeteners, canned, drained |
| [bls-F220100](0011/bls-F220100.webp) | Pflaume roh | Plum raw |
| [bls-F220152](0011/bls-F220152.webp) | Pflaume gedünstet | Plum stewed |
| [bls-F220400](0011/bls-F220400.webp) | Pflaume getrocknet | Plum dried (prunes) |
| [bls-F220600](0011/bls-F220600.webp) | Pflaumensaft | Plum juice |
| [bls-F220902](0011/bls-F220902.webp) | Pflaume gezuckert, Konserve, abgetropft | Plum sugared, canned, drained |
| [bls-F223100](0011/bls-F223100.webp) | Zwetschge roh | Blue plum raw |
| [bls-F223152](0011/bls-F223152.webp) | Zwetschge gedünstet | Blue plum stewed |
| [bls-F224100](0011/bls-F224100.webp) | Mirabelle roh | Mirabelle plum raw |
| [bls-F224152](0011/bls-F224152.webp) | Mirabelle gedünstet | Mirabelle plum stewed |
| [bls-F224902](0011/bls-F224902.webp) | Mirabelle gezuckert, Konserve, abgetropft | Mirabelle plum sugared, canned, drained |
| [bls-F225100](0011/bls-F225100.webp) | Reineclaude roh | Greengage raw |
| [bls-F225152](0011/bls-F225152.webp) | Reineclaude gedünstet | Greengage stewed |
| [bls-F227902](0011/bls-F227902.webp) | Pflaume mit Süßungsmitteln, Konserve, abgetropft | Plum with artificial sweeteners, canned, drained |
| [bls-F22A902](0011/bls-F22A902.webp) | Pflaume ungesüßt, Konserve, abgetropft | Plum unsweetened, canned, drained |
| [bls-F22B902](0011/bls-F22B902.webp) | Mirabelle mit Süßungsmitteln, Konserve, abgetropft | Mirabelle plum with artificial sweeteners, canned, drained |
| [bls-F22C902](0011/bls-F22C902.webp) | Mirabelle ungesüßt, Konserve, abgetropft | Mirabelle plum unsweetened, canned, drained |
| [bls-F240902](0011/bls-F240902.webp) | Süßkirsche mit Süßungsmitteln, Konserve, abgetropft | Sweet cherry with artificial sweeteners, canned, drained |
| [bls-F2A1902](0011/bls-F2A1902.webp) | Aprikose in Fruchtsaft, Konserve, abgetropft | Apricot in juice, canned, drained |
| [bls-F2A2700](0011/bls-F2A2700.webp) | Sauerkirschnektar mit Süßungsmitteln | Sour cherry nectar with artificial sweeteners |
| [bls-F2B1902](0011/bls-F2B1902.webp) | Aprikose mit Süßungsmitteln, Konserve, abgetropft | Apricot with artificial sweeteners, canned, drained |
| [bls-F2C1902](0011/bls-F2C1902.webp) | Aprikose ungesüßt, Konserve, abgetropft | Apricot unsweetened, canned, drained |
| [bls-F301100](0011/bls-F301100.webp) | Erdbeere roh | Strawberry raw |
| [bls-F301152](0011/bls-F301152.webp) | Erdbeere gedünstet | Strawberry stewed |
| [bls-F301400](0011/bls-F301400.webp) | Erdbeere getrocknet | Strawberry dried |
| [bls-F301600](0011/bls-F301600.webp) | Erdbeersaft | Strawberry juice |
| [bls-F301902](0011/bls-F301902.webp) | Erdbeere gezuckert, Konserve, abgetropft | Strawberry sugared, canned, drained |
| [bls-F302100](0011/bls-F302100.webp) | Himbeere roh | Raspberry raw |
| [bls-F302152](0011/bls-F302152.webp) | Himbeere gedünstet | Raspberry stewed |
| [bls-F302400](0011/bls-F302400.webp) | Himbeere getrocknet | Raspberry dried |
| [bls-F302600](0011/bls-F302600.webp) | Himbeersaft | Raspberry juice |
| [bls-F302902](0011/bls-F302902.webp) | Himbeere gezuckert, Konserve, abgetropft | Raspberry sugared, canned, drained |
| [bls-F303100](0011/bls-F303100.webp) | Brombeere roh | Blackberry raw |
| [bls-F303152](0011/bls-F303152.webp) | Brombeere gedünstet | Blackberry stewed |
| [bls-F303400](0011/bls-F303400.webp) | Brombeere getrocknet | Blackberry dried |
| [bls-F303600](0011/bls-F303600.webp) | Brombeersaft | Blackberry juice |
| [bls-F303902](0011/bls-F303902.webp) | Brombeere gezuckert, Konserve, abgetropft | Blackberry sugared, canned, drained |

## Tanda 0012: bayas, uvas y frutas tropicales

100 imágenes nuevas desde `bls-F304100` hasta `bls-F529100`: arándanos,
grosellas, uvas, moras híbridas y otras bayas; piña, aguacate, plátano, dátil,
higo, granada, kaki, maracuyá, acerola, guayaba, kiwi, lichi, mango, papaya,
lulo, fruta del pan, chirimoya y níspero japonés, con sus variantes. Cada código
tiene su propia generación integrada de Codex. El manifiesto conserva los
nombres oficiales DE/EN literales, prompts exactos y huellas de nombres,
referencias y WebP finales.

Las bayas crudas conservan su forma firme y su color natural; las cocinadas
aparecen blandas. Las conservas escurridas se muestran sin líquido acumulado.
Las conservas de arándano rojo con pectina presentan una textura de gel con fruta.
Los zumos y néctares aparecen en un vaso sencillo, sin fruta decorativa.
La fruta deshidratada de esta tanda tiene una textura arrugada;
el plátano seco no se representa como chips fritos. Se distingue el dátil
fresco y carnoso de la variante seca. Los edulcorantes y el hierro añadido
no se representan mediante partículas, símbolos, envases ni ingredientes.
Las variantes semejantes, incluidas las silvestres, se generan por separado;
la imagen no demuestra la variedad ni las propiedades invisibles de una ficha.

Fuentes editoriales consultadas para evitar confusiones, sin copiar fotografías
ni modificar los nombres oficiales de BLS:

- [RHS: moras y bayas híbridas](https://www.rhs.org.uk/fruit/blackberries-and-hybrid-berries/grow-your-own): loganberry rojo oscuro y boysenberry oscuro.
- [Flora de Irlanda del Norte: Rubus chamaemorus](https://www.habitas.org.uk/flora/species.asp?item=3317): fruto naranja de la mora de los pantanos.
- [RHS: Sorbus aucuparia Edulis](https://www.rhs.org.uk/plants/43982/sorbus-aucuparia-edulis/details): frutos naranja rojizo.
- [FAO Ecocrop: Solanum quitoense](https://ecocrop.apps.fao.org/ecocrop/srv/en/cropView?id=1968): lulo de exterior naranja y pulpa verde.
- [Universidad de Florida: loquat](https://ask.ifas.ufl.edu/publication/MG050): pulpa clara, amarilla o naranja y semillas marrones; se representa el níspero japonés amarillo-naranja.

Las referencias CIQUAL se usan solo para el estilo. Son ilustraciones de
Gymnasia, no proporcionadas ni validadas por Max Rubner-Institut. No prueban
receta, ingredientes exactos, alérgenos, composición ni una ración de 100 g.

Revisión: todos los WebP finales en nueve láminas; 14 casos a tamaño completo.
Correcciones registradas: 0. El estado sigue siendo `pending-review`
hasta la revisión del mantenedor. BLS permanece fuera de la app.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0012-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0012-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0012-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0012-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0012-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0012-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0012-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0012-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0012-09.jpg)

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-F304100](0012/bls-F304100.webp) | Heidelbeere roh | Blueberry raw |
| [bls-F304152](0012/bls-F304152.webp) | Heidelbeere gedünstet | Blueberry stewed |
| [bls-F304600](0012/bls-F304600.webp) | Heidelbeersaft | Blueberry juice |
| [bls-F304902](0012/bls-F304902.webp) | Heidelbeere gezuckert, Konserve, abgetropft | Blueberry sugared, canned, drained |
| [bls-F305100](0012/bls-F305100.webp) | Stachelbeere roh | Gooseberry raw |
| [bls-F305152](0012/bls-F305152.webp) | Stachelbeere gedünstet | Gooseberry stewed |
| [bls-F305902](0012/bls-F305902.webp) | Stachelbeere gezuckert, Konserve, abgetropft | Gooseberry sugared, canned, drained |
| [bls-F306100](0012/bls-F306100.webp) | Loganbeere roh | Loganberry raw |
| [bls-F307100](0012/bls-F307100.webp) | Boysenbeere roh | Boysenberry raw |
| [bls-F310100](0012/bls-F310100.webp) | Weintraube roh | Grape raw |
| [bls-F310600](0012/bls-F310600.webp) | Traubensaft | Grape juice |
| [bls-F311100](0012/bls-F311100.webp) | Weintraube rot, roh | Grape red, raw |
| [bls-F311600](0012/bls-F311600.webp) | Traubensaft rot | Grape red juice |
| [bls-F312100](0012/bls-F312100.webp) | Weintraube weiß, roh | Grape white, raw |
| [bls-F312600](0012/bls-F312600.webp) | Traubensaft weiß | Grape white juice |
| [bls-F313902](0012/bls-F313902.webp) | Weintraube weiß, ungesüßt, Konserve, abgetropft | Grape white, unsweetened, canned, drained |
| [bls-F317600](0012/bls-F317600.webp) | Traubensaft angereichert mit Eisen | Grape juice fortified with iron |
| [bls-F321100](0012/bls-F321100.webp) | Johannisbeere rot, roh | Red currant raw |
| [bls-F321152](0012/bls-F321152.webp) | Johannisbeere rot, gedünstet | Red currant stewed |
| [bls-F321600](0012/bls-F321600.webp) | Johannisbeersaft rot | Red currant juice |
| [bls-F321902](0012/bls-F321902.webp) | Johannisbeere rot, gezuckert, Konserve, abgetropft | Red currant sugared, canned, drained |
| [bls-F322100](0012/bls-F322100.webp) | Johannisbeere weiß, roh | White currant raw |
| [bls-F323100](0012/bls-F323100.webp) | Johannisbeere schwarz roh | Black currant raw |
| [bls-F323152](0012/bls-F323152.webp) | Johannisbeere schwarz gedünstet | Black currant stewed |
| [bls-F323600](0012/bls-F323600.webp) | Johannisbeersaft schwarz | Black currant juice |
| [bls-F323700](0012/bls-F323700.webp) | Johannisbeernektar schwarz | Black currant nectar |
| [bls-F323902](0012/bls-F323902.webp) | Johannisbeere schwarz, gezuckert, Konserve, abgetropft | Black currant sugared, canned, drained |
| [bls-F324902](0012/bls-F324902.webp) | Johannisbeere rot, ungesüßt, Konserve, abgetropft | Red currant unsweetened, canned, drained |
| [bls-F331100](0012/bls-F331100.webp) | Maulbeere roh | Mulberry raw |
| [bls-F331600](0012/bls-F331600.webp) | Maulbeersaft | Mulberry juice |
| [bls-F340902](0012/bls-F340902.webp) | Erdbeere ungesüßt, Konserve, abgetropft | Strawberry unsweetened, canned, drained |
| [bls-F341902](0012/bls-F341902.webp) | Erdbeere mit Süßungsmitteln, Konserve, abgetropft | Strawberry with artificial sweeteners, canned, drained |
| [bls-F3A2902](0012/bls-F3A2902.webp) | Himbeere mit Süßungsmitteln, Konserve, abgetropft | Raspberry with artificial sweeteners, canned, drained |
| [bls-F3A3700](0012/bls-F3A3700.webp) | Johannisbeernektar schwarz, mit Süßungsmitteln | Black currant nectar with artificial sweeteners |
| [bls-F3A3902](0012/bls-F3A3902.webp) | Brombeere ungesüßt, Konserve, abgetropft | Blackberry unsweetened, canned, drained |
| [bls-F3A4902](0012/bls-F3A4902.webp) | Heidelbeere mit Süßungsmitteln, Konserve, abgetropft | Blueberry with artificial sweeteners, canned, drained |
| [bls-F3A5902](0012/bls-F3A5902.webp) | Stachelbeere mit Süßungsmitteln, Konserve, abgetropft | Gooseberry with artificial sweeteners, canned, drained |
| [bls-F3B2902](0012/bls-F3B2902.webp) | Himbeere ungesüßt, Konserve, abgetropft | Raspberry unsweetened, canned, drained |
| [bls-F3B4902](0012/bls-F3B4902.webp) | Heidelbeere ungesüßt, Konserve, abgetropft | Blueberry unsweetened, canned, drained |
| [bls-F3B5902](0012/bls-F3B5902.webp) | Stachelbeere ungesüßt, Konserve, abgetropft | Gooseberry unsweetened, canned, drained |
| [bls-F401100](0012/bls-F401100.webp) | Preiselbeere roh | Lingonberry raw |
| [bls-F401600](0012/bls-F401600.webp) | Preiselbeersaft | Lingonberry juice |
| [bls-F401902](0012/bls-F401902.webp) | Preiselbeere gezuckert, Konserve, abgetropft | Lingonberry sugared, canned, drained |
| [bls-F402100](0012/bls-F402100.webp) | Hagebutte roh | Rose hip raw |
| [bls-F403100](0012/bls-F403100.webp) | Schlehe roh | Sloe raw |
| [bls-F403600](0012/bls-F403600.webp) | Schlehensaft | Sloe fruit juice |
| [bls-F404100](0012/bls-F404100.webp) | Eberesche süß, roh | Sweet rowanberry raw |
| [bls-F405100](0012/bls-F405100.webp) | Sanddornbeere roh | Sea buckthorn berry raw |
| [bls-F405600](0012/bls-F405600.webp) | Sanddornsaft | Sea buckthorn berry juice |
| [bls-F406100](0012/bls-F406100.webp) | Holunderbeere roh | Elderberry raw |
| [bls-F406600](0012/bls-F406600.webp) | Holundersaft | Elderberry juice |
| [bls-F407100](0012/bls-F407100.webp) | Moosbeere roh | Small cranberry raw |
| [bls-F408000](0012/bls-F408000.webp) | Moltebeere roh | Cloudberry raw |
| [bls-F409100](0012/bls-F409100.webp) | Wald-Erdbeere roh | Wild strawberry raw |
| [bls-F411100](0012/bls-F411100.webp) | Wald-Himbeere roh | Wild raspberry raw |
| [bls-F413100](0012/bls-F413100.webp) | Wald-Brombeere roh | Wild blackberry raw |
| [bls-F414400](0012/bls-F414400.webp) | Cranberries getrocknet, gezuckert | Cranberries dried, sugared |
| [bls-F4A1900](0012/bls-F4A1900.webp) | Preiselbeere gezuckert (mit Pektin) Konserve | Lingonberry sugared (with pectine) canned |
| [bls-F4B1900](0012/bls-F4B1900.webp) | Preiselbeere mit einer Zuckerart und Süßungsmitteln (mit Pektin) Konserve | Lingonberry with sugar and artificial sweeteners (with pectine) canned |
| [bls-F501100](0012/bls-F501100.webp) | Ananas roh | Pineapple raw |
| [bls-F501152](0012/bls-F501152.webp) | Ananas gedünstet | Pineapple stewed |
| [bls-F501400](0012/bls-F501400.webp) | Ananas getrocknet | Pineapple dried |
| [bls-F501600](0012/bls-F501600.webp) | Ananassaft | Pineapple juice |
| [bls-F501902](0012/bls-F501902.webp) | Ananas gezuckert, Konserve, abgetropft | Pineapple sugared, canned, drained |
| [bls-F502100](0012/bls-F502100.webp) | Avocado roh | Avocado raw |
| [bls-F503100](0012/bls-F503100.webp) | Banane roh | Banana raw |
| [bls-F503400](0012/bls-F503400.webp) | Banane getrocknet | Banana dried |
| [bls-F503700](0012/bls-F503700.webp) | Bananennektar | Banana nectar |
| [bls-F504100](0012/bls-F504100.webp) | Dattel roh | Date raw |
| [bls-F504400](0012/bls-F504400.webp) | Dattel getrocknet | Date dried |
| [bls-F505100](0012/bls-F505100.webp) | Feige roh | Fig raw |
| [bls-F505400](0012/bls-F505400.webp) | Feige getrocknet | Fig dried |
| [bls-F505902](0012/bls-F505902.webp) | Feige gezuckert, Konserve, abgetropft | Fig sugared, canned, drained |
| [bls-F506100](0012/bls-F506100.webp) | Granatapfel roh | Pomegranate raw |
| [bls-F507100](0012/bls-F507100.webp) | Kaki roh | Persimmon raw |
| [bls-F507600](0012/bls-F507600.webp) | Kakisaft | Persimmon juice |
| [bls-F508100](0012/bls-F508100.webp) | Maracuja/Passionsfrucht, roh | Passion fruit raw |
| [bls-F508600](0012/bls-F508600.webp) | Maracujasaft/Passionsfruchtsaft | Passion fruit juice |
| [bls-F508700](0012/bls-F508700.webp) | Maracujanektar/Passionsfruchtnektar | Passion fruit nectar |
| [bls-F511100](0012/bls-F511100.webp) | Acerola roh | Acerola raw |
| [bls-F511600](0012/bls-F511600.webp) | Acerolasaft | Acerola juice |
| [bls-F513100](0012/bls-F513100.webp) | Guave roh | Guava raw |
| [bls-F514100](0012/bls-F514100.webp) | Kiwi roh | Kiwi fruit raw |
| [bls-F514152](0012/bls-F514152.webp) | Kiwi gedünstet | Kiwi stewed |
| [bls-F514600](0012/bls-F514600.webp) | Kiwisaft | Kiwi fruit juice |
| [bls-F515100](0012/bls-F515100.webp) | Litschi roh | Lychee raw |
| [bls-F515600](0012/bls-F515600.webp) | Litschisaft | Lychee juice |
| [bls-F515902](0012/bls-F515902.webp) | Litschi gezuckert, Konserve, abgetropft | Lychee sugared, canned, drained |
| [bls-F516100](0012/bls-F516100.webp) | Mango roh | Mango raw |
| [bls-F516400](0012/bls-F516400.webp) | Mango getrocknet | Mango dried |
| [bls-F516600](0012/bls-F516600.webp) | Mangosaft | Mango juice |
| [bls-F516700](0012/bls-F516700.webp) | Mangonektar | Mango nectar |
| [bls-F516902](0012/bls-F516902.webp) | Mango gezuckert, Konserve, abgetropft | Mango sugared, canned, drained |
| [bls-F517100](0012/bls-F517100.webp) | Papaya roh | Papaya raw |
| [bls-F517400](0012/bls-F517400.webp) | Papaya getrocknet | Papaya dried |
| [bls-F517902](0012/bls-F517902.webp) | Papaya gezuckert, Konserve, abgetropft | Papaya sugared, canned, drained |
| [bls-F522100](0012/bls-F522100.webp) | Lulo/Naranjilla, roh | Naranjilla raw |
| [bls-F523100](0012/bls-F523100.webp) | Brotfrucht roh | Breadfruit raw |
| [bls-F524100](0012/bls-F524100.webp) | Cherimoya roh | Cherimoya raw |
| [bls-F529100](0012/bls-F529100.webp) | Japanische Wollmispel/Loquat, roh | Japanese medlar/loquat, raw |


## Tanda 0013: melones, cítricos y primeras verduras

100 WebP finales de 1024×1024 revisados en nueve hojas de contacto; 14 casos revisados también a tamaño completo. Una salida independiente del generador integrado por código; las referencias CIQUAL solo aportan el estilo. No hay integración móvil.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0013-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0013-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0013-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0013-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0013-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0013-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0013-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0013-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0013-09.jpg)

Se distinguen el cantalupo naranja y el melón de pulpa verde, así como el plátano macho crudo, hervido, guisado, horneado, cocinado en sartén sin grasa y seco. El seco muestra deshidratación; los chips de banana fritos muestran textura crujiente. Los concentrados de limón y lima son líquidos concentrados en ramequín, sin convertirlos en polvo. Las conservas escurridas no tienen líquido acumulado. Las propiedades de azúcar, edulcorantes y grasa no se certifican con símbolos ni ingredientes colocados al lado.

La feijoa conserva piel verde, pulpa clara y centro translúcido, conforme a [UC ANR](https://ucanr.edu/node/109899/printable/print) y la [especificación de Foodstuffs](https://www.foodstuffs.co.nz/-/media/Produce-Specifications/PS%20-%20Feijoa%202.pdf). El rambután tiene cubierta pilosa y arilo blanco, descritos por [NParks](https://www.nparks.gov.sg/florafaunaweb/flora/3/0/3042). La preparación de plátano macho deshidratado en rodajas es una elección editorial compatible con [FAO](https://www.fao.org/4/v5030e/V5030E0o.htm), sin afirmar que BLS fije su corte o madurez.

Para `Suppengrün`, el nombre alemán precisa una mezcla de verduras para sopa: zanahoria, apionabo, puerro y perejil incorporado, según [BZfE](https://www.bzfe.de/kueche-und-alltag/kochen/how-to-obst-und-gemuese/how-to-sellerie). No se cambia el nombre inglés oficial `Mirepoix`. Kaisergemüse conserva solo zanahoria, coliflor y brócoli. Las variantes congeladas sin cocinar muestran escarcha discreta; las cocinadas ya no la tienen. La achicoria azúcar es un cogollo alto verde, distinto del witloof blanco, de acuerdo con [RHS](https://www.rhs.org.uk/vegetables/chicory/grow-your-own?type=v). La mezcla encurtida Puszta y las salsas genéricas son opciones ilustrativas, no recetas oficiales.

Correcciones visuales registradas: 0. Casos abiertos a tamaño completo: `bls-F545400`, `bls-F563100`, `bls-F564100`, `bls-F601300`, `bls-F605100`, `bls-F820000`, `bls-F850100`, `bls-F957900`, `bls-G090200`, `bls-G093100`, `bls-G093200`, `bls-G093400`, `bls-G101182`, `bls-G109100`. Los nombres DE/EN siguen literales; las fuentes editoriales no validan las fichas ni sus nutrientes.

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-F532100](0013/bls-F532100.webp) | Netzmelone/Cantaloupmelone, roh | Musk melon/cantaloup, raw |
| [bls-F533100](0013/bls-F533100.webp) | Honigmelone roh | Honeydew melon raw |
| [bls-F533600](0013/bls-F533600.webp) | Honigmelonensaft | Honeydew melon juice |
| [bls-F535100](0013/bls-F535100.webp) | Wassermelone roh | Watermelon raw |
| [bls-F545100](0013/bls-F545100.webp) | Kochbanane roh | Plantain raw |
| [bls-F545132](0013/bls-F545132.webp) | Kochbanane gekocht | Plantain boiled |
| [bls-F545142](0013/bls-F545142.webp) | Kochbanane geschmort ohne Fett | Plantain braised without fat |
| [bls-F545152](0013/bls-F545152.webp) | Kochbanane gedünstet | Plantain stewed |
| [bls-F545162](0013/bls-F545162.webp) | Kochbanane gebacken | Plantain baked |
| [bls-F545182](0013/bls-F545182.webp) | Kochbanane gebraten ohne Fett (Pfanne) | Plantain fried without fat (pan) |
| [bls-F545400](0013/bls-F545400.webp) | Kochbanane getrocknet | Plantain dried |
| [bls-F549100](0013/bls-F549100.webp) | Jackfrucht roh | Jackfruit raw |
| [bls-F552100](0013/bls-F552100.webp) | Kapstachelbeere/Physalis, roh | Cape gooseberry raw |
| [bls-F552600](0013/bls-F552600.webp) | Kapstachelbeersaft/Physalissaft | Cape gooseberry juice |
| [bls-F553100](0013/bls-F553100.webp) | Karambole/Sternfrucht, roh | Carambola/star fruit, raw |
| [bls-F556100](0013/bls-F556100.webp) | Kaktusfeige roh | Prickly pear raw |
| [bls-F559100](0013/bls-F559100.webp) | Rambutan roh | Rambutan raw |
| [bls-F563100](0013/bls-F563100.webp) | Feijoa/Ananas-Guave, roh | Feijoa/pineapple guava, raw |
| [bls-F564100](0013/bls-F564100.webp) | Mangostane roh | Mangosteen raw |
| [bls-F564600](0013/bls-F564600.webp) | Mangostanesaft | Mangosteen juice |
| [bls-F572100](0013/bls-F572100.webp) | Tamarillo roh | Tamarillo/tree tomato, raw |
| [bls-F591902](0013/bls-F591902.webp) | Ananas ungesüßt, Konserve, abgetropft | Pineapple unsweetened, canned, drained |
| [bls-F597902](0013/bls-F597902.webp) | Ananas mit Süßungsmitteln, Konserve, abgetropft | Pineapple with artificial sweeteners, canned, drained |
| [bls-F5A1902](0013/bls-F5A1902.webp) | Ananas in Fruchtsaft, Konserve, abgetropft | Pineapple in juice, canned, drained |
| [bls-F601100](0013/bls-F601100.webp) | Zitrone roh | Lemon raw |
| [bls-F601300](0013/bls-F601300.webp) | Zitronensaft Konzentrat | Lemon concentrate |
| [bls-F601600](0013/bls-F601600.webp) | Zitronensaft | Lemon juice |
| [bls-F602100](0013/bls-F602100.webp) | Limette roh | Lime raw |
| [bls-F602300](0013/bls-F602300.webp) | Limettensaft Konzentrat | Lime concentrate |
| [bls-F602600](0013/bls-F602600.webp) | Limettensaft | Lime juice |
| [bls-F603100](0013/bls-F603100.webp) | Orange roh | Orange raw |
| [bls-F603600](0013/bls-F603600.webp) | Orangensaft | Orange juice |
| [bls-F603700](0013/bls-F603700.webp) | Orangennektar | Orange nectar |
| [bls-F604100](0013/bls-F604100.webp) | Grapefruit roh | Grapefruit raw |
| [bls-F604600](0013/bls-F604600.webp) | Grapefruitsaft | Grapefruit juice |
| [bls-F605100](0013/bls-F605100.webp) | Pampelmuse/Pomelo, roh | Pomelo raw |
| [bls-F605600](0013/bls-F605600.webp) | Pampelmusensaft/Pomelosaft | Pomelo juice |
| [bls-F606100](0013/bls-F606100.webp) | Mandarine roh | Mandarin raw |
| [bls-F606600](0013/bls-F606600.webp) | Mandarinensaft | Mandarin juice |
| [bls-F606902](0013/bls-F606902.webp) | Mandarine gezuckert, Konserve, abgetropft | Mandarin sugared, canned, drained |
| [bls-F607100](0013/bls-F607100.webp) | Clementine roh | Clementine raw |
| [bls-F607600](0013/bls-F607600.webp) | Clementinensaft | Clementine juice |
| [bls-F608100](0013/bls-F608100.webp) | Satsuma roh | Satsuma mandarin raw |
| [bls-F608600](0013/bls-F608600.webp) | Satsumasaft | Satsuma mandarin juice |
| [bls-F609100](0013/bls-F609100.webp) | Tangerine roh | Tangerine raw |
| [bls-F609600](0013/bls-F609600.webp) | Tangerinensaft | Tangerine juice |
| [bls-F613100](0013/bls-F613100.webp) | Kumquat roh | Kumquat raw |
| [bls-F614600](0013/bls-F614600.webp) | Orangennektar mit Süßungsmitteln | Orange nectar with artificial sweeteners |
| [bls-F640902](0013/bls-F640902.webp) | Mandarine ungesüßt, Konserve, abgetropft | Mandarin unsweetened, canned, drained |
| [bls-F6A6902](0013/bls-F6A6902.webp) | Mandarine in Fruchtsaft, Konserve, abgetropft | Mandarin in juice, canned, drained |
| [bls-F6B6902](0013/bls-F6B6902.webp) | Mandarine mit Süßungsmitteln, Konserve, abgetropft | Mandarin with artificial sweeteners, canned, drained |
| [bls-F820000](0013/bls-F820000.webp) | Fruchtschnitte/Fruchtriegel | Fruit bar |
| [bls-F840100](0013/bls-F840100.webp) | Rosine/Sultanine (Weinbeere getrocknet) | Raisin/sultana (grape dried) |
| [bls-F840300](0013/bls-F840300.webp) | Korinthe (Weinbeere getrocknet) | Currant (grape dried) |
| [bls-F850100](0013/bls-F850100.webp) | Bananenchips frittiert, gesüßt | Banana crips/banana chips, deep-fried, sweetened |
| [bls-F900900](0013/bls-F900900.webp) | Rote Grütze gezuckert, Konserve | Red fruit jelly sugared, canned |
| [bls-F921900](0013/bls-F921900.webp) | Apfelkompott/Apfelmus, gezuckert, Konserve | Apple sauce/apple compote, sugared, canned |
| [bls-F923900](0013/bls-F923900.webp) | Apfelkompott/Apfelmark, ungesüßt, Konserve | Apple sauce/apple compote, unsweetened, canned |
| [bls-F928900](0013/bls-F928900.webp) | Apfelkompott/Apfelmus, mit Süßungsmitteln, Konserve | Apple sauce/apple compote, with artificial sweeteners, canned |
| [bls-F957900](0013/bls-F957900.webp) | Rhabarberkompott mit einer Zuckerart und Süßungsmitteln, Konserve | Rhubarb compote with sugar and artificial sweeteners, canned |
| [bls-F960800](0013/bls-F960800.webp) | Cashewnussmus | Cashew butter (100 % pure) |
| [bls-F971900](0013/bls-F971900.webp) | Fruchtsoße gezuckert, Konserve | Fruit sauce sugared, canned |
| [bls-G012902](0013/bls-G012902.webp) | Kapern gesäuert, abgetropft | Capers pickled, canned, drained |
| [bls-G061000](0013/bls-G061000.webp) | Basilikum roh | Basil raw |
| [bls-G081100](0013/bls-G081100.webp) | Schnittlauch roh | Chives raw |
| [bls-G081400](0013/bls-G081400.webp) | Schnittlauch getrocknet | Chives dried |
| [bls-G090100](0013/bls-G090100.webp) | Gemüsemischung Kaisergemüse, roh | Mixed vegetables (carrots, cauliflower and broccoli florets) raw |
| [bls-G090132](0013/bls-G090132.webp) | Gemüsemischung Kaisergemüse, gekocht | Mixed vegetables (carrots, cauliflower and broccoli florets) boiled |
| [bls-G090142](0013/bls-G090142.webp) | Gemüsemischung Kaisergemüse, geschmort ohne Fett | Mixed vegetables (carrots, cauliflower and broccoli florets) braised without fat |
| [bls-G090152](0013/bls-G090152.webp) | Gemüsemischung Kaisergemüse, gedünstet | Mixed vegetables (carrots, cauliflower and broccoli florets) stewed |
| [bls-G090162](0013/bls-G090162.webp) | Gemüsemischung Kaisergemüse, gebacken | Mixed vegetables (carrots, cauliflower and broccoli florets) baked |
| [bls-G090182](0013/bls-G090182.webp) | Gemüsemischung Kaisergemüse, gebraten ohne Fett (Pfanne) | Mixed vegetables (carrots, cauliflower and broccoli florets) fried without fat (pan) |
| [bls-G090200](0013/bls-G090200.webp) | Gemüsemischung Kaisergemüse, tiefgefroren | Mixed vegetables (carrots, cauliflower and broccoli florets) deep-frozen |
| [bls-G090232](0013/bls-G090232.webp) | Gemüsemischung Kaisergemüse, tiefgefroren, gekocht | Mixed vegetables (carrots, cauliflower and broccoli florets) deep-frozen, boiled |
| [bls-G090242](0013/bls-G090242.webp) | Gemüsemischung Kaisergemüse, tiefgefroren, geschmort ohne Fett | Mixed vegetables (carrots, cauliflower and broccoli florets) deep-frozen, braised without fat |
| [bls-G090252](0013/bls-G090252.webp) | Gemüsemischung Kaisergemüse, tiefgefroren, gedünstet | Mixed vegetables (carrots, cauliflower and broccoli florets) deep-frozen, stewed |
| [bls-G090262](0013/bls-G090262.webp) | Gemüsemischung Kaisergemüse, tiefgefroren, gebacken | Mixed vegetables (carrots, cauliflower and broccoli florets) deep-frozen, baked |
| [bls-G090282](0013/bls-G090282.webp) | Gemüsemischung Kaisergemüse, tiefgefroren, gebraten ohne Fett (Pfanne) | Mixed vegetables (carrots, cauliflower and broccoli florets) deep-frozen, fried without fat (pan) |
| [bls-G090600](0013/bls-G090600.webp) | Gemüsesaft aus Gemüsemischung | Mixed vegetables juice |
| [bls-G090802](0013/bls-G090802.webp) | Gemüsemischung gesäuert (Puszta Salat) abgetropft | Mixed vegetables pickled, drained |
| [bls-G093100](0013/bls-G093100.webp) | Suppengrün/Suppenkraut, roh | Mirepoix raw |
| [bls-G093132](0013/bls-G093132.webp) | Suppengrün/Suppenkraut, gekocht | Mirepoix boiled |
| [bls-G093200](0013/bls-G093200.webp) | Suppengrün/Suppenkraut, tiefgefroren | Mirepoix deep-frozen |
| [bls-G093232](0013/bls-G093232.webp) | Suppengrün/Suppenkraut, tiefgefroren, gekocht | Mirepoix deep-frozen, boiled |
| [bls-G093400](0013/bls-G093400.webp) | Suppengrün/Suppenkraut, getrocknet | Mirepoix dried |
| [bls-G093432](0013/bls-G093432.webp) | Suppengrün/Suppenkraut, getrocknet, gekocht | Mirepoix dried, boiled |
| [bls-G101100](0013/bls-G101100.webp) | Chicoree roh | Witloof chicory raw |
| [bls-G101152](0013/bls-G101152.webp) | Chicoree gedünstet | Witloof chicory stewed |
| [bls-G101162](0013/bls-G101162.webp) | Chicoree gebacken | Witloof chicory baked |
| [bls-G101182](0013/bls-G101182.webp) | Chicoree gebraten ohne Fett (Pfanne) | Witloof chicory fried without fat (pan) |
| [bls-G102100](0013/bls-G102100.webp) | Endivie/Escariol, roh | Endive/escarole, raw |
| [bls-G103100](0013/bls-G103100.webp) | Eisbergsalat roh | Iceberg lettuce raw |
| [bls-G104100](0013/bls-G104100.webp) | Feldsalat/Rapunzel, roh | Lamb's lettuce raw |
| [bls-G105100](0013/bls-G105100.webp) | Kopfsalat roh | Butterhead lettuce raw |
| [bls-G106100](0013/bls-G106100.webp) | Radicchio roh | Radicchio/red Italian chicory, raw |
| [bls-G107100](0013/bls-G107100.webp) | Römischer Salat/Romanasalat, roh | Cos lettuce/Romaine lettuce, raw |
| [bls-G108100](0013/bls-G108100.webp) | Schnittsalat/Pflücksalat, roh | Looseleaf lettuce raw |
| [bls-G109100](0013/bls-G109100.webp) | Zuckerhutsalat roh | Sugar loaf chicory raw |
| [bls-G130100](0013/bls-G130100.webp) | Rucola roh | Rocket raw |
| [bls-G210132](0013/bls-G210132.webp) | Spinat gekocht | Spinach boiled |


## Tanda 0014: hojas verdes, coles y colinabo

100 WebP finales opacos de 1024×1024 revisados en nueve hojas de contacto; 18 casos revisados también a tamaño completo. Cada código tiene una salida independiente del generador integrado de Codex. Las referencias CIQUAL solo aportan el estilo. BLS sigue fuera de la app.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0014-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0014-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0014-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0014-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0014-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0014-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0014-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0014-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0014-09.jpg)

La espinaca común se distingue del amaranto de hoja (`Gemüseamaranth`, `Chinese spinach`) y de la espinaca de Nueva Zelanda. Para el amaranto se elige una variedad ilustrativa de hoja verde, compatible con la descripción de [FAO para Amaranthus tricolor](https://ecocrop.apps.fao.org/ecocrop/srv/en/cropView?id=2190). No se representa grano de amaranto ni espinaca acuática. La espinaca de Nueva Zelanda muestra hojas triangulares carnosas, de acuerdo con [Australian National University](https://apsa.anu.edu.au/samples/sample.php?id=81-4-3) y [Flora Malesiana](https://repository.naturalis.nl/pub/532550/FM1S1948004001054.pdf). Son decisiones editoriales para ilustrar los nombres, no una certificación de especie o variedad de cada ficha.

El apio conserva sus pencas acanaladas; la acelga incluye hojas y nervios blancos anchos. Para el perejil se elige una variedad de hoja plana; el seco tiene escamas deshidratadas y el congelado, escarcha discreta. Ortiga y diente de león conservan sus bordes dentados; la acedera se representa con hojas en flecha, conforme a [RHS](https://www.rhs.org.uk/plants/41751/rumex-acetosa/details) y [Kew](https://growwild.kew.org/plants/common-sorrel). El berro de jardín se muestra cortado, sin tierra ni bandeja de cultivo.

`Chinakohl` se ilustra como repollo chino alargado, de hojas claras arrugadas y nervios blancos, descrito por [BZfE](https://www.bzfe.de/presse/pressemeldungen-archiv/zeit-fuer-heimischen-chinakohl). Se diferencia del pak choi, de hojas en cuchara y pencas carnosas, y de la col rizada. El colinabo muestra su tallo engrosado y una cuña clara, sin convertirlo en una raíz de nabo. La coliflor conserva floretes blancos; el brócoli, verdes; las coles de Bruselas, cogollos pequeños.

Las verduras hervidas, al vapor, braseadas y guisadas se muestran tiernas y sin tostado; las horneadas tienen bordes secos ligeramente dorados y las de sartén, marcas moderadas de contacto. No se añaden salsas, aceite, queso, rebozados ni guarniciones. Los congelados sin cocinar llevan escarcha; los cocinados desde congelado ya no. Las conservas y la coliflor encurtida se muestran escurridas, sin envases. El zumo de espinaca es líquido en vaso sin marcas, sin hielo ni decoración. La fotografía no demuestra ausencia de grasa ni composición nutricional.

Correcciones visuales registradas: 1 (`bls-G331182`): se regeneró el colinabo de sartén para quitar hojas añadidas y mostrar solo trozos pelados del tallo engrosado. Casos abiertos a tamaño completo: `bls-G212100`, `bls-G213100`, `bls-G210600`, `bls-G211200`, `bls-G250100`, `bls-G250400`, `bls-G261100`, `bls-G262100`, `bls-G263100`, `bls-G280100`, `bls-G311242`, `bls-G311802`, `bls-G321100`, `bls-G322902`, `bls-G324100`, `bls-G331100`, `bls-G331182`, `bls-G332200`. Nombres DE/EN literales, incluido `prepard` en el nombre inglés oficial del pak choi guisado. Las fuentes editoriales no modifican ni validan las fichas, sus nutrientes o una ración de 100 g.

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-G210232](0014/bls-G210232.webp) | Spinat tiefgefroren, gekocht | Spinach deep-frozen, boiled |
| [bls-G210252](0014/bls-G210252.webp) | Spinat tiefgefroren, gedünstet | Spinach deep-frozen, stewed |
| [bls-G210262](0014/bls-G210262.webp) | Spinat tiefgefroren, gebacken | Spinach deep-frozen, baked |
| [bls-G210282](0014/bls-G210282.webp) | Spinat tiefgefroren, gebraten ohne Fett (Pfanne) | Spinach deep-frozen, fried without fat (pan) |
| [bls-G210600](0014/bls-G210600.webp) | Gemüsesaft aus Spinat | Spinach juice |
| [bls-G210902](0014/bls-G210902.webp) | Spinat Konserve, abgetropft | Spinach canned, drained |
| [bls-G211100](0014/bls-G211100.webp) | Spinat roh | Spinach raw |
| [bls-G211152](0014/bls-G211152.webp) | Spinat gedünstet | Spinach stewed |
| [bls-G211162](0014/bls-G211162.webp) | Spinat gebacken | Spinach baked |
| [bls-G211182](0014/bls-G211182.webp) | Spinat gebraten ohne Fett (Pfanne) | Spinach fried without fat (pan) |
| [bls-G211200](0014/bls-G211200.webp) | Spinat tiefgefroren | Spinach deep-frozen |
| [bls-G212100](0014/bls-G212100.webp) | Gemüseamaranth roh | Chinese spinach raw |
| [bls-G212152](0014/bls-G212152.webp) | Gemüseamaranth gedünstet | Chinese spinach stewed |
| [bls-G212182](0014/bls-G212182.webp) | Gemüseamaranth gebraten ohne Fett (Pfanne) | Chinese spinach fried without fat (pan) |
| [bls-G213100](0014/bls-G213100.webp) | Neuseeländer Spinat roh | New Zealand spinach raw |
| [bls-G213132](0014/bls-G213132.webp) | Neuseeländer Spinat gekocht | New Zealand spinach boiled |
| [bls-G213152](0014/bls-G213152.webp) | Neuseeländer Spinat gedünstet | New Zealand spinach stewed |
| [bls-G213182](0014/bls-G213182.webp) | Neuseeländer Spinat gebraten ohne Fett (Pfanne) | New Zealand spinach fried without fat (pan) |
| [bls-G220100](0014/bls-G220100.webp) | Bleichsellerie roh | Stalk celery raw |
| [bls-G220132](0014/bls-G220132.webp) | Bleichsellerie gekocht | Stalk celery boiled |
| [bls-G220142](0014/bls-G220142.webp) | Bleichsellerie geschmort ohne Fett | Stalk celery braised without fat |
| [bls-G220152](0014/bls-G220152.webp) | Bleichsellerie gedünstet | Stalk celery stewed |
| [bls-G220162](0014/bls-G220162.webp) | Bleichsellerie gebacken | Stalk celery baked |
| [bls-G221182](0014/bls-G221182.webp) | Bleichsellerie gebraten ohne Fett (Pfanne) | Stalk celery fried without fat (pan) |
| [bls-G230100](0014/bls-G230100.webp) | Mangold roh | Chard/leaf beet, raw |
| [bls-G230132](0014/bls-G230132.webp) | Mangold gekocht | Chard/leaf beet, boiled |
| [bls-G230142](0014/bls-G230142.webp) | Mangold geschmort ohne Fett | Chard/leaf beet, braised without fat |
| [bls-G230152](0014/bls-G230152.webp) | Mangold gedünstet | Chard/leaf beet, stewed |
| [bls-G230162](0014/bls-G230162.webp) | Mangold gebacken | Chard/leaf beet, baked |
| [bls-G230182](0014/bls-G230182.webp) | Mangold gebraten ohne Fett (Pfanne) | Chard/leaf beet, fried without fat (pan) |
| [bls-G250100](0014/bls-G250100.webp) | Petersilienblatt roh | Parsley leaf raw |
| [bls-G250200](0014/bls-G250200.webp) | Petersilienblatt tiefgefroren | Parsley leaf deep-frozen |
| [bls-G250400](0014/bls-G250400.webp) | Petersilienblatt getrocknet | Parsley leaf dried |
| [bls-G261100](0014/bls-G261100.webp) | Brennnessel roh | Stinging nettle raw |
| [bls-G261132](0014/bls-G261132.webp) | Brennnessel gekocht | Stinging nettle boiled |
| [bls-G261152](0014/bls-G261152.webp) | Brennnessel gedünstet | Stinging nettle stewed |
| [bls-G262100](0014/bls-G262100.webp) | Löwenzahn roh | Dandelion raw |
| [bls-G263100](0014/bls-G263100.webp) | Sauerampfer roh | Sorrel raw |
| [bls-G263132](0014/bls-G263132.webp) | Sauerampfer gekocht | Sorrel boiled |
| [bls-G263152](0014/bls-G263152.webp) | Sauerampfer gedünstet | Sorrel stewed |
| [bls-G280100](0014/bls-G280100.webp) | Gartenkresse roh | Garden cress raw |
| [bls-G311100](0014/bls-G311100.webp) | Blumenkohl roh | Cauliflower raw |
| [bls-G311132](0014/bls-G311132.webp) | Blumenkohl gekocht | Cauliflower boiled |
| [bls-G311142](0014/bls-G311142.webp) | Blumenkohl gedämpft | Cauliflower steamed |
| [bls-G311152](0014/bls-G311152.webp) | Blumenkohl gedünstet | Cauliflower stewed |
| [bls-G311162](0014/bls-G311162.webp) | Blumenkohl gebacken | Cauliflower baked |
| [bls-G311182](0014/bls-G311182.webp) | Blumenkohl gebraten ohne Fett (Pfanne) | Cauliflower fried without fat (pan) |
| [bls-G311200](0014/bls-G311200.webp) | Blumenkohl tiefgefroren | Cauliflower deep-frozen |
| [bls-G311232](0014/bls-G311232.webp) | Blumenkohl tiefgefroren, gekocht | Cauliflower deep-frozen, boiled |
| [bls-G311242](0014/bls-G311242.webp) | Blumenkohl tiefgefroren, gedämpft | Cauliflower deep-frozen, steamed |
| [bls-G311252](0014/bls-G311252.webp) | Blumenkohl tiefgefroren, gedünstet | Cauliflower deep-frozen, stewed |
| [bls-G311262](0014/bls-G311262.webp) | Blumenkohl tiefgefroren, gebacken | Cauliflower deep-frozen, baked |
| [bls-G311282](0014/bls-G311282.webp) | Blumenkohl tiefgefroren, gebraten ohne Fett (Pfanne) | Cauliflower deep-frozen, fried without fat (pan) |
| [bls-G311802](0014/bls-G311802.webp) | Blumenkohl gesäuert, abgetropft | Cauliflower pickled, drained |
| [bls-G312100](0014/bls-G312100.webp) | Broccoli roh | Broccoli raw |
| [bls-G312132](0014/bls-G312132.webp) | Broccoli gekocht | Broccoli boiled |
| [bls-G312152](0014/bls-G312152.webp) | Broccoli gedünstet | Broccoli stewed |
| [bls-G312162](0014/bls-G312162.webp) | Broccoli gebacken | Broccoli baked |
| [bls-G312182](0014/bls-G312182.webp) | Broccoli gebraten ohne Fett (Pfanne) | Broccoli fried without fat (pan) |
| [bls-G312200](0014/bls-G312200.webp) | Broccoli tiefgefroren | Broccoli deep-frozen |
| [bls-G312232](0014/bls-G312232.webp) | Broccoli tiefgefroren, gekocht | Broccoli deep-frozen, boiled |
| [bls-G312252](0014/bls-G312252.webp) | Broccoli tiefgefroren, gedünstet | Broccoli deep-frozen, stewed |
| [bls-G312262](0014/bls-G312262.webp) | Broccoli tiefgefroren, gebacken | Broccoli deep-frozen, baked |
| [bls-G312282](0014/bls-G312282.webp) | Broccoli tiefgefroren, gebraten ohne Fett (Pfanne) | Broccoli deep-frozen, fried without fat (pan) |
| [bls-G321100](0014/bls-G321100.webp) | Chinakohl roh | Chinese white cabbage raw |
| [bls-G321132](0014/bls-G321132.webp) | Chinakohl gekocht | Chinese white cabbage boiled |
| [bls-G321152](0014/bls-G321152.webp) | Chinakohl gedünstet | Chinese white cabbage stewed |
| [bls-G321162](0014/bls-G321162.webp) | Chinakohl gebacken | Chinese white cabbage baked |
| [bls-G321182](0014/bls-G321182.webp) | Chinakohl gebraten ohne Fett (Pfanne) | Chinese white cabbage fried without fat (pan) |
| [bls-G322100](0014/bls-G322100.webp) | Grünkohl roh | Curly kale raw |
| [bls-G322132](0014/bls-G322132.webp) | Grünkohl gekocht | Curly kale boiled |
| [bls-G322142](0014/bls-G322142.webp) | Grünkohl gedämpft | Curly kale steamed |
| [bls-G322152](0014/bls-G322152.webp) | Grünkohl gedünstet | Curly kale stewed |
| [bls-G322182](0014/bls-G322182.webp) | Grünkohl gebraten ohne Fett (Pfanne) | Curly kale fried without fat (pan) |
| [bls-G322200](0014/bls-G322200.webp) | Grünkohl tiefgefroren | Curly kale deep-frozen |
| [bls-G322232](0014/bls-G322232.webp) | Grünkohl tiefgefroren, gekocht | Curly kale deep-frozen, boiled |
| [bls-G322242](0014/bls-G322242.webp) | Grünkohl tiefgefroren, gedämpft | Curly kale deep-frozen, steamed |
| [bls-G322252](0014/bls-G322252.webp) | Grünkohl tiefgefroren, gedünstet | Curly kale deep-frozen, stewed |
| [bls-G322282](0014/bls-G322282.webp) | Grünkohl tiefgefroren, gebraten ohne Fett (Pfanne) | Curly kale deep-frozen, fried without fat (pan) |
| [bls-G322902](0014/bls-G322902.webp) | Grünkohl Konserve, abgetropft | Curly kale canned, drained |
| [bls-G324100](0014/bls-G324100.webp) | Pak Choi roh | Pak choi raw |
| [bls-G324132](0014/bls-G324132.webp) | Pak Choi gekocht | Pak choi boiled |
| [bls-G324152](0014/bls-G324152.webp) | Pak Choi gedünstet | Pak choi stewed (prepard without fat) |
| [bls-G324182](0014/bls-G324182.webp) | Pak Choi gebraten ohne Fett (Pfanne) | Pak choi fried without fat (pan) |
| [bls-G331100](0014/bls-G331100.webp) | Kohlrabi roh | Kohlrabi raw |
| [bls-G331132](0014/bls-G331132.webp) | Kohlrabi gekocht | Kohlrabi boiled |
| [bls-G331152](0014/bls-G331152.webp) | Kohlrabi gedünstet | Kohlrabi stewed |
| [bls-G331162](0014/bls-G331162.webp) | Kohlrabi gebacken | Kohlrabi baked |
| [bls-G331182](0014/bls-G331182.webp) | Kohlrabi gebraten ohne Fett (Pfanne) | Kohlrabi fried without fat (pan) |
| [bls-G331902](0014/bls-G331902.webp) | Kohlrabi Konserve, abgetropft | Kohlrabi canned, drained |
| [bls-G332100](0014/bls-G332100.webp) | Rosenkohl roh | Brussels sprouts raw |
| [bls-G332132](0014/bls-G332132.webp) | Rosenkohl gekocht | Brussels sprouts boiled |
| [bls-G332152](0014/bls-G332152.webp) | Rosenkohl gedünstet | Brussels sprouts stewed |
| [bls-G332162](0014/bls-G332162.webp) | Rosenkohl gebacken | Brussels sprouts baked |
| [bls-G332182](0014/bls-G332182.webp) | Rosenkohl gebraten ohne Fett (Pfanne) | Brussels sprouts fried without fat (pan) |
| [bls-G332200](0014/bls-G332200.webp) | Rosenkohl tiefgefroren | Brussels sprouts deep-frozen |
| [bls-G332232](0014/bls-G332232.webp) | Rosenkohl tiefgefroren, gekocht | Brussels sprouts deep-frozen, boiled |
| [bls-G332252](0014/bls-G332252.webp) | Rosenkohl tiefgefroren, gedünstet | Brussels sprouts deep-frozen, stewed |
| [bls-G332262](0014/bls-G332262.webp) | Rosenkohl tiefgefroren, gebacken | Brussels sprouts deep-frozen, baked |
| [bls-G332902](0014/bls-G332902.webp) | Rosenkohl Konserve, abgetropft | Brussels sprouts canned, drained |

## Tanda 0015: coles, alcachofas, hinojo y tallos

100 WebP finales opacos de 1024×1024 revisados en nueve hojas de contacto; 18 casos comprobados también a tamaño completo. Una salida independiente del generador integrado de Codex por código. Las referencias CIQUAL aportan solo el estilo. BLS sigue fuera de la app.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0015-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0015-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0015-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0015-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0015-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0015-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0015-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0015-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0015-09.jpg)

Se distinguen la lombarda morada, el repollo blanco redondo, la col de Saboya de hojas abullonadas y la col puntiaguda. La lombarda en conserva `undrained` conserva líquido rojizo visible; las conservas `drained` se muestran sin líquido acumulado. El chucrut son hebras finas de col fermentada, también cuando figura crudo; no se convierte en una ensalada de col fresca. El chucrut al vino mantiene el vino incorporado, sin copa, botella o uvas. Su zumo es un líquido turbio amarillo pálido, sin hebras ni hielo. Romanesco conserva sus floretes cónicos en espiral.

Las alcachofas crudas y hervidas muestran capullos de brácteas superpuestas; las conservas muestran corazones tiernos. Las variantes en aceite y escurridas conservan solo una película residual, sin charco, especias o limón. Para el cardo se representan pencas carnosas acanaladas, conforme a [NC State Extension](https://plants.ces.ncsu.edu/plants/cynara-cardunculus/common-name/cardoon/); no capullos de alcachofa ni flores de cardo. `Stielmus/Rübstiel` se representa con sus tallos tiernos y hojas jóvenes, de acuerdo con [BZfE](https://www.bzfe.de/presse/pressemeldungen-archiv/saison-fuer-stielmus), sin añadir raíces de nabo.

El hinojo de bulbo muestra su base blanca engrosada en capas, descrita por [RHS](https://www.rhs.org.uk/plants/158862/foeniculum-vulgare-var-azoricum/details). Para `Fenchelblatt/Bologneser Fenchel` se representan las hojas finamente divididas del hinojo dulce, diferenciadas del bulbo, según [RHS](https://www.rhs.org.uk/plants/43747/foeniculum-vulgare-var-dulce/details). El palmito muestra cilindros marfil y rodajas de anillos finos. Los espárragos se ilustran con una variedad blanca, una elección editorial entre las variedades descritas por [BZfE](https://www.bzfe.de/kueche-und-alltag/vom-acker-bis-zum-teller/spargel/spargel-vom-einkauf-in-die-kueche), sin afirmar que BLS certifique ese color para cada ficha.

La verdolaga tiene hojas pequeñas carnosas y tallos rojizos, conforme a [University of Wisconsin Extension](https://hort.extension.wisc.edu/articles/common-purslane-portulaca-oleracea/). Los puerros conservan los cilindros blancos y verdes en capas; la cebolla se ilustra con una variedad amarilla y capas interiores marfil. Hervido, vapor, braseado y guisado muestran ablandamiento sin costra; horno, sartén y parrilla incorporan solo las marcas de cocción correspondientes. El congelado sin cocinar tiene escarcha discreta y los cocinados desde congelado ya no. No hay guarniciones ni envases. Estas decisiones visuales no certifican especie, variedad, receta, contenido en grasa, alérgenos ni porción de 100 g. Los nombres DE/EN permanecen literales y las fichas y nutrientes oficiales no cambian.

Correcciones visuales registradas: 0. Casos abiertos a tamaño completo: `bls-G341900`, `bls-G344100`, `bls-G345100`, `bls-G345600`, `bls-G346100`, `bls-G350100`, `bls-G410100`, `bls-G410702`, `bls-G410732`, `bls-G414100`, `bls-G420100`, `bls-G430100`, `bls-G431100`, `bls-G440100`, `bls-G450100`, `bls-G450242`, `bls-G460100`, `bls-G480072`.

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-G341100](0015/bls-G341100.webp) | Rotkohl roh | Red cabbage raw |
| [bls-G341132](0015/bls-G341132.webp) | Rotkohl gekocht | Red cabbage boiled |
| [bls-G341142](0015/bls-G341142.webp) | Rotkohl geschmort ohne Fett | Red cabbage braised without fat |
| [bls-G341152](0015/bls-G341152.webp) | Rotkohl gedünstet | Red cabbage stewed |
| [bls-G341162](0015/bls-G341162.webp) | Rotkohl gebacken | Red cabbage baked |
| [bls-G341182](0015/bls-G341182.webp) | Rotkohl gebraten ohne Fett (Pfanne) | Red cabbage fried without fat (pan) |
| [bls-G341900](0015/bls-G341900.webp) | Rotkohlgemüse (küchenfertig) Konserve | Red cabbage canned undrained |
| [bls-G342100](0015/bls-G342100.webp) | Weißkohl roh | White cabbage raw |
| [bls-G342132](0015/bls-G342132.webp) | Weißkohl gekocht | White cabbage boiled |
| [bls-G342142](0015/bls-G342142.webp) | Weißkohl geschmort ohne Fett | White cabbage braised without fat |
| [bls-G342152](0015/bls-G342152.webp) | Weißkohl gedünstet | White cabbage stewed |
| [bls-G342162](0015/bls-G342162.webp) | Weißkohl gebacken | White cabbage baked |
| [bls-G342182](0015/bls-G342182.webp) | Weißkohl gebraten ohne Fett (Pfanne) | White cabbage fried without fat (pan) |
| [bls-G343100](0015/bls-G343100.webp) | Wirsing roh | Savoy cabbage raw |
| [bls-G343132](0015/bls-G343132.webp) | Wirsing gekocht | Savoy cabbage boiled |
| [bls-G343142](0015/bls-G343142.webp) | Wirsing geschmort ohne Fett | Savoy cabbage braised without fat |
| [bls-G343152](0015/bls-G343152.webp) | Wirsing gedünstet | Savoy cabbage stewed |
| [bls-G343162](0015/bls-G343162.webp) | Wirsing gebacken | Savoy cabbage baked |
| [bls-G343182](0015/bls-G343182.webp) | Wirsing gebraten ohne Fett (Pfanne) | Savoy cabbage fried without fat (pan) |
| [bls-G343902](0015/bls-G343902.webp) | Wirsing Konserve, abgetropft | Savoy cabbage canned, drained |
| [bls-G344100](0015/bls-G344100.webp) | Spitzkohl roh | Pointed cabbage raw |
| [bls-G344132](0015/bls-G344132.webp) | Spitzkohl gekocht | Pointed cabbage boiled |
| [bls-G344152](0015/bls-G344152.webp) | Spitzkohl gedünstet | Pointed cabbage stewed |
| [bls-G344162](0015/bls-G344162.webp) | Spitzkohl gebacken | Pointed cabbage baked |
| [bls-G344182](0015/bls-G344182.webp) | Spitzkohl gebraten ohne Fett (Pfanne) | Pointed cabbage fried without fat (pan) |
| [bls-G345032](0015/bls-G345032.webp) | Sauerkraut abgetropft, gekocht | Sauerkraut drained, boiled |
| [bls-G345042](0015/bls-G345042.webp) | Sauerkraut abgetropft, geschmort ohne Fett | Sauerkraut drained, braised without fat |
| [bls-G345062](0015/bls-G345062.webp) | Sauerkraut abgetropft, gebacken | Sauerkraut drained, baked |
| [bls-G345082](0015/bls-G345082.webp) | Sauerkraut abgetropft, gebraten ohne Fett (Pfanne) | Sauerkraut drained, fried without fat (pan) |
| [bls-G345100](0015/bls-G345100.webp) | Sauerkraut abgetropft, roh | Sauerkraut drained, raw |
| [bls-G345152](0015/bls-G345152.webp) | Sauerkraut abgetropft, gedünstet | Sauerkraut drained, stewed |
| [bls-G345600](0015/bls-G345600.webp) | Gemüsesaft aus Sauerkraut | Sauerkraut juice |
| [bls-G345902](0015/bls-G345902.webp) | Sauerkraut Konserve, abgetropft | Sauerkraut canned, drained |
| [bls-G346100](0015/bls-G346100.webp) | Weinsauerkraut roh | Wine sauerkraut raw |
| [bls-G346132](0015/bls-G346132.webp) | Weinsauerkraut gekocht | Wine sauerkraut boiled |
| [bls-G346152](0015/bls-G346152.webp) | Weinsauerkraut gedünstet | Wine sauerkraut stewed |
| [bls-G350100](0015/bls-G350100.webp) | Romanesco roh | Romanesco broccoli raw |
| [bls-G350132](0015/bls-G350132.webp) | Romanesco gekocht | Romanesco broccoli boiled |
| [bls-G350152](0015/bls-G350152.webp) | Romanesco gedünstet | Romanesco broccoli stewed |
| [bls-G350162](0015/bls-G350162.webp) | Romanesco gebacken | Romanesco broccoli baked |
| [bls-G350182](0015/bls-G350182.webp) | Romanesco gebraten ohne Fett (Pfanne) | Romanesco broccoli fried without fat (pan) |
| [bls-G410100](0015/bls-G410100.webp) | Artischocke roh | Artichokes raw |
| [bls-G410132](0015/bls-G410132.webp) | Artischocke gekocht | Artichokes boiled |
| [bls-G410702](0015/bls-G410702.webp) | Artischocke in Öl, Konserve, abgetropft | Artichokes in oil, canned, drained |
| [bls-G410732](0015/bls-G410732.webp) | Artischocke in Öl, Konserve, abgetropft gekocht | Artichokes in oil, canned, drained boiled |
| [bls-G410902](0015/bls-G410902.webp) | Artischocke Konserve, abgetropft | Artichokes canned, drained |
| [bls-G414100](0015/bls-G414100.webp) | Gemüseartischocke/Kardone, roh | Cardoon raw |
| [bls-G414132](0015/bls-G414132.webp) | Gemüseartischocke/Kardone, gekocht | Cardoon boiled |
| [bls-G420100](0015/bls-G420100.webp) | Stielmus/Rübstiel, roh | Turnip tops/greens, raw |
| [bls-G420132](0015/bls-G420132.webp) | Stielmus/Rübstiel, gekocht | Turnip tops/greens, boiled |
| [bls-G420152](0015/bls-G420152.webp) | Stielmus/Rübstiel, gedünstet | Turnip tops/greens, stewed |
| [bls-G420182](0015/bls-G420182.webp) | Stielmus/Rübstiel, gebraten ohne Fett (Pfanne) | Turnip tops/greens, fried without fat (pan) |
| [bls-G430100](0015/bls-G430100.webp) | Gemüsefenchel roh | Fennel/Florence fennel, raw |
| [bls-G430132](0015/bls-G430132.webp) | Gemüsefenchel gekocht | Fennel/Florence fennel, boiled |
| [bls-G430152](0015/bls-G430152.webp) | Gemüsefenchel gedünstet | Fennel/Florence fennel, stewed |
| [bls-G430162](0015/bls-G430162.webp) | Gemüsefenchel gebacken | Fennel/Florence fennel, baked |
| [bls-G430182](0015/bls-G430182.webp) | Gemüsefenchel gebraten ohne Fett (Pfanne) | Fennel/Florence fennel, fried without fat (pan) |
| [bls-G431100](0015/bls-G431100.webp) | Fenchelblatt/Bologneser Fenchel, roh | Roman fennel/sweet fennel, raw |
| [bls-G440100](0015/bls-G440100.webp) | Palmenherz roh | Palm heart, raw |
| [bls-G440132](0015/bls-G440132.webp) | Palmenherz gekocht | Palm heart, boiled |
| [bls-G440902](0015/bls-G440902.webp) | Palmenherz Konserve, abgetropft | Palm heart, canned, drained |
| [bls-G450100](0015/bls-G450100.webp) | Spargel roh | Asparagus raw |
| [bls-G450132](0015/bls-G450132.webp) | Spargel gekocht | Asparagus boiled |
| [bls-G450142](0015/bls-G450142.webp) | Spargel gedämpft | Asparagus steamed |
| [bls-G450152](0015/bls-G450152.webp) | Spargel gedünstet | Asparagus stewed |
| [bls-G450162](0015/bls-G450162.webp) | Spargel gebacken | Asparagus baked |
| [bls-G450200](0015/bls-G450200.webp) | Spargel tiefgefroren | Asparagus deep-frozen |
| [bls-G450232](0015/bls-G450232.webp) | Spargel tiefgefroren, gekocht | Asparagus deep-frozen, boiled |
| [bls-G450242](0015/bls-G450242.webp) | Spargel tiefgefroren, gedämpft | Asparagus deep-frozen, steamed |
| [bls-G450252](0015/bls-G450252.webp) | Spargel tiefgefroren, gedünstet | Asparagus deep-frozen, stewed |
| [bls-G450262](0015/bls-G450262.webp) | Spargel tiefgefroren, gebacken | Asparagus deep-frozen, baked |
| [bls-G450282](0015/bls-G450282.webp) | Spargel tiefgefroren, gebraten ohne Fett (Pfanne) | Asparagus deep-frozen, fried without fat (pan) |
| [bls-G450902](0015/bls-G450902.webp) | Spargel Konserve, abgetropft | Asparagus canned, drained |
| [bls-G451082](0015/bls-G451082.webp) | Spargel gebraten ohne Fett (Pfanne) | Asparagus fried without fat (pan) |
| [bls-G460100](0015/bls-G460100.webp) | Portulak roh | Purslane raw |
| [bls-G460152](0015/bls-G460152.webp) | Portulak gedünstet | Purslane stewed |
| [bls-G470042](0015/bls-G470042.webp) | Porree/Lauch, geschmort ohne Fett | Leek braised without fat |
| [bls-G470100](0015/bls-G470100.webp) | Porree/Lauch, roh | Leek raw |
| [bls-G470132](0015/bls-G470132.webp) | Porree/Lauch, gekocht | Leek boiled |
| [bls-G470152](0015/bls-G470152.webp) | Porree/Lauch, gedünstet | Leek stewed |
| [bls-G470162](0015/bls-G470162.webp) | Porree/Lauch, gebacken | Leek baked |
| [bls-G470182](0015/bls-G470182.webp) | Porree/Lauch, gebraten ohne Fett (Pfanne) | Leek fried without fat (pan) |
| [bls-G470200](0015/bls-G470200.webp) | Porree/Lauch, tiefgefroren | Leek deep-frozen |
| [bls-G470232](0015/bls-G470232.webp) | Porree/Lauch, tiefgefroren, gekocht | Leek deep-frozen, boiled |
| [bls-G470242](0015/bls-G470242.webp) | Porree/Lauch, tiefgefroren, geschmort ohne Fett | Leek deep-frozen, braised without fat |
| [bls-G470252](0015/bls-G470252.webp) | Porree/Lauch, tiefgefroren, gedünstet | Leek deep-frozen, stewed |
| [bls-G470262](0015/bls-G470262.webp) | Porree/Lauch, tiefgefroren, gebacken | Leek deep-frozen, baked |
| [bls-G470282](0015/bls-G470282.webp) | Porree/Lauch, tiefgefroren, gebraten ohne Fett (Pfanne) | Leek deep-frozen, fried without fat (pan) |
| [bls-G480072](0015/bls-G480072.webp) | Speisezwiebel gegrillt | Onion grilled |
| [bls-G480100](0015/bls-G480100.webp) | Speisezwiebel roh | Onion raw |
| [bls-G480132](0015/bls-G480132.webp) | Speisezwiebel gekocht | Onion boiled |
| [bls-G480142](0015/bls-G480142.webp) | Speisezwiebel geschmort ohne Fett | Onion braised without fat |
| [bls-G480152](0015/bls-G480152.webp) | Speisezwiebel gedünstet | Onion stewed |
| [bls-G480162](0015/bls-G480162.webp) | Speisezwiebel gebacken | Onion baked |
| [bls-G480182](0015/bls-G480182.webp) | Speisezwiebel gebraten ohne Fett (Pfanne) | Onion fried without fat (pan) |
| [bls-G480200](0015/bls-G480200.webp) | Speisezwiebel tiefgefroren | Onion deep-frozen |
| [bls-G480232](0015/bls-G480232.webp) | Speisezwiebel tiefgefroren, gekocht | Onion deep-frozen, boiled |
| [bls-G480242](0015/bls-G480242.webp) | Speisezwiebel tiefgefroren, geschmort ohne Fett | Onion deep-frozen, braised without fat |
| [bls-G480252](0015/bls-G480252.webp) | Speisezwiebel tiefgefroren, gedünstet | Onion deep-frozen, stewed |
| [bls-G480262](0015/bls-G480262.webp) | Speisezwiebel tiefgefroren, gebacken | Onion deep-frozen, baked |


## Tanda 0016: cebollas, ajo, berenjena, pepino y pimientos

100 WebP finales opacos de 1024×1024 revisados en nueve hojas de contacto; 18 casos comprobados también a tamaño completo. Una generación independiente por código, mediante el generador integrado de Codex y referencias CIQUAL usadas solo para el estilo. BLS permanece fuera de la app.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0016-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0016-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0016-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0016-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0016-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0016-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0016-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0016-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0016-09.jpg)

Las cebolletas completas conservan sus hojas tubulares verdes; las fichas `ohne Laub` muestran solo la base blanca sin hojas. Las cebollitas perla y plateadas se ilustran como bulbos blancos pequeños; las chalotas son alargadas, con piel cobriza rosada y capas interiores claras con tonos lilas. Los nombres oficiales se mantienen literales, incluidas las grafías inglesas `Shalot boiled` y `Shalot stewed`. Las escamas deshidratadas se diferencian del polvo fino; no se representan como cebolla o ajo frito. Los zumos de cebolla y pepino son líquidos turbios pálidos en un vaso sin hielo ni sólidos.

El ajo conserva sus dientes curvos y puntiagudos. El ajo silvestre `Bärlauch` se ilustra con hojas elípticas verdes de pecíolos separados, conforme a [RHS: Allium ursinum](https://www.rhs.org.uk/plants/879/allium-ursinum/details), sin convertirlo en una cabeza de ajo ni añadir flores. La berenjena se ilustra con una variedad morada y pulpa clara; el pepino mantiene piel verde y centro húmedo con semillas. La okra muestra vainas alargadas acanaladas y cortes con semillas pequeñas, de acuerdo con [Texas A&M AgriLife Extension](https://aggie-horticulture.tamu.edu/vegetable/wp-content/uploads/sites/10/2013/09/EHT-058.pdf) e [Iowa State University Extension](https://spendsmart.extension.iastate.edu/produce-item/okra/).

Se respeta el verde, amarillo o rojo indicado para cada pimiento. Los dulces tienen paredes gruesas y forma lobulada hueca; los chiles son estrechos y puntiagudos. En las dos conservas de chile sin color especificado se elige una variedad verde a modo ilustrativo; BLS no certifica esa elección. Las conservas en aceite escurridas tienen solo una película residual, sin aceite acumulado; los encurtidos escurridos tampoco tienen salmuera acumulada. Las variantes asadas conservadas mantienen sus marcas de cocción. Hervido, braseado y guisado muestran ablandamiento sin costra; horno, parrilla y sartén llevan solo el dorado correspondiente. El congelado sin cocinar tiene escarcha discreta y el cocinado desde congelado no. El último alimento es tomate braseado sin grasa. No hay guarniciones, utensilios o envases.

Estas decisiones visuales no certifican especie, variedad, receta, grasa, alérgenos ni porción de 100 g. Las fichas, nutrientes y fuentes oficiales no cambian. Correcciones visuales registradas: 2. `bls-G480500`: La primera salida mostraba escamas gruesas, demasiado similares a cebolla granulada o deshidratada, en lugar de polvo fino. Se regeneró con textura homogénea de polvo fino; se revisó el WebP final a tamaño completo y se conservaron los originales descartados en el checkpoint. `bls-G490400`: La primera salida añadió una cabeza de ajo y dientes enteros junto a las láminas deshidratadas. Se regeneró mostrando únicamente láminas y escamas secas, sin cabeza ni dientes frescos; se revisó el WebP final a tamaño completo y se conservaron los originales descartados en el checkpoint. Casos abiertos a tamaño completo: `bls-G480600`, `bls-G480500`, `bls-G484100`, `bls-G485100`, `bls-G486100`, `bls-G488802`, `bls-G490200`, `bls-G490500`, `bls-G491702`, `bls-G490400`, `bls-G492100`, `bls-G510702`, `bls-G520600`, `bls-G520802`, `bls-G530100`, `bls-G543702`, `bls-G550702`, `bls-G554100`.

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-G480282](0016/bls-G480282.webp) | Speisezwiebel tiefgefroren, gebraten ohne Fett (Pfanne) | Onion deep-frozen, fried without fat (pan) |
| [bls-G480400](0016/bls-G480400.webp) | Speisezwiebel getrocknet | Onion dried |
| [bls-G480500](0016/bls-G480500.webp) | Speisezwiebel Pulver | Onion powder |
| [bls-G480600](0016/bls-G480600.webp) | Gemüsesaft aus Speisezwiebel | Onion juice |
| [bls-G482100](0016/bls-G482100.webp) | Frühlingszwiebel/Lauchzwiebel, roh | Spring onion raw |
| [bls-G482132](0016/bls-G482132.webp) | Frühlingszwiebel/Lauchzwiebel, gekocht | Spring onion boiled |
| [bls-G482142](0016/bls-G482142.webp) | Frühlingszwiebel/Lauchzwiebel, geschmort ohne Fett | Spring onion braised without fat |
| [bls-G482152](0016/bls-G482152.webp) | Frühlingszwiebel/Lauchzwiebel, gedünstet | Spring onion stewed |
| [bls-G482162](0016/bls-G482162.webp) | Frühlingszwiebel/Lauchzwiebel, gebacken | Spring onion baked |
| [bls-G482182](0016/bls-G482182.webp) | Frühlingszwiebel/Lauchzwiebel, gebraten ohne Fett (Pfanne) | Spring onion fried without fat (pan) |
| [bls-G484100](0016/bls-G484100.webp) | Perlzwiebel roh | Pearl onion raw |
| [bls-G484132](0016/bls-G484132.webp) | Perlzwiebel gekocht | Pearl onion boiled |
| [bls-G484152](0016/bls-G484152.webp) | Perlzwiebel gedünstet | Pearl onion stewed |
| [bls-G484162](0016/bls-G484162.webp) | Perlzwiebel gebacken | Pearl onion baked |
| [bls-G484182](0016/bls-G484182.webp) | Perlzwiebel gebraten ohne Fett (Pfanne) | Pearl onion fried without fat (pan) |
| [bls-G485082](0016/bls-G485082.webp) | Schalotte gebraten ohne Fett (Pfanne) | Shallot fried without fat (pan) |
| [bls-G485100](0016/bls-G485100.webp) | Schalotte roh | Shallot raw |
| [bls-G485132](0016/bls-G485132.webp) | Schalotte gekocht | Shalot boiled |
| [bls-G485142](0016/bls-G485142.webp) | Schalotte geschmort ohne Fett | Shallot braised without fat |
| [bls-G485152](0016/bls-G485152.webp) | Schalotte gedünstet | Shalot stewed |
| [bls-G486100](0016/bls-G486100.webp) | Frühlingszwiebel/Lauchzwiebel (ohne Laub) roh | Spring onion, bulb only, raw |
| [bls-G486132](0016/bls-G486132.webp) | Frühlingszwiebel/Lauchzwiebel (ohne Laub) gekocht | Spring onion, bulb only, boiled |
| [bls-G486142](0016/bls-G486142.webp) | Frühlingszwiebel/Lauchzwiebel (ohne Laub) geschmort ohne Fett | Spring onion, bulb only, braised without fat |
| [bls-G486152](0016/bls-G486152.webp) | Frühlingszwiebel/Lauchzwiebel (ohne Laub) gedünstet | Spring onion, bulb only, stewed |
| [bls-G486162](0016/bls-G486162.webp) | Frühlingszwiebel/Lauchzwiebel (ohne Laub) gebacken | Spring onion, bulb only, baked |
| [bls-G486182](0016/bls-G486182.webp) | Frühlingszwiebel/Lauchzwiebel (ohne Laub) gebraten ohne Fett (Pfanne) | Spring onion, bulb only, fried without fat (pan) |
| [bls-G488100](0016/bls-G488100.webp) | Silberzwiebel roh | Silverskin onion raw |
| [bls-G488802](0016/bls-G488802.webp) | Silberzwiebel gesäuert, abgetropft | Silverskin onion pickled, drained |
| [bls-G490042](0016/bls-G490042.webp) | Knoblauch geschmort ohne Fett | Garlic braised without fat |
| [bls-G490100](0016/bls-G490100.webp) | Knoblauch roh | Garlic raw |
| [bls-G490132](0016/bls-G490132.webp) | Knoblauch gekocht | Garlic boiled |
| [bls-G490152](0016/bls-G490152.webp) | Knoblauch gedünstet | Garlic stewed |
| [bls-G490162](0016/bls-G490162.webp) | Knoblauch gebacken | Garlic baked |
| [bls-G490182](0016/bls-G490182.webp) | Knoblauch gebraten ohne Fett (Pfanne) | Garlic fried without fat (pan) |
| [bls-G490200](0016/bls-G490200.webp) | Knoblauch tiefgefroren | Garlic deep-frozen |
| [bls-G490232](0016/bls-G490232.webp) | Knoblauch tiefgefroren, gekocht | Garlic deep-frozen, boiled |
| [bls-G490242](0016/bls-G490242.webp) | Knoblauch tiefgefroren, geschmort ohne Fett | Garlic deep-frozen, braised without fat |
| [bls-G490252](0016/bls-G490252.webp) | Knoblauch tiefgefroren, gedünstet | Garlic deep-frozen, stewed |
| [bls-G490262](0016/bls-G490262.webp) | Knoblauch tiefgefroren, gebacken | Garlic deep-frozen, baked |
| [bls-G490282](0016/bls-G490282.webp) | Knoblauch tiefgefroren, gebraten ohne Fett (Pfanne) | Garlic deep-frozen, fried without fat (pan) |
| [bls-G490400](0016/bls-G490400.webp) | Knoblauch getrocknet | Garlic dried |
| [bls-G490500](0016/bls-G490500.webp) | Knoblauch Pulver | Garlic powder |
| [bls-G491702](0016/bls-G491702.webp) | Knoblauch in Öl, Konserve, abgetropft | Garlic in oil, canned, drained |
| [bls-G491802](0016/bls-G491802.webp) | Knoblauch gesäuert, abgetropft | Garlic pickled, drained |
| [bls-G492100](0016/bls-G492100.webp) | Bärlauch roh | Wild garlic raw |
| [bls-G510100](0016/bls-G510100.webp) | Aubergine roh | Aubergine raw |
| [bls-G510132](0016/bls-G510132.webp) | Aubergine gekocht | Aubergine boiled |
| [bls-G510142](0016/bls-G510142.webp) | Aubergine geschmort ohne Fett | Aubergine braised without fat |
| [bls-G510152](0016/bls-G510152.webp) | Aubergine gedünstet | Aubergine stewed |
| [bls-G510162](0016/bls-G510162.webp) | Aubergine gebacken | Aubergine baked |
| [bls-G510172](0016/bls-G510172.webp) | Aubergine gegrillt | Aubergine grilled |
| [bls-G510182](0016/bls-G510182.webp) | Aubergine gebraten ohne Fett (Pfanne) | Aubergine fried without fat (pan) |
| [bls-G510702](0016/bls-G510702.webp) | Aubergine gegrillt, in Öl, Konserve, abgetropft | Aubergine grilled, in oil, canned, drained |
| [bls-G520042](0016/bls-G520042.webp) | Gurke geschmort ohne Fett | Cucumber braised without fat |
| [bls-G520062](0016/bls-G520062.webp) | Gurke gebacken | Cucumber baked |
| [bls-G520100](0016/bls-G520100.webp) | Gurke roh | Cucumber raw |
| [bls-G520132](0016/bls-G520132.webp) | Gurke gekocht | Cucumber boiled |
| [bls-G520152](0016/bls-G520152.webp) | Gurke gedünstet | Cucumber stewed |
| [bls-G520182](0016/bls-G520182.webp) | Gurke gebraten ohne Fett (Pfanne) | Cucumber fried without fat (pan) |
| [bls-G520600](0016/bls-G520600.webp) | Gemüsesaft aus Gurke | Cucumber juice |
| [bls-G520802](0016/bls-G520802.webp) | Gurke gesäuert (Gewürzgurke) abgetropft | Cucumber/gherkin pickled, drained |
| [bls-G530100](0016/bls-G530100.webp) | Okra roh | Okra raw |
| [bls-G530132](0016/bls-G530132.webp) | Okra gekocht | Okra boiled |
| [bls-G530142](0016/bls-G530142.webp) | Okra geschmort ohne Fett | Okra braised without fat |
| [bls-G530152](0016/bls-G530152.webp) | Okra gedünstet | Okra stewed |
| [bls-G530902](0016/bls-G530902.webp) | Okra Konserve, abgetropft | Okra canned, drained |
| [bls-G541032](0016/bls-G541032.webp) | Gemüsepaprika grün, gekocht | Sweet pepper green, boiled |
| [bls-G541042](0016/bls-G541042.webp) | Gemüsepaprika grün, geschmort ohne Fett | Sweet pepper green, braised without fat |
| [bls-G541072](0016/bls-G541072.webp) | Gemüsepaprika grün, gegrillt | Sweet pepper green, grilled |
| [bls-G541082](0016/bls-G541082.webp) | Gemüsepaprika grün, gebraten ohne Fett (Pfanne) | Sweet pepper green, fried without fat (pan) |
| [bls-G541100](0016/bls-G541100.webp) | Gemüsepaprika grün, roh | Sweet pepper green, raw |
| [bls-G541152](0016/bls-G541152.webp) | Gemüsepaprika grün, gedünstet | Sweet pepper green, stewed |
| [bls-G541162](0016/bls-G541162.webp) | Gemüsepaprika grün, gebacken | Sweet pepper green, baked |
| [bls-G542042](0016/bls-G542042.webp) | Gemüsepaprika gelb, geschmort ohne Fett | Sweet pepper yellow, braised without fat |
| [bls-G542100](0016/bls-G542100.webp) | Gemüsepaprika gelb, roh | Sweet pepper yellow, raw |
| [bls-G542132](0016/bls-G542132.webp) | Gemüsepaprika gelb, gekocht | Sweet pepper yellow, boiled |
| [bls-G542152](0016/bls-G542152.webp) | Gemüsepaprika gelb, gedünstet | Sweet pepper yellow, stewed |
| [bls-G542162](0016/bls-G542162.webp) | Gemüsepaprika gelb, gebacken | Sweet pepper yellow, baked |
| [bls-G542172](0016/bls-G542172.webp) | Gemüsepaprika gelb, gegrillt | Sweet pepper yellow, grilled |
| [bls-G542182](0016/bls-G542182.webp) | Gemüsepaprika gelb, gebraten ohne Fett (Pfanne) | Sweet pepper yellow, fried without fat (pan) |
| [bls-G543032](0016/bls-G543032.webp) | Gemüsepaprika rot, gekocht | Sweet pepper red, boiled |
| [bls-G543042](0016/bls-G543042.webp) | Gemüsepaprika rot, geschmort ohne Fett | Sweet pepper red, braised without fat |
| [bls-G543072](0016/bls-G543072.webp) | Gemüsepaprika rot, gegrillt | Sweet pepper red, grilled |
| [bls-G543082](0016/bls-G543082.webp) | Gemüsepaprika rot, gebraten ohne Fett (Pfanne) | Sweet pepper red, fried without fat (pan) |
| [bls-G543100](0016/bls-G543100.webp) | Gemüsepaprika rot, roh | Sweet pepper red, raw |
| [bls-G543152](0016/bls-G543152.webp) | Gemüsepaprika rot, gedünstet | Sweet pepper red, stewed |
| [bls-G543162](0016/bls-G543162.webp) | Gemüsepaprika rot, gebacken | Sweet pepper red, baked |
| [bls-G543702](0016/bls-G543702.webp) | Gemüsepaprika rot, gegrillt, in Öl, Konserve, abgetropft | Sweet pepper red, grilled, in oil, canned, drained |
| [bls-G543802](0016/bls-G543802.webp) | Gemüsepaprika rot, gesäuert, abgetropft | Sweet pepper red, pickled, drained |
| [bls-G550702](0016/bls-G550702.webp) | Pfefferschote in Öl, Konserve, abgetropft | Chilli pepper in oil, canned, drained |
| [bls-G550802](0016/bls-G550802.webp) | Pfefferschote gesäuert, abgetropft | Chilli pepper pickled, drained |
| [bls-G553100](0016/bls-G553100.webp) | Pfefferschote grün, roh | Chilli pepper green, raw |
| [bls-G553132](0016/bls-G553132.webp) | Pfefferschote grün, gekocht | Chilli pepper green, boiled |
| [bls-G553152](0016/bls-G553152.webp) | Pfefferschote grün, gedünstet | Chilli pepper green, stewed |
| [bls-G553182](0016/bls-G553182.webp) | Pfefferschote grün, gebraten ohne Fett (Pfanne) | Chilli pepper green, fried without fat (pan) |
| [bls-G554100](0016/bls-G554100.webp) | Pfefferschote rot, roh | Chilli pepper red, raw |
| [bls-G554132](0016/bls-G554132.webp) | Pfefferschote rot, gekocht | Chilli pepper red, boiled |
| [bls-G554152](0016/bls-G554152.webp) | Pfefferschote rot, gedünstet | Chilli pepper red, stewed |
| [bls-G554182](0016/bls-G554182.webp) | Pfefferschote rot, gebraten ohne Fett (Pfanne) | Chilli pepper red, fried without fat (pan) |
| [bls-G560142](0016/bls-G560142.webp) | Tomate geschmort ohne Fett | Tomato braised without fat |


## Tanda 0017: tomates, maíz, calabazas y hortalizas de raíz

100 WebP finales opacos de 1024×1024 revisados en nueve hojas de contacto; 23 casos comprobados también a tamaño completo. Una generación independiente por código, mediante el generador integrado de Codex y referencias CIQUAL usadas solo para el estilo. BLS permanece fuera de la app.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0017-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0017-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0017-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0017-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0017-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0017-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0017-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0017-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0017-09.jpg)

El tomate seco mantiene piezas arrugadas y coriáceas, diferenciadas del polvo fino. Los tomates secos conservados en aceite o marinados conservan esa textura tras el escurrido; el tomate en conserva sin indicación de escurrido mantiene parte de su propio jugo, y la ficha de tomate pelado se representa sin piel. Los nombres oficiales se mantienen literales, incluido `Tomate dried, marinated, drained`. La sal del zumo de tomate y la miel del zumo de zanahoria están disueltas, sin cristales, tarros ni aderezos visibles. El maíz dulce crudo se ilustra en mazorca y sus preparaciones como granos tiernos; no son palomitas ni maíz seco.

Hokkaido se ilustra con calabaza naranja rojiza de tipo kuri y corteza conservada en los trozos; [BZfE](https://www.bzfe.de/kueche-und-alltag/kochen/how-to-obst-und-gemuese/how-to-kuerbis) describe que su corteza se ablanda al cocinar. La calabaza `C. pepo` usa una variedad redonda naranja ilustrativa y trozos pelados; la conserva genérica de calabaza no certifica especie o variedad. El calabacín tiene pulpa marfil firme y semillas finas. El chayote se ilustra verde pálido, en forma de pera con pliegues y una semilla plana, conforme a [UF/IFAS](https://gardeningsolutions.ifas.ufl.edu/plants/edibles/vegetables/chayote/).

El colinabo de raíz o rutabaga (`Steckrübe`, `Swede`) muestra pulpa amarilla y hombros morados; se diferencia del nabo de pulpa blanca. [RHS](https://www.rhs.org.uk/vegetables/swede/grow-your-own) describe los rasgos del swede. La remolacha conserva su rojo granate y la zanahoria se ilustra naranja. El rábano picante tiene raíz cilíndrica irregular; la chirivía tiene hombros anchos y se estrecha en punta. El salsifí negro crudo conserva corteza oscura y pulpa blanca, y los trozos preparados se muestran pelados, sin puntas de espárrago: [BZfE](https://www.bzfe.de/presse/pressemeldungen-archiv/comeback-der-schwarzwurzeln) documenta esa corteza oscura corchosa y el interior claro. El apionabo muestra una raíz redondeada nudosa, no tallos de apio; sus preparaciones usan pulpa crema. Véase [BZfE: Sellerie](https://www.bzfe.de/kueche-und-alltag/kochen/how-to-obst-und-gemuese/how-to-sellerie).

Hervidos, braseados y guisados muestran ablandamiento sin costra; horno, parrilla y sartén llevan solo el dorado correspondiente. Los congelados sin cocinar tienen escarcha discreta y los cocinados desde congelado no. Las conservas marcadas como escurridas no tienen líquido acumulado. Los zumos son líquidos turbios en un vaso sencillo, sin hielo, guarnición ni sólidos añadidos. No hay envases, utensilios, hierbas ni ingredientes ajenos a las fichas.

Estas decisiones visuales no certifican especie, variedad, receta, grasa, alérgenos ni porción de 100 g. Las fichas, nutrientes y fuentes oficiales no cambian. Correcciones visuales registradas: 0.  Casos abiertos a tamaño completo: `bls-G560600`, `bls-G560900`, `bls-G561500`, `bls-G568900`, `bls-G570200`, `bls-G581000`, `bls-G581032`, `bls-G581100`, `bls-G582100`, `bls-G583100`, `bls-G611100`, `bls-G613100`, `bls-G613600`, `bls-G614100`, `bls-G620200`, `bls-G620600`, `bls-G622600`, `bls-G630100`, `bls-G640100`, `bls-G650100`, `bls-G650200`, `bls-G660100`, `bls-G660600`.

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-G560400](0017/bls-G560400.webp) | Tomate getrocknet | Tomato dried |
| [bls-G560600](0017/bls-G560600.webp) | Gemüsesaft aus Tomate, mit Salz | Tomato juice with salt |
| [bls-G560900](0017/bls-G560900.webp) | Tomate Konserve | Tomato canned |
| [bls-G561072](0017/bls-G561072.webp) | Tomate gegrillt | Tomato grilled |
| [bls-G561082](0017/bls-G561082.webp) | Tomate gebraten ohne Fett (Pfanne) | Tomato fried without fat (pan) |
| [bls-G561100](0017/bls-G561100.webp) | Tomate roh | Tomato raw |
| [bls-G561132](0017/bls-G561132.webp) | Tomate gekocht | Tomato boiled |
| [bls-G561152](0017/bls-G561152.webp) | Tomate gedünstet | Tomato stewed |
| [bls-G561162](0017/bls-G561162.webp) | Tomate gebacken | Tomato baked |
| [bls-G561500](0017/bls-G561500.webp) | Tomate Pulver | Tomato powder |
| [bls-G561802](0017/bls-G561802.webp) | Tomate gesäuert, abgetropft | Tomato pickled, drained |
| [bls-G567702](0017/bls-G567702.webp) | Tomate getrocknet, in Öl, Konserve, abgetropft | Tomato dried, in oil, canned, drained |
| [bls-G568900](0017/bls-G568900.webp) | Tomate geschält, Konserve | Tomato peeled, canned |
| [bls-G569902](0017/bls-G569902.webp) | Tomate getrocknet, mariniert, abgetropft | Tomate dried, marinated, drained |
| [bls-G570100](0017/bls-G570100.webp) | Zuckermais roh | Sweetcorn raw |
| [bls-G570132](0017/bls-G570132.webp) | Zuckermais gekocht | Sweetcorn boiled |
| [bls-G570162](0017/bls-G570162.webp) | Zuckermais gebacken | Sweetcorn baked |
| [bls-G570172](0017/bls-G570172.webp) | Zuckermais gegrillt | Sweetcorn grilled |
| [bls-G570182](0017/bls-G570182.webp) | Zuckermais gebraten ohne Fett (Pfanne) | Sweetcorn fried without fat (pan) |
| [bls-G570200](0017/bls-G570200.webp) | Zuckermais tiefgefroren | Sweetcorn deep-frozen |
| [bls-G570232](0017/bls-G570232.webp) | Zuckermais tiefgefroren, gekocht | Sweetcorn deep-frozen, boiled |
| [bls-G570262](0017/bls-G570262.webp) | Zuckermais tiefgefroren, gebacken | Sweetcorn deep-frozen, baked |
| [bls-G570272](0017/bls-G570272.webp) | Zuckermais tiefgefroren, gegrillt | Sweetcorn deep-frozen, grilled |
| [bls-G570282](0017/bls-G570282.webp) | Zuckermais tiefgefroren, gebraten ohne Fett (Pfanne) | Sweetcorn deep-frozen, fried without fat (pan) |
| [bls-G570802](0017/bls-G570802.webp) | Zuckermais gesäuert, abgetropft | Sweetcorn pickled, drained |
| [bls-G570902](0017/bls-G570902.webp) | Zuckermais Konserve, abgetropft | Sweetcorn canned, drained |
| [bls-G581000](0017/bls-G581000.webp) | Kürbis Hokkaido (C. maxima) roh | Hokkaido pumpkin raw |
| [bls-G581032](0017/bls-G581032.webp) | Kürbis Hokkaido (C. maxima) gekocht | Hokkaido pumpkin boiled |
| [bls-G581042](0017/bls-G581042.webp) | Kürbis Hokkaido (C. maxima) geschmort ohne Fett | Hokkaido pumpkin braised without fat |
| [bls-G581052](0017/bls-G581052.webp) | Kürbis Hokkaido (C. maxima) gedünstet | Hokkaido pumpkin stewed |
| [bls-G581062](0017/bls-G581062.webp) | Kürbis Hokkaido (C. maxima) gebacken | Hokkaido pumpkin baked |
| [bls-G581082](0017/bls-G581082.webp) | Kürbis Hokkaido (C. maxima) gebraten ohne Fett (Pfanne) | Hokkaido pumpkin fried without fat (pan) |
| [bls-G581100](0017/bls-G581100.webp) | Kürbis Pumpkin (C. pepo) roh | Pumpkin (C. pepo) raw |
| [bls-G581132](0017/bls-G581132.webp) | Kürbis Pumpkin (C. pepo) gekocht | Pumpkin (C. pepo) boiled |
| [bls-G581142](0017/bls-G581142.webp) | Kürbis Pumpkin (C. pepo) geschmort ohne Fett | Pumpkin (C. pepo) braised without fat |
| [bls-G581152](0017/bls-G581152.webp) | Kürbis Pumpkin (C. pepo) gedünstet | Pumpkin (C. pepo) stewed |
| [bls-G581162](0017/bls-G581162.webp) | Kürbis Pumpkin (C. pepo) gebacken | Pumpkin (C. pepo) baked |
| [bls-G581182](0017/bls-G581182.webp) | Kürbis Pumpkin (C. pepo) gebraten ohne Fett (Pfanne) | Pumpkin (C. pepo) fried without fat (pan) |
| [bls-G581802](0017/bls-G581802.webp) | Kürbis gesäuert, abgetropft | Pumpkin pickled, drained |
| [bls-G582100](0017/bls-G582100.webp) | Zucchini roh | Courgette raw |
| [bls-G582132](0017/bls-G582132.webp) | Zucchini gekocht | Courgette boiled |
| [bls-G582142](0017/bls-G582142.webp) | Zucchini geschmort ohne Fett | Courgette braised without fat |
| [bls-G582152](0017/bls-G582152.webp) | Zucchini gedünstet | Courgette stewed |
| [bls-G582162](0017/bls-G582162.webp) | Zucchini gebacken | Courgette baked |
| [bls-G582172](0017/bls-G582172.webp) | Zucchini gegrillt | Courgette grilled |
| [bls-G582182](0017/bls-G582182.webp) | Zucchini gebraten ohne Fett (Pfanne) | Courgette fried without fat (pan) |
| [bls-G582802](0017/bls-G582802.webp) | Zucchini gesäuert, abgetropft | Courgette pickled, drained |
| [bls-G583100](0017/bls-G583100.webp) | Chayote roh | Chayote raw |
| [bls-G583132](0017/bls-G583132.webp) | Chayote gekocht | Chayote boiled |
| [bls-G583182](0017/bls-G583182.webp) | Chayote gebraten ohne Fett (Pfanne) | Chayote fried without fat (pan) |
| [bls-G611100](0017/bls-G611100.webp) | Kohlrübe/Steckrübe, roh | Swede raw |
| [bls-G611132](0017/bls-G611132.webp) | Kohlrübe/Steckrübe, gekocht | Swede boiled |
| [bls-G611152](0017/bls-G611152.webp) | Kohlrübe/Steckrübe, gedünstet | Swede stewed |
| [bls-G613100](0017/bls-G613100.webp) | Rote Rübe/Rote Bete, roh | Beetroot raw |
| [bls-G613132](0017/bls-G613132.webp) | Rote Rübe/Rote Bete, gekocht | Beetroot boiled |
| [bls-G613152](0017/bls-G613152.webp) | Rote Rübe/Rote Bete, gedünstet | Beetroot stewed |
| [bls-G613600](0017/bls-G613600.webp) | Gemüsesaft aus Rote Rübe/Rote Bete | Beetroot juice |
| [bls-G613802](0017/bls-G613802.webp) | Rote Rübe/Rote Bete, gesäuert, abgetropft | Beetroot pickled, drained |
| [bls-G614100](0017/bls-G614100.webp) | Weiße Rübe/Wasserrübe/Herbstrübe, roh | Turnip raw |
| [bls-G614132](0017/bls-G614132.webp) | Weiße Rübe/Wasserrübe/Herbstrübe, gekocht | Turnip boiled |
| [bls-G614152](0017/bls-G614152.webp) | Weiße Rübe/Wasserrübe/Herbstrübe, gedünstet | Turnip stewed |
| [bls-G620100](0017/bls-G620100.webp) | Karotte/Möhre, roh | Carrot raw |
| [bls-G620132](0017/bls-G620132.webp) | Karotte/Möhre, gekocht | Carrot boiled |
| [bls-G620142](0017/bls-G620142.webp) | Karotte/Möhre, geschmort ohne Fett | Carrot braised without fat |
| [bls-G620152](0017/bls-G620152.webp) | Karotte/Möhre, gedünstet | Carrot stewed |
| [bls-G620162](0017/bls-G620162.webp) | Karotte/Möhre, gebacken | Carrot baked |
| [bls-G620182](0017/bls-G620182.webp) | Karotte/Möhre, gebraten ohne Fett (Pfanne) | Carrot fried without fat (pan) |
| [bls-G620200](0017/bls-G620200.webp) | Karotte/Möhre, tiefgefroren | Carrot deep-frozen |
| [bls-G620232](0017/bls-G620232.webp) | Karotte/Möhre, tiefgefroren, gekocht | Carrot deep-frozen, boiled |
| [bls-G620242](0017/bls-G620242.webp) | Karotte/Möhre, tiefgefroren, geschmort ohne Fett | Carrot deep-frozen, braised without fat |
| [bls-G620252](0017/bls-G620252.webp) | Karotte/Möhre, tiefgefroren, gedünstet | Carrot deep-frozen, stewed |
| [bls-G620262](0017/bls-G620262.webp) | Karotte/Möhre, tiefgefroren, gebacken | Carrot deep-frozen, baked |
| [bls-G620282](0017/bls-G620282.webp) | Karotte/Möhre, tiefgefroren, gebraten ohne Fett (Pfanne) | Carrot deep-frozen, fried without fat (pan) |
| [bls-G620600](0017/bls-G620600.webp) | Gemüsesaft aus Karotte/Möhre | Carrot juice |
| [bls-G620802](0017/bls-G620802.webp) | Karotte/Möhre, gesäuert, abgetropft | Carrot pickled, drained |
| [bls-G620902](0017/bls-G620902.webp) | Karotte/Möhre, Konserve, abgetropft | Carrot canned, drained |
| [bls-G622600](0017/bls-G622600.webp) | Gemüsesaft aus Karotte/Möhre, mit Honig | Carrot juice, sweetened with honey |
| [bls-G630100](0017/bls-G630100.webp) | Meerrettich roh | Horseradish raw |
| [bls-G630132](0017/bls-G630132.webp) | Meerrettich gekocht | Horseradish boiled |
| [bls-G640100](0017/bls-G640100.webp) | Pastinake roh | Parsnip raw |
| [bls-G640132](0017/bls-G640132.webp) | Pastinake gekocht | Parsnip boiled |
| [bls-G640142](0017/bls-G640142.webp) | Pastinake geschmort ohne Fett | Parsnip braised without fat |
| [bls-G640152](0017/bls-G640152.webp) | Pastinake gedünstet | Parsnip stewed |
| [bls-G640162](0017/bls-G640162.webp) | Pastinake gebacken | Parsnip baked |
| [bls-G640182](0017/bls-G640182.webp) | Pastinake gebraten ohne Fett (Pfanne) | Parsnip fried without fat (pan) |
| [bls-G650100](0017/bls-G650100.webp) | Schwarzwurzel roh | Black salsify raw |
| [bls-G650132](0017/bls-G650132.webp) | Schwarzwurzel gekocht | Black salsify boiled |
| [bls-G650142](0017/bls-G650142.webp) | Schwarzwurzel geschmort ohne Fett | Black salsify braised without fat |
| [bls-G650152](0017/bls-G650152.webp) | Schwarzwurzel gedünstet | Black salsify stewed |
| [bls-G650200](0017/bls-G650200.webp) | Schwarzwurzel tiefgefroren | Black salsify deep-frozen |
| [bls-G650232](0017/bls-G650232.webp) | Schwarzwurzel tiefgefroren, gekocht | Black salsify deep-frozen, boiled |
| [bls-G650242](0017/bls-G650242.webp) | Schwarzwurzel tiefgefroren, geschmort ohne Fett | Black salsify deep-frozen, braised without fat |
| [bls-G650252](0017/bls-G650252.webp) | Schwarzwurzel tiefgefroren, gedünstet | Black salsify deep-frozen, stewed |
| [bls-G650902](0017/bls-G650902.webp) | Schwarzwurzel Konserve, abgetropft | Black salsify canned, drained |
| [bls-G660100](0017/bls-G660100.webp) | Knollensellerie roh | Celeriac raw |
| [bls-G660132](0017/bls-G660132.webp) | Knollensellerie gekocht | Celeriac boiled |
| [bls-G660152](0017/bls-G660152.webp) | Knollensellerie gedünstet | Celeriac stewed |
| [bls-G660162](0017/bls-G660162.webp) | Knollensellerie gebacken | Celeriac baked |
| [bls-G660182](0017/bls-G660182.webp) | Knollensellerie gebraten ohne Fett (Pfanne) | Celeriac fried without fat (pan) |
| [bls-G660600](0017/bls-G660600.webp) | Gemüsesaft aus Knollensellerie | Celeriac juice |


## Tanda 0018: raíces, legumbres, encurtidos y mezclas de verduras

100 WebP finales opacos de 1024×1024 revisados en nueve hojas de contacto; 32 casos comprobados también a tamaño completo. Una generación independiente por código, mediante el generador integrado de Codex y referencias CIQUAL usadas solo para el estilo. BLS permanece fuera de la app.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0018-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0018-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0018-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0018-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0018-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0018-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0018-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0018-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0018-09.jpg)

La raíz de perejil se ilustra más esbelta y blanca que la chirivía, con la corona ligeramente elevada; [BZfE](https://www.bzfe.de/presse/pressemeldungen-archiv/kochen-mit-wurzelpetersilie) describe esos rasgos. Su versión seca contiene chips arrugados, no hojas de perejil. El rábano genérico usa un tipo blanco alargado ilustrativo; el rabanito pequeño conserva piel roja y pulpa blanca. El wasabi crudo se representa como rizoma nudoso verde pálido, no como pasta ni rábano picante europeo: [The Wasabi Company](https://www.thewasabicompany.co.uk/pages/grow-your-own) documenta la cosecha del rizoma.

Judías verdes y judías de cera conservan las vainas verdes o amarillas. Habas tiernas, edamame y guisantes se representan desgranados. Las legumbres maduras sin cocinar son semillas secas, mates y sin hidratar; las hervidas están hinchadas y húmedas. Los tirabeques conservan vainas planas comestibles con semillas pequeñas, conforme a [BZfE](https://www.bzfe.de/presse/pressemeldungen-archiv/die-vielseitige-erbse). El maíz dulce, el guisante y el pimiento rojo de la mezcla mexicana son una elección visual ilustrativa; [EDEKA Foodservice](https://edeka-foodservice.de/eigenmarken/produkte/5487228004/bonduelle-goldmais-mexiko-mix-300g) muestra una preparación comercial con esas hortalizas, sin que ello pruebe la receta BLS. En la ficha cruda se exige textura cruda y en la hervida ablandamiento.

La sopa instantánea seca es polvo fino crema con motas integradas; la preparada con agua es líquida y homogénea, sin vaso de leche ni espiral de nata. Las cebollas fritas de producto preparado son tiras y fragmentos finos crujientes de color ámbar, no aros gruesos rebozados ni cebolla caramelizada blanda. Las mezclas, el gulasch vegetariano, el ajvar y el untable vegetal usan recetas ilustrativas: no se certifican ingredientes, proporciones, alérgenos ni una formulación comercial. Las conservas de rábano picante son rallados o pastas blancas; la variante con nata la incorpora, sin cobertura separada. Se preserva el nombre inglés oficial `Horsereadish canned`.

Los encurtidos y fermentados escurridos mantienen humedad superficial sin charcos de salmuera; la fermentación no se inventa mediante burbujas. Honiggurken y Senfgurken se representan en trozos de pepino maduro pelado y sin cavidad de semillas; la miel queda incorporada sin adorno y la variante de mostaza conserva unas pocas semillas adheridas. Leipziger Allerlei combina guisantes, pequeñas zanahorias enteras y espárrago blanco, sin carne, cangrejos ni salsa. Estas decisiones se apoyan en los [Leitsätze für Gemüseerzeugnisse](https://www.deutsche-lebensmittelbuch-kommission.de/fileadmin/Dokumente/leitsaetzegemueseerzeugnisse.pdf), sin atribuir una composición exacta a BLS.

Hervidos, braseados y guisados muestran ablandamiento sin costra; horno y sartén llevan solo el dorado correspondiente. Los congelados sin cocinar tienen escarcha discreta y los cocinados desde congelado no. La sopa y el gulasch conservan su líquido propio. Sin envases, utensilios ni decoración. Estas imágenes no certifican variedad, receta, grasa, alérgenos ni porción de 100 g; las fichas nutricionales y las fuentes oficiales no cambian.

Correcciones visuales registradas: 0.  Casos abiertos a tamaño completo: `bls-G670100`, `bls-G670400`, `bls-G680100`, `bls-G691100`, `bls-G693100`, `bls-G710100`, `bls-G710200`, `bls-G720100`, `bls-G730100`, `bls-G750100`, `bls-G750400`, `bls-G750432`, `bls-G760400`, `bls-G760432`, `bls-G761100`, `bls-G770400`, `bls-G770432`, `bls-G780400`, `bls-G780432`, `bls-G850100`, `bls-G850132`, `bls-G860192`, `bls-G891102`, `bls-G891202`, `bls-G898200`, `bls-G898400`, `bls-G920200`, `bls-G940100`, `bls-G950900`, `bls-G991902`, `bls-G993100`, `bls-G993132`.

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-G660802](0018/bls-G660802.webp) | Knollensellerie gesäuert, abgetropft | Celeriac pickled, drained |
| [bls-G670100](0018/bls-G670100.webp) | Wurzelpetersilie roh | Parsley root raw |
| [bls-G670132](0018/bls-G670132.webp) | Wurzelpetersilie gekocht | Parsley root boiled |
| [bls-G670142](0018/bls-G670142.webp) | Wurzelpetersilie geschmort ohne Fett | Parsley root braised without fat |
| [bls-G670152](0018/bls-G670152.webp) | Wurzelpetersilie gedünstet | Parsley root stewed |
| [bls-G670162](0018/bls-G670162.webp) | Wurzelpetersilie gebacken | Parsley root baked |
| [bls-G670182](0018/bls-G670182.webp) | Wurzelpetersilie gebraten ohne Fett (Pfanne) | Parsley root fried without fat (pan) |
| [bls-G670400](0018/bls-G670400.webp) | Wurzelpetersilie getrocknet | Parsley root dried |
| [bls-G680100](0018/bls-G680100.webp) | Rettich roh | Radish raw |
| [bls-G680152](0018/bls-G680152.webp) | Rettich gedünstet | Radish stewed |
| [bls-G691100](0018/bls-G691100.webp) | Radieschen roh | Small red radish raw |
| [bls-G691152](0018/bls-G691152.webp) | Radieschen gedünstet | Small red radish stewed |
| [bls-G693100](0018/bls-G693100.webp) | Wasabi roh | Japanese horseradish/wasabi root, raw |
| [bls-G710042](0018/bls-G710042.webp) | Bohne grün, tiefgefroren, geschmort ohne Fett | Bean green, deep-frozen, braised without fat |
| [bls-G710100](0018/bls-G710100.webp) | Bohne grün, roh | Bean green, raw |
| [bls-G710132](0018/bls-G710132.webp) | Bohne grün, gekocht | Bean green, boiled |
| [bls-G710142](0018/bls-G710142.webp) | Bohne grün, geschmort ohne Fett | Bean green, braised without fat |
| [bls-G710152](0018/bls-G710152.webp) | Bohne grün, gedünstet | Bean green, stewed |
| [bls-G710162](0018/bls-G710162.webp) | Bohne grün, gebacken | Bean green, baked |
| [bls-G710182](0018/bls-G710182.webp) | Bohne grün, gebraten ohne Fett (Pfanne) | Bean green, fried without fat (pan) |
| [bls-G710200](0018/bls-G710200.webp) | Bohne grün, tiefgefroren | Bean green, deep-frozen |
| [bls-G710232](0018/bls-G710232.webp) | Bohne grün, tiefgefroren, gekocht | Bean green, deep-frozen, boiled |
| [bls-G710252](0018/bls-G710252.webp) | Bohne grün, tiefgefroren, gedünstet | Bean green, deep-frozen, stewed |
| [bls-G710262](0018/bls-G710262.webp) | Bohne grün, tiefgefroren, gebacken | Bean green, deep-frozen, baked |
| [bls-G710282](0018/bls-G710282.webp) | Bohne grün, tiefgefroren, gebraten ohne Fett (Pfanne) | Bean green, deep-frozen, fried without fat (pan) |
| [bls-G710802](0018/bls-G710802.webp) | Bohne grün, gesäuert, abgetropft | Bean green, pickled, drained |
| [bls-G710902](0018/bls-G710902.webp) | Bohne grün, Konserve, abgetropft | Bean green, canned, drained |
| [bls-G720100](0018/bls-G720100.webp) | Wachsbohne roh | Wax bean raw |
| [bls-G720132](0018/bls-G720132.webp) | Wachsbohne gekocht | Wax bean boiled |
| [bls-G720152](0018/bls-G720152.webp) | Wachsbohne gedünstet | Wax bean stewed |
| [bls-G720200](0018/bls-G720200.webp) | Wachsbohne tiefgefroren | Wax bean deep-frozen |
| [bls-G720232](0018/bls-G720232.webp) | Wachsbohne tiefgefroren, gekocht | Wax bean deep-frozen, boiled |
| [bls-G720252](0018/bls-G720252.webp) | Wachsbohne tiefgefroren, gedünstet | Wax bean deep-frozen, stewed |
| [bls-G720802](0018/bls-G720802.webp) | Wachsbohne gesäuert, abgetropft | Wax bean pickled, drained |
| [bls-G720902](0018/bls-G720902.webp) | Wachsbohne Konserve, abgetropft | Wax bean canned, drained |
| [bls-G730100](0018/bls-G730100.webp) | Dicke Bohne unreif, roh | Broad bean immature, raw |
| [bls-G730132](0018/bls-G730132.webp) | Dicke Bohne unreif, gekocht | Broad bean immature, boiled |
| [bls-G730200](0018/bls-G730200.webp) | Dicke Bohne unreif, tiefgefroren | Broad bean immature, deep-frozen |
| [bls-G730232](0018/bls-G730232.webp) | Dicke Bohne unreif, tiefgefroren, gekocht | Broad bean immature, deep-frozen, boiled |
| [bls-G730902](0018/bls-G730902.webp) | Dicke Bohne unreif, Konserve, abgetropft | Broad bean immature, canned, drained |
| [bls-G750100](0018/bls-G750100.webp) | Sojabohne unreif (Edamame) roh | Soya bean immature (edamame) raw |
| [bls-G750400](0018/bls-G750400.webp) | Sojabohne reif | Soya bean mature |
| [bls-G750432](0018/bls-G750432.webp) | Sojabohne reif, gekocht | Soya bean mature, boiled |
| [bls-G750902](0018/bls-G750902.webp) | Sojabohne unreif (Edamame) Konserve, abgetropft | Soya bean immature (edamame) canned, drained |
| [bls-G760100](0018/bls-G760100.webp) | Erbse grün, roh | Pea green, raw |
| [bls-G760132](0018/bls-G760132.webp) | Erbse grün, gekocht | Pea green, boiled |
| [bls-G760152](0018/bls-G760152.webp) | Erbse grün, gedünstet | Pea green, stewed |
| [bls-G760162](0018/bls-G760162.webp) | Erbse grün, gebacken | Pea green, baked |
| [bls-G760182](0018/bls-G760182.webp) | Erbse grün, gebraten ohne Fett (Pfanne) | Pea green, fried without fat (pan) |
| [bls-G760200](0018/bls-G760200.webp) | Erbse grün, tiefgefroren | Pea green, deep-frozen |
| [bls-G760232](0018/bls-G760232.webp) | Erbse grün, tiefgefroren, gekocht | Pea green, deep-frozen, boiled |
| [bls-G760252](0018/bls-G760252.webp) | Erbse grün, tiefgefroren, gedünstet | Pea green, deep-frozen, stewed |
| [bls-G760262](0018/bls-G760262.webp) | Erbse grün, tiefgefroren, gebacken | Pea green, deep-frozen, baked |
| [bls-G760282](0018/bls-G760282.webp) | Erbse grün, tiefgefroren, gebraten ohne Fett (Pfanne) | Pea green, deep-frozen, fried without fat (pan) |
| [bls-G760400](0018/bls-G760400.webp) | Erbse reif | Pea green mature |
| [bls-G760432](0018/bls-G760432.webp) | Erbse reif, gekocht | Pea green mature, boiled |
| [bls-G760902](0018/bls-G760902.webp) | Erbse grün, Konserve, abgetropft | Pea green, canned, drained |
| [bls-G761032](0018/bls-G761032.webp) | Zuckererbse gekocht | Sugar pea boiled |
| [bls-G761100](0018/bls-G761100.webp) | Zuckererbse roh | Sugar pea raw |
| [bls-G761152](0018/bls-G761152.webp) | Zuckererbse gedünstet | Sugar pea stewed |
| [bls-G761200](0018/bls-G761200.webp) | Zuckererbse tiefgefroren | Sugar pea deep-frozen |
| [bls-G761232](0018/bls-G761232.webp) | Zuckererbse tiefgefroren, gekocht | Sugar pea deep-frozen, boiled |
| [bls-G761252](0018/bls-G761252.webp) | Zuckererbse tiefgefroren, gedünstet | Sugar pea deep-frozen, stewed |
| [bls-G770400](0018/bls-G770400.webp) | Kichererbse reif | Chick pea mature |
| [bls-G770432](0018/bls-G770432.webp) | Kichererbse reif, gekocht | Chick pea mature, boiled |
| [bls-G780400](0018/bls-G780400.webp) | Limabohne (Butterbohne Mondbohne) reif | Lima bean/butter bean, mature |
| [bls-G780432](0018/bls-G780432.webp) | Limabohne (Butterbohne, Mondbohne) reif, gekocht | Lima bean/butter bean, mature, boiled |
| [bls-G850100](0018/bls-G850100.webp) | Gemüsecremesuppe Instantpulver | Cream of vegetable soup instant powder |
| [bls-G850132](0018/bls-G850132.webp) | Gemüsecremesuppe aus Instantpulver (mit Wasser zubereitet) | Cream of vegetable soup, made from instant powder and water |
| [bls-G860192](0018/bls-G860192.webp) | Röstzwiebeln (Fertigprodukt) | Fried onions (ready-made product) |
| [bls-G880402](0018/bls-G880402.webp) | Bohne grün, milchsauer fermentiert, abgetropft | Bean green, lactic acid fermented, drained |
| [bls-G880602](0018/bls-G880602.webp) | Mixed Pickles gesäuert, abgetropft | Mixed pickles, drained |
| [bls-G890702](0018/bls-G890702.webp) | Salzgurke/Salzdillgurke, milchsauer fermentiert, abgetropft | Gherkin lactic acid fermented, drained |
| [bls-G890902](0018/bls-G890902.webp) | Cornichons gesäuert, abgetropft | Cornichons pickled, canned, drained |
| [bls-G891102](0018/bls-G891102.webp) | Honiggurke gesäuert, abgetropft | Sweet cucumber pickled, canned, drained |
| [bls-G891202](0018/bls-G891202.webp) | Senfgurke gesäuert, abgetropft | Mustard cucumber pickled, canned, drained |
| [bls-G898100](0018/bls-G898100.webp) | Gemüse-Meerrettich (ohne Salz) Konserve | Horseradish (unsalted) canned |
| [bls-G898200](0018/bls-G898200.webp) | Sahne-Meerrettich Konserve | Creamed horseradish canned |
| [bls-G898300](0018/bls-G898300.webp) | Tafel-Meerrettich Konserve | Horsereadish canned |
| [bls-G898400](0018/bls-G898400.webp) | Ajvar Konserve | Ajvar canned |
| [bls-G920200](0018/bls-G920200.webp) | Gemüsemischung Leipziger Allerlei, tiefgefroren | Mixed vegetables "Leipziger Allerlei", deep-frozen |
| [bls-G920232](0018/bls-G920232.webp) | Gemüsemischung Leipziger Allerlei, tiefgefroren, gekocht | Mixed vegetables "Leipziger Allerlei", deep-frozen, boiled |
| [bls-G920252](0018/bls-G920252.webp) | Gemüsemischung Leipziger Allerlei, tiefgefroren, gedünstet | Mixed vegetables "Leipziger Allerlei", deep-frozen, stewed |
| [bls-G920902](0018/bls-G920902.webp) | Gemüsemischung Leipziger Allerlei, Konserve, abgetropft | Mixed vegetables "Leipziger Allerlei", canned, drained |
| [bls-G940100](0018/bls-G940100.webp) | Gemüseaufstrich, Brotaufstrich pflanzlich | Vegetable spread |
| [bls-G950900](0018/bls-G950900.webp) | Vegetarisches Gulasch, Konserve | Vegetarian goulash, canned |
| [bls-G991902](0018/bls-G991902.webp) | Gemüsemischung asiatische Art, Konserve, abgetropft | Mixed vegetables Asian style, canned, drained |
| [bls-G992100](0018/bls-G992100.webp) | Gemüsemischung Erbsen-Karotten, roh | Mixed vegetables peas and carrots, raw |
| [bls-G992132](0018/bls-G992132.webp) | Gemüsemischung Erbsen-Karotten, gekocht | Mixed vegetables peas and carrots, boiled |
| [bls-G992152](0018/bls-G992152.webp) | Gemüsemischung Erbsen-Karotten, gedünstet | Mixed vegetables peas and carrots, stewed |
| [bls-G992162](0018/bls-G992162.webp) | Gemüsemischung Erbsen-Karotten, gebacken | Mixed vegetables peas and carrots, baked |
| [bls-G992182](0018/bls-G992182.webp) | Gemüsemischung Erbsen-Karotten, gebraten ohne Fett (Pfanne) | Mixed vegetables peas and carrots, fried without fat (pan) |
| [bls-G992200](0018/bls-G992200.webp) | Gemüsemischung Erbsen-Karotten, tiefgefroren | Mixed vegetables peas and carrots, deep-frozen |
| [bls-G992232](0018/bls-G992232.webp) | Gemüsemischung Erbsen-Karotten, tiefgefroren, gekocht | Mixed vegetables peas and carrots, deep-frozen, boiled |
| [bls-G992252](0018/bls-G992252.webp) | Gemüsemischung Erbsen-Karotten, tiefgefroren, gedünstet | Mixed vegetables peas and carrots, deep-frozen, stewed |
| [bls-G992262](0018/bls-G992262.webp) | Gemüsemischung Erbsen-Karotten, tiefgefroren, gebacken | Mixed vegetables peas and carrots, deep-frozen, baked |
| [bls-G992282](0018/bls-G992282.webp) | Gemüsemischung Erbsen-Karotten, tiefgefroren, gebraten ohne Fett (Pfanne) | Mixed vegetables peas and carrots, deep-frozen, fried without fat (pan) |
| [bls-G992902](0018/bls-G992902.webp) | Gemüsemischung Erbsen-Karotten, Konserve, abgetropft | Mixed vegetables peas and carrots, canned, drained |
| [bls-G993100](0018/bls-G993100.webp) | Gemüsemischung mexikanische Art, roh | Mixed vegetables Mexican style, raw |
| [bls-G993132](0018/bls-G993132.webp) | Gemüsemischung mexikanische Art, gekocht | Mixed vegetables Mexican style, boiled |


## Tanda 0019: mezclas de verduras, frutos secos, semillas, aceitunas y brotes

100 WebP finales opacos de 1024×1024 revisados en nueve hojas de contacto; 27 casos comprobados también a tamaño completo. Una generación independiente por código, mediante el generador integrado de Codex y referencias CIQUAL usadas solo para el estilo. BLS permanece fuera de la app.

- [Hoja 01](../../../docs/testing/assets/bls-food-images-0019-01.jpg)
- [Hoja 02](../../../docs/testing/assets/bls-food-images-0019-02.jpg)
- [Hoja 03](../../../docs/testing/assets/bls-food-images-0019-03.jpg)
- [Hoja 04](../../../docs/testing/assets/bls-food-images-0019-04.jpg)
- [Hoja 05](../../../docs/testing/assets/bls-food-images-0019-05.jpg)
- [Hoja 06](../../../docs/testing/assets/bls-food-images-0019-06.jpg)
- [Hoja 07](../../../docs/testing/assets/bls-food-images-0019-07.jpg)
- [Hoja 08](../../../docs/testing/assets/bls-food-images-0019-08.jpg)
- [Hoja 09](../../../docs/testing/assets/bls-food-images-0019-09.jpg)

Las mezclas mexicana y asiática usan composiciones ilustrativas, sin certificar receta ni proporciones. Los congelados sin cocinar tienen escarcha; los cocinados desde congelado no. Nori son hojas rectangulares tostadas, sin arroz ni sushi. El aislado de proteína de soja es polvo fino; para la lecitina genérica se elige una presentación granular, una de las formas comerciales documentadas por [Bunge](https://bunge.com/markets-we-serve/technical/construction/soybean-lecithin). No se afirma que sea la forma concreta de la ficha BLS. Las salchichas de soja se muestran sin pan, salsas ni marcas de parrilla inventadas. Los fideos de almidón de mungo secos tienen hebras rígidas blanquecinas; los hervidos están hidratados, transparentes y escurridos.

Frutos secos y semillas se representan como partes comestibles sin cáscara dura. Las nueces conservan lóbulos rugosos; las pacanas, surcos longitudinales; los anacardos, curva en C; las nueces de Brasil, cuñas con piel marrón; las macadamias, color marfil y forma redonda. Las versiones molidas son harinas o granillo fino, no frutos enteros ni cremas húmedas. Las cremas de cacahuete, avellana y almendra son pastas sin pan ni ingredientes decorativos. Las almendras blanqueadas carecen de piel marrón, conforme a [BZfE](https://www.bzfe.de/presse/pressemeldungen-archiv-2024-und-frueher/suessmandeln-bittermandeln-und-krachmandeln). La almendra amarga conserva su identificación oficial, pero la imagen no permite distinguir con fiabilidad sabor, composición o seguridad: su parecido con la dulce está descrito por la [Verbraucherzentrale Bayern](https://www.verbraucherzentrale.bayern/faq/sind-bittermandeln-gesundheitsschaedlich-20872).

El coco fresco es pulpa blanca con fina testa marrón, el rallado seco son fibras cortas; el agua de coco es translúcida y la leche de coco opaca, cada una en un vaso transparente sencillo sin hielo ni fruta de adorno. Las castañas se muestran peladas; las cocinadas conservan su pulpa lobulada y la harina es polvo seco. Los tostados tienen dorado moderado; la grasa no se cuantifica mediante brillo. Solo los códigos con sal muestran algunos cristales adheridos. Las semillas de lino son marrones y aplanadas; las de chía, moteadas; las de amapola, muy pequeñas y azul grisáceo. Las harinas de semilla no se confunden con semillas enteras.

Las aceitunas están escurridas, sin charcos de salmuera. Los rellenos de pasta de pimiento rojo y de almendra quedan visibles dentro de las aberturas, sin ingredientes sueltos como decoración. Las aceitunas ennegrecidas se representan uniformemente negras: el [Consejo Oleícola Internacional](https://www.internationaloliveoil.org/wp-content/uploads/2022/05/COI-OT-NC1-2004-Eng.pdf) distingue el oscurecimiento por oxidación de las aceitunas naturalmente negras. Los brotes de bambú son pulpa tierna marfil sin vainas leñosas. Los germinados de soja conservan cotiledones amarillos grandes, los de mungo tienen tallos blancos y puntas pequeñas; se mantienen separadas las identificaciones oficiales, aunque en el comercio puedan confundirse. [Minn Tofu](https://minntofu.com/products/soybean-sprouts/) muestra el grano amarillo unido al brote de soja y [USDA](https://www.ars.usda.gov/is/np/CommercialStorage/CommercialStorage.pdf) describe los hipocótilos blancos y cotiledones amarillos o verdes del mungo. La alfalfa tiene tallos finos y pequeñas hojas; las lentejas germinadas mantienen la semilla con radículas. Los caupís secos conservan su ojo negro y los hervidos o en conserva están hidratados. La harina de guisante usa un tono crema verdoso ilustrativo, sin certificar variedad.

Estas ilustraciones no certifican especie, variedad, receta, ingredientes exactos, alérgenos, propiedades nutricionales ni porción de 100 g. Las fichas nutricionales y las fuentes oficiales no cambian.

Correcciones visuales registradas: 0.  Casos abiertos a tamaño completo: `bls-G994100`, `bls-G995000`, `bls-H030400`, `bls-H030432`, `bls-H120400`, `bls-H130400`, `bls-H150100`, `bls-H151000`, `bls-H154000`, `bls-H011000`, `bls-H012000`, `bls-H210200`, `bls-H220100`, `bls-H230132`, `bls-H230172`, `bls-H410400`, `bls-H450400`, `bls-H480100`, `bls-H510900`, `bls-H511900`, `bls-H520800`, `bls-H620100`, `bls-H650100`, `bls-H662100`, `bls-H702100`, `bls-H702132`, `bls-H710400`.

| Imagen | Nombre alemán oficial | Nombre inglés oficial |
| --- | --- | --- |
| [bls-G993142](0019/bls-G993142.webp) | Gemüsemischung mexikanische Art, geschmort ohne Fett | Mixed vegetables Mexican style, braised without fat |
| [bls-G993152](0019/bls-G993152.webp) | Gemüsemischung mexikanische Art, gedünstet | Mixed vegetables Mexican style, stewed |
| [bls-G993182](0019/bls-G993182.webp) | Gemüsemischung mexikanische Art, gebraten ohne Fett (Pfanne) | Mixed vegetables Mexican style, fried without fat (pan) |
| [bls-G993200](0019/bls-G993200.webp) | Gemüsemischung mexikanische Art, tiefgefroren | Mixed vegetables Mexican style, deep-frozen |
| [bls-G993232](0019/bls-G993232.webp) | Gemüsemischung mexikanische Art, tiefgefroren, gekocht | Mixed vegetables Mexican style, deep-frozen, boiled |
| [bls-G993242](0019/bls-G993242.webp) | Gemüsemischung mexikanische Art, tiefgefroren, geschmort ohne Fett | Mixed vegetables Mexican style, deep-frozen, braised without fat |
| [bls-G993252](0019/bls-G993252.webp) | Gemüsemischung mexikanische Art, tiefgefroren, gedünstet | Mixed vegetables Mexican style, deep-frozen, stewed |
| [bls-G993282](0019/bls-G993282.webp) | Gemüsemischung mexikanische Art, tiefgefroren, gebraten ohne Fett (Pfanne) | Mixed vegetables Mexican style, deep-frozen, fried without fat (pan) |
| [bls-G993902](0019/bls-G993902.webp) | Gemüsemischung mexikanische Art, Konserve, abgetropft | Mixed vegetables Mexican style, canned, drained |
| [bls-G994100](0019/bls-G994100.webp) | Gemüsemischung asiatische Art, roh | Mixed vegetables Asian style, raw |
| [bls-G994132](0019/bls-G994132.webp) | Gemüsemischung asiatische Art, gekocht | Mixed vegetables Asian style, boiled |
| [bls-G994142](0019/bls-G994142.webp) | Gemüsemischung asiatische Art, geschmort ohne Fett | Mixed vegetables Asian style, braised without fat |
| [bls-G994152](0019/bls-G994152.webp) | Gemüsemischung asiatische Art, gedünstet | Mixed vegetables Asian style, stewed |
| [bls-G994162](0019/bls-G994162.webp) | Gemüsemischung asiatische Art, gebacken | Mixed vegetables Asian style, baked |
| [bls-G994182](0019/bls-G994182.webp) | Gemüsemischung asiatische Art, gebraten ohne Fett (Pfanne) | Mixed vegetables Asian style, fried without fat (pan) |
| [bls-G994200](0019/bls-G994200.webp) | Gemüsemischung asiatische Art, tiefgefroren | Mixed vegetables Asian style, deep-frozen |
| [bls-G994232](0019/bls-G994232.webp) | Gemüsemischung asiatische Art, tiefgefroren, gekocht | Mixed vegetables Asian style, deep-frozen, boiled |
| [bls-G994242](0019/bls-G994242.webp) | Gemüsemischung asiatische Art, tiefgefroren, geschmort ohne Fett | Mixed vegetables Asian style, deep-frozen, braised without fat |
| [bls-G994252](0019/bls-G994252.webp) | Gemüsemischung asiatische Art, tiefgefroren, gedünstet | Mixed vegetables Asian style, deep-frozen, stewed |
| [bls-G994262](0019/bls-G994262.webp) | Gemüsemischung asiatische Art, tiefgefroren, gebacken | Mixed vegetables Asian style, deep-frozen, baked |
| [bls-G994282](0019/bls-G994282.webp) | Gemüsemischung asiatische Art, tiefgefroren, gebraten ohne Fett (Pfanne) | Mixed vegetables Asian style, deep-frozen, fried without fat (pan) |
| [bls-G995000](0019/bls-G995000.webp) | Nori-Blatt geröstet | Sushi nori (toasted) |
| [bls-H011000](0019/bls-H011000.webp) | Sojaproteinisolat | Soya bean protein isolate |
| [bls-H012000](0019/bls-H012000.webp) | Sojalecithin | Soya bean lecithin |
| [bls-H014900](0019/bls-H014900.webp) | Sojawürstchen | Soya bean small sausage |
| [bls-H030400](0019/bls-H030400.webp) | Glasnudeln aus Mungbohnenstärke, roh | Glass noodles made from mung bean starch, raw |
| [bls-H030432](0019/bls-H030432.webp) | Glasnudeln aus Mungbohnenstärke, gekocht | Glass noodles made from mung bean starch, boiled |
| [bls-H110600](0019/bls-H110600.webp) | Erdnuss geröstet | Peanut roasted |
| [bls-H110700](0019/bls-H110700.webp) | Erdnuss geröstet, gesalzen | Peanut roasted, salted |
| [bls-H110800](0019/bls-H110800.webp) | Erdnussmus | Peanut butter (100 % pure) |
| [bls-H120100](0019/bls-H120100.webp) | Walnuss | Walnut |
| [bls-H120400](0019/bls-H120400.webp) | Walnuss gemahlen | Walnut ground |
| [bls-H120610](0019/bls-H120610.webp) | Walnuss geröstet ohne Fett | Walnut roasted without fat |
| [bls-H130100](0019/bls-H130100.webp) | Haselnuss | Hazelnut |
| [bls-H130400](0019/bls-H130400.webp) | Haselnuss gemahlen | Hazelnut ground |
| [bls-H130610](0019/bls-H130610.webp) | Haselnuss geröstet ohne Fett | Hazelnut roasted without fat |
| [bls-H130800](0019/bls-H130800.webp) | Haselnussmus | Hazelnut butter (100 % pure) |
| [bls-H150100](0019/bls-H150100.webp) | Kokos Fruchtfleisch, roh | Coconut meat, raw |
| [bls-H150400](0019/bls-H150400.webp) | Kokos Fruchtfleisch, geraspelt, getrocknet | Coconut meat, grated, dried |
| [bls-H151000](0019/bls-H151000.webp) | Kokoswasser (Fruchtwasser) | Coconut water (liquid from coconuts) |
| [bls-H154000](0019/bls-H154000.webp) | Kokosmilch/Kokosnussmilch | Coconut milk |
| [bls-H160100](0019/bls-H160100.webp) | Pekannuss | Pecan |
| [bls-H160600](0019/bls-H160600.webp) | Pekannuss geröstet ohne Fett | Pecan roasted without fat |
| [bls-H170100](0019/bls-H170100.webp) | Cashewkern | Cashew nut |
| [bls-H170600](0019/bls-H170600.webp) | Cashewkern geröstet mit Fett | Cashew nut roasted with fat |
| [bls-H170610](0019/bls-H170610.webp) | Cashewkern geröstet ohne Fett | Cashew nut roasted without fat |
| [bls-H170700](0019/bls-H170700.webp) | Cashewkern geröstet mit Fett, gesalzen | Cashew nut roasted with fat, salted |
| [bls-H180100](0019/bls-H180100.webp) | Paranuss | Brazil nut |
| [bls-H180610](0019/bls-H180610.webp) | Paranuss geröstet ohne Fett | Brazil nut roasted without fat |
| [bls-H190100](0019/bls-H190100.webp) | Macadamianuss | Macadamia nut |
| [bls-H190600](0019/bls-H190600.webp) | Macadamianuss geröstet ohne Fett | Macadamia nut roasted without fat |
| [bls-H190700](0019/bls-H190700.webp) | Macadamianuss geröstet ohne Fett, gesalzen | Macadamia nut roasted without fat, salted |
| [bls-H210100](0019/bls-H210100.webp) | Mandel süß | Sweet almond |
| [bls-H210200](0019/bls-H210200.webp) | Mandel süß, blanchiert | Sweet almond blanched |
| [bls-H210400](0019/bls-H210400.webp) | Mandel süß, gemahlen | Sweet almond crushed |
| [bls-H210600](0019/bls-H210600.webp) | Mandel süß, geröstet ohne Fett | Sweet almond roasted without fat |
| [bls-H210710](0019/bls-H210710.webp) | Mandel süß, geröstet mit Fett, gesalzen | Sweet almond roasted with fat, salted |
| [bls-H212800](0019/bls-H212800.webp) | Mandelmus | Sweet almond butter (100 % pure) |
| [bls-H220100](0019/bls-H220100.webp) | Mandel bitter | Bitter almond |
| [bls-H230100](0019/bls-H230100.webp) | Edelkastanie/Marone | Sweet chestnut |
| [bls-H230132](0019/bls-H230132.webp) | Edelkastanie/Marone, gekocht | Sweet chestnut boiled |
| [bls-H230162](0019/bls-H230162.webp) | Edelkastanie/Marone, gebacken | Sweet chestnut baked |
| [bls-H230172](0019/bls-H230172.webp) | Edelkastanie/Marone, gegrillt | Sweet chestnut grilled |
| [bls-H230182](0019/bls-H230182.webp) | Edelkastanie/Marone, gebraten ohne Fett (Pfanne) | Sweet chestnut fried without fat (pan) |
| [bls-H230400](0019/bls-H230400.webp) | Kastanienmehl | Sweet chestnut flour |
| [bls-H250100](0019/bls-H250100.webp) | Pistazie | Pistachio nut |
| [bls-H250600](0019/bls-H250600.webp) | Pistazie geröstet ohne Fett | Pistachio nut roasted without fat |
| [bls-H250700](0019/bls-H250700.webp) | Pistazie geröstet ohne Fett, gesalzen | Pistachio nut roasted without fat, salted |
| [bls-H310100](0019/bls-H310100.webp) | Kürbiskern | Pumpkin seed |
| [bls-H310600](0019/bls-H310600.webp) | Kürbiskern geröstet ohne Fett | Pumpkin seed roasted without fat |
| [bls-H320100](0019/bls-H320100.webp) | Pinienkern | Pine nut |
| [bls-H320600](0019/bls-H320600.webp) | Pinienkern geröstet ohne Fett | Pine nut roasted without fat |
| [bls-H410100](0019/bls-H410100.webp) | Leinsamen | Linseed/flax seed |
| [bls-H410400](0019/bls-H410400.webp) | Leinsamen geschrotet | Linseed/flax seed, ground |
| [bls-H410600](0019/bls-H410600.webp) | Leinsamen geröstet ohne Fett | Linseed/flax seed, roasted without fat |
| [bls-H420100](0019/bls-H420100.webp) | Sesam | Sesame seed |
| [bls-H420610](0019/bls-H420610.webp) | Sesam geröstet ohne Fett | Sesame seeds roasted without fat |
| [bls-H430100](0019/bls-H430100.webp) | Sonnenblumenkern | Sunflower seed |
| [bls-H430610](0019/bls-H430610.webp) | Sonnenblumenkern geröstet ohne Fett | Sunflower seeds roasted without fat |
| [bls-H450100](0019/bls-H450100.webp) | Mohn | Poppy seed |
| [bls-H450400](0019/bls-H450400.webp) | Mohn gemahlen | Poppy seed ground |
| [bls-H480100](0019/bls-H480100.webp) | Chia-Samen | Chia seeds |
| [bls-H510802](0019/bls-H510802.webp) | Oliven grün, gesäuert, abgetropft | Olives green, pickled, drained |
| [bls-H510900](0019/bls-H510900.webp) | Oliven grün, gefüllt mit Paprikapaste, gesäuert, abgetropft | Olives green, filled with sweet pepper paste, pickled, drained |
| [bls-H511900](0019/bls-H511900.webp) | Oliven grün, gefüllt mit Mandeln, gesäuert, abgetropft | Olives green, filled with almonds, pickled, drained |
| [bls-H520800](0019/bls-H520800.webp) | Oliven geschwärzt, in Salzlake, abgetropft | Olives blackened, in brine, drained |
| [bls-H610100](0019/bls-H610100.webp) | Bambussprossen roh | Bamboo shoots raw |
| [bls-H610132](0019/bls-H610132.webp) | Bambussprossen gekocht | Bamboo shoots boiled |
| [bls-H610182](0019/bls-H610182.webp) | Bambussprossen gebraten ohne Fett (Pfanne) | Bamboo shoots fried without fat (pan) |
| [bls-H610902](0019/bls-H610902.webp) | Bambussprossen Konserve, abgetropft | Bamboo shoots canned, drained |
| [bls-H620100](0019/bls-H620100.webp) | Sojabohnensprossen/Sojabohnenkeimlinge, roh | Soya bean sprouts raw |
| [bls-H620902](0019/bls-H620902.webp) | Sojabohnensprossen/Sojabohnenkeimlinge, Konserve, abgetropft | Soya bean sprouts canned, drained |
| [bls-H640100](0019/bls-H640100.webp) | Alfalfasprossen/Alfalfakeimlinge, roh | Lucerne/alfalfa sprouts, raw |
| [bls-H650100](0019/bls-H650100.webp) | Mungbohnensprossen/Mungbohnenkeimlinge, roh | Mung bean sprouts raw |
| [bls-H650902](0019/bls-H650902.webp) | Mungbohnensprossen/Mungbohnenkeimlinge, Konserve, abgetropft | Mung bean sprouts canned, drained |
| [bls-H662100](0019/bls-H662100.webp) | Linsensprossen/Linsenkeimlinge, roh | Lentils sprouted raw |
| [bls-H702100](0019/bls-H702100.webp) | Augenbohne reif | Cowpea/black-eyed pea, mature |
| [bls-H702132](0019/bls-H702132.webp) | Augenbohne reif, gekocht | Cowpea/black-eyed pea, mature, boiled |
| [bls-H702902](0019/bls-H702902.webp) | Augenbohne reif, Konserve, abgetropft | Cowpea/black-eyed pea, mature, canned, drained |
| [bls-H710400](0019/bls-H710400.webp) | Erbsenmehl | Pea flour |
