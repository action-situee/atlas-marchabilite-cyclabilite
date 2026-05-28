# Design de l'application

Document établi à partir du code de l'application, principalement `src/App.tsx`, `src/components/Map.tsx`, `src/config/modes.ts`, `src/components/AttributePanel.tsx`, `src/components/ModeToggle.tsx`, `src/components/ScaleToggle.tsx`, `src/components/TerritoryToggle.tsx`, `src/colors.ts` et `src/index.css`.

## Objet

L'application est un atlas cartographique de mobilité active. Elle permet de lire deux indices territoriaux, la marchabilité et la cyclabilité, à plusieurs échelles spatiales et sur deux périmètres d'analyse.

L'interface est pensée comme un outil de diagnostic cartographique plutôt que comme une page de présentation. La carte occupe tout l'écran. Les contrôles sont superposés à la carte, avec un en-tête fixe, un panneau analytique latéral et une barre de navigation cartographique.

## Structure générale

L'application est organisée autour de quatre zones.

1. En-tête supérieur

   L'en-tête contient le logo Située, le titre `Mobilité Active`, les sélecteurs de mode, d'échelle et de territoire, le score global et le bouton d'information.

2. Carte plein écran

   La carte MapLibre occupe toute la fenêtre. Elle porte les couches d'analyse, les fonds de carte, la frontière cantonale, les éventuels corridors vélo et les interactions de survol.

3. Panneau analytique droit

   Le panneau latéral affiche une vue radar, les classes d'attributs, les attributs détaillés, la légende, le mode de coloration et l'histogramme de distribution. Il est masqué sur mobile.

4. Contrôles de carte

   Les contrôles sont placés en bas à gauche : export, zoom, recentrage, perspective, labels, périmètre, corridors vélo, nord, fond de carte et échelle métrique.

## Modes d'analyse

Deux modes sont disponibles.

### Marchabilité

Mode accessible par `#marchabilite` ou `/marchabilite`. Le thème visuel repose sur une dominante claire jaune-beige :

- fond de page : `#F7F0CC`
- accent : `#D7A31B`
- accent foncé : `#7A5A00`
- accent clair : `#F6E6A4`

L'indice principal est lu dans le champ `walk_index`. Les classes d'analyse sont :

- Commodité
- Attractivité
- Infrastructure
- Sécurité

### Cyclabilité

Mode accessible par `#cyclabilite` ou `/cyclabilite`. Le thème visuel repose sur une dominante verte :

- fond de page : `#E5EEE6`
- accent : `#2E6A4A`
- accent foncé : `#173828`
- accent clair : `#D3E4D7`

L'indice principal est lu dans le champ `bike_index`. Les classes d'analyse sont :

- Attractivité
- Confort
- Équipement
- Infrastructure
- Sécurité

Le passage d'un mode à l'autre réinitialise le territoire sur `Grand Genève`, l'échelle sur `Rue`, les sélections d'attributs, les classes ouvertes, les données de distribution et les paramètres de debug.

## Échelles et territoires

Trois échelles d'analyse sont prévues :

- `Rue` : tronçons de rue, source `segment`.
- `Quartier` : grille statistique 200 m, source `carreau200`.
- `Secteur` : zones de trafic ou infracommunales, source `zoneTrafic`.

Deux territoires sont disponibles :

- `Grand Genève`, valeur interne `grandGeneve`.
- `Canton de Genève`, valeur interne `cantonGeneve`.

Les boutons `Quartier` et `Secteur` peuvent être désactivés si les sources correspondantes ne sont pas disponibles. Dans ce cas, l'interface affiche `Données manquantes` et empêche la sélection.

Particularité importante : lorsque l'échelle demandée est `Rue`, l'affichage est hybride si la source `carreau200` est disponible. En dessous ou à proximité du zoom de détail, les carreaux 200 m sont visibles pour éviter un rendu trop dense des tronçons. Le seuil principal est `SEGMENT_DETAIL_ZOOM = 11`, avec une transition d'opacité entre `10.7` et `11.2`.

## Couleurs et lecture des scores

Les valeurs sont normalisées entre 0 et 1. La palette de lecture va du rouge au vert :

- rouge foncé pour les valeurs défavorables proches de 0 ;
- jaune et vert clair pour les valeurs intermédiaires ;
- vert foncé pour les valeurs favorables proches de 1.

