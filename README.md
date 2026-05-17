# Chess Drill

Trainer d'ouvertures pour Chess.com - répertoire personnel de [louisssmrt](https://www.chess.com/member/louisssmrt).

## Démo en ligne

**[louisssmrt.github.io/chess](https://louisssmrt.github.io/chess/)**

## Ce que c'est

Une page web statique qui drille un répertoire d'ouvertures par séquences :

- Tu charges une ligne (Scotch, Caro-Kann, Smith-Morra, etc.)
- L'échiquier joue automatiquement les coups d'intro
- Quand c'est à toi, tu joues à la souris
- Bon coup → l'adversaire répond automatiquement, tu continues
- Mauvais coup → revert + le bon coup s'affiche, tu rejoues

## Stack

- `index.html` - drill autonome (HTML/CSS/JS pur)
- `repertoire.json` - les lignes (ouverture, coups, pourquoi)
- [chessboard.js](https://chessboardjs.com/) pour l'échiquier
- [chess.js](https://github.com/jhlywa/chess.js) pour la validation des coups
- jQuery (requis par chessboard.js)

## Utilisation locale

```bash
node serve.js
# puis ouvrir http://localhost:8080/
```

(Le `fetch('repertoire.json')` ne marche pas en `file://` à cause de CORS - d'où le mini serveur Node.)

## Ajouter une ligne au répertoire

Édite `repertoire.json`. Chaque ligne :

```json
{
  "id": "exemple",
  "opening": "Scotch",
  "label": "Description courte",
  "color": "white",
  "intro": "Le contexte de cette ligne.",
  "moves": [
    { "san": "e4" },
    { "san": "e5" },
    { "san": "Nf3", "user": true, "why": "Pourquoi ce coup." },
    { "san": "Nc6" }
  ]
}
```

Champs :
- `user: true` = ce coup doit être joué par l'utilisateur
- `why` = explication affichée après un bon coup
- `alts: ["Be3"]` = coups alternatifs acceptables
- `priority` = libellé orange (ex. "CRITIQUE - 0% sur 4 parties")

## Licence

MIT.
