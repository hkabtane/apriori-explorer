# Apriori Explorer

Une application pédagogique en français pour explorer l’algorithme Apriori étape par étape.

## Fonctionnalités

- Animation du comptage des groupes fréquents, de la génération des candidats et de l’élagage Apriori.
- Mise en évidence des paniers qui contiennent le groupe sélectionné.
- Transactions, support minimum et confiance minimum modifiables.
- Affichage des groupes fréquents et des règles d’association.

## Utilisation

Ouvrez [`apriori-explorer/dist/index.html`](apriori-explorer/dist/index.html) dans un navigateur. Aucun serveur ni installation n’est nécessaire. Les calculs sont effectués localement dans le navigateur.

Le jeu d’exemple utilise huit paniers et un support minimum de trois paniers. Il permet d’observer un groupe non fréquent et un candidat éliminé avant comptage grâce à la propriété Apriori.

## Fichiers

- `apriori-explorer/dist/index.html` : structure de l’interface.
- `apriori-explorer/dist/styles.css` : présentation et adaptation mobile.
- `apriori-explorer/dist/app.js` : simulation et calculs Apriori.