La palette est discrète, avec des seuils de `0.1` à `1.0`. Deux modes de coloration sont disponibles dans la légende :

- `Linéaire` : seuils fixes définis dans `src/colors.ts`.
- `Quantile` : seuils recalculés à partir des entités rendues dans la carte.

Le panneau latéral utilise en plus des barres vertes ou rouges pour distinguer les attributs favorables et défavorables.

## Panneau analytique

Le panneau droit présente la lecture détaillée de l'objet actuellement survolé. Sans survol, les scores sont initialisés à zéro.

Le panneau contient :

- une vue d'ensemble en radar ;
- une liste de classes repliables ;
- une sélection par classe ou par attribut ;
- une légende de scores ;
- un sélecteur de coloration `Linéaire` ou `Quantile` ;
- un histogramme de distribution activable depuis la légende ;
- une zone de debug discrète indiquant l'échelle, le mode, le champ actif, la couche active et les seuils.

Sur les écrans étroits, le panneau est masqué afin de préserver la lisibilité de la carte.

## Réglages de navigation de la carte

La carte est initialisée avec MapLibre GL.

### Caméra par défaut

Les valeurs par défaut sont :

- centre : longitude `6.1600`, latitude `46.2300` ;
- zoom : `11` ;
- orientation : `0` degré ;
- inclinaison : `0` degré.

Le bouton de recentrage remet la carte sur ces valeurs avec `flyTo`.

### Contraintes géographiques

Deux enveloppes géographiques sont codées.

Périmètre d'analyse :

```ts
[
  [5.600526, 45.857307],
  [6.646596, 46.635298]
]
```

Périmètre maximal de navigation :

```ts
[
  [5.100526, 45.507307],
  [7.086596, 46.995298]
]
```

La carte applique `setMaxBounds` sur le périmètre maximal. Le zoom minimal est recalculé à partir du cadrage du périmètre d'analyse, avec un plancher à `8` et une marge de `2.1` niveaux de zoom sous le zoom nécessaire au cadrage.

Le zoom maximal n'est pas explicitement défini dans le code. Il reste donc celui du style et de MapLibre.

### Interactions natives MapLibre

Le code ne désactive pas explicitement les interactions MapLibre. Les interactions natives attendues restent donc disponibles :

- déplacement par glisser-déposer ;
- zoom à la molette ou au pavé tactile ;
- zoom tactile ;
- rotation et inclinaison selon les interactions natives du navigateur et de MapLibre ;
- navigation clavier standard si elle est active côté MapLibre.

Ces comportements ne sont pas paramétrés explicitement dans `Map.tsx`. Si un comportement strict est requis, il faudrait les déclarer dans les options de création de la carte.

### Contrôles visibles

La barre de contrôle de carte comprend les commandes suivantes.

| Contrôle | Effet |
|---|---|
| Export | génère un export PNG A3 de la carte courante |
| Zoom avant | appelle `map.zoomIn()` |
| Zoom arrière | appelle `map.zoomOut()` |
| Recentrer | revient au centre, zoom, orientation et inclinaison par défaut |
| Perspective | bascule entre vue plane et vue inclinée |
| T | affiche ou masque les labels du fond de carte |
| F | affiche ou masque la frontière cantonale |
| C | affiche ou masque le masque et les corridors d'ensemble en mode cyclabilité |
| Boussole | remet le nord en haut |
| Fond de carte | change le style de fond |
| Échelle métrique | affiche une échelle MapLibre en unités métriques |

La perspective bascule sur une inclinaison de `55` degrés. Si la carte est orientée au nord au moment de l'activation, le bearing passe à `-18` degrés pour rendre l'effet de perspective visible. Le `maxPitch` MapLibre est fixé à `60`.

### Raccourcis clavier

Les raccourcis actuellement branchés sont :

| Touche | Effet |
|---|---|
| `T` | afficher ou masquer les labels |
| `O` | activer ou désactiver la perspective |
| `N` | remettre le nord en haut |
| `F` | afficher ou masquer la frontière cantonale |
| `P` | afficher ou masquer la frontière cantonale |

Point de vigilance : le bouton des corridors vélo indique `(C)` dans son titre, mais la touche `C` n'est pas branchée dans le gestionnaire clavier actuel.

