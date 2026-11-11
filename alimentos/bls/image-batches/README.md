# Imágenes BLS por tandas

Imágenes editoriales independientes de los datos y de la app, generadas mediante
una llamada integrada de Codex por alimento. Se mantiene el estilo aprobado de
las muestras CIQUAL como referencia visual; no se reutilizan sus fotografías.
Las ilustraciones son de Gymnasia, no proporcionadas ni validadas por Max
Rubner-Institut. No prueban receta, porción de 100 g, ingredientes exactos,
alérgenos ni propiedades nutricionales. Fuente de los nombres: Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0.

## Estado

**200/7.140 imágenes registradas; 6.940 pendientes; 2,80 %.**

Las tandas `0001` y `0002` contienen 100 imágenes cada una, generadas con Codex
integrado y revisadas visualmente. Las PRs quedan abiertas; `pending-review` no
equivale a aprobación del mantenedor. No hay integración móvil.

- [Tanda 0001: manifiesto y prompts](0001/manifest.json).
- [Tanda 0002: manifiesto y prompts](0002/manifest.json).

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