### Fonds de carte

Quatre fonds de carte sont disponibles :

- `Voyager`, fond par défaut, basé sur `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json` ;
- `Swiss Light`, basé sur le style vectoriel swisstopo lightbasemap ;
- `Swiss Imagerie`, basé sur le style vectoriel swisstopo imagerybasemap ;
- `Sans fond`, style vide avec fond blanc.

Les URLs peuvent être remplacées par variables d'environnement :

- `VITE_MAP_STYLE_VOYAGER`
- `VITE_MAP_STYLE_POSITRON`
- `VITE_MAP_STYLE_LIGHT`
- `VITE_MAP_STYLE_SWISS_LIGHT`
- `VITE_MAP_STYLE_SWISS_IMAGERY`

Les URLs Mapbox sont réécrites et complétées avec `VITE_MAPBOX_TOKEN` si nécessaire.

### Labels

Les labels sont masqués par défaut. Quand ils sont activés, l'application détecte les couches de type `symbol` contenant un `text-field`, filtre les couches de labels de lieux et tente d'utiliser en priorité les noms français :

```ts
name_fr
name:fr
name_fr_latin
name:fr-Latn
name
name_en
```

Les labels sont ensuite déplacés au-dessus des couches d'analyse.

### Frontière cantonale

La frontière cantonale est visible par défaut. Elle est rendue par les couches `perimeter-casing` et `perimeter-outline`. L'opacité de l'outline augmente avec le zoom.

La source par défaut est :

```txt
/tiles/canton_perimeter.pmtiles
```

### Corridors et masque vélo

En mode cyclabilité, l'application affiche par défaut un masque d'ensemble et deux corridors :

- `Gaillard - Thonex - Eaux-Vives`
- `Saint-Julien - PLO - Carouge`

Les fichiers GeoJSON par défaut sont :

```txt
/data/perimeter/f3_perimetre_arrondi.geojson
/data/perimeter/f4_perimetre_arrondi.geojson
```

Les URLs peuvent être remplacées par :

- `VITE_FAISCEAU_GAILLARD_GEOJSON_URL`
- `VITE_FAISCEAU_STJULIEN_GEOJSON_URL`

Le masque est seulement actif en cyclabilité. Il est masqué automatiquement dans les autres modes.

### État de caméra

L'application conserve en mémoire l'état de caméra :

- centre ;
- zoom ;
- orientation ;
- inclinaison.

Cet état est synchronisé pendant les mouvements de carte et persisté à la fin des mouvements. Il est réutilisé lorsque le fond de carte est recréé.

### Indicateur de debug

Un indicateur en bas à droite affiche :

- zoom courant ;
- coordonnées du curseur ;
- centre de caméra ;
- bearing ;
- pitch.

Cet indicateur est masqué sur mobile.

## Responsive

Les règles principales sont :

- sous `1180px`, les libellés des sélecteurs de mode et d'échelle sont masqués au profit des icônes ;
- sous `980px`, le panneau passe à `268px`, le sous-titre disparaît et le territoire utilise les labels courts `GG` et `GE` ;
- sous `760px`, le header passe à `58px`, le logo se réduit et le panneau analytique est masqué ;
- sous `640px`, les contrôles secondaires de carte, le sélecteur de fond et le debug sont masqués ;
- sous `480px`, la pastille de score est masquée.

## Points de vigilance

1. Le raccourci `C` est annoncé dans le titre du bouton corridors, mais il n'est pas implémenté.

2. Les interactions natives MapLibre ne sont pas déclarées explicitement. Pour une documentation ou une recette de test stricte, il serait préférable de fixer dans le code les options `dragPan`, `scrollZoom`, `boxZoom`, `dragRotate`, `keyboard`, `doubleClickZoom` et `touchZoomRotate`.

3. L'échelle `Rue` a un comportement hybride avec les carreaux 200 m aux zooms éloignés. C'est utile visuellement, mais il faut le documenter auprès des utilisateurs pour éviter une confusion entre échelle sélectionnée et couche effectivement visible.

4. Le panneau analytique n'existe pas sur mobile. La lecture mobile est donc principalement cartographique, avec peu d'analyse détaillée.

5. Les seuils quantiles sont calculés à partir des entités rendues dans la vue courante. Ils peuvent donc varier selon le cadrage et le zoom.
