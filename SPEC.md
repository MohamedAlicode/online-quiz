# SPEC : Quiz multijoueur en direct

## 1. Concept

Une plateforme où un **hôte** crée des quiz et lance une partie en direct. Les **joueurs** rejoignent avec un code à 6 chiffres depuis leur téléphone, sans compte, répondent aux questions en temps réel et voient un classement animé. L'hôte projette l'écran principal (questions, résultats, podium).

Cas d'usage naturel : animer un groupe (centre de loisirs, classe, soirée, équipe).

## 2. Rôles

- **Hôte** : a un compte (email + mot de passe). Crée et gère ses quiz, lance et pilote les parties.
- **Joueur** : anonyme. Saisit le code de la salle et un pseudo.

## 3. Fonctionnalités

### 3.1 Compte hôte

- Inscription, connexion, déconnexion (JWT, mot de passe haché).
- Routes protégées côté API et côté front.

### 3.2 Gestion des quiz (hôte)

- CRUD de quiz : titre, description, image de couverture optionnelle, visibilité (privé / public).
- CRUD de questions dans un quiz :
  - Types : choix unique (2 à 4 réponses), vrai/faux. (Plus tard : choix multiple, réponse libre.)
  - Temps imparti par question (5 à 60 s, défaut 20 s).
  - Points de base (standard 1000, double 2000, aucun 0).
  - Réordonnancement par drag & drop.
- Duplication d'un quiz.
- Aperçu du quiz avant de lancer.

### 3.3 Partie en direct

- L'hôte lance une partie depuis un quiz : création d'une salle avec un **code à 6 chiffres** unique.
- **Lobby** : l'écran hôte affiche le code, un QR code et la liste des joueurs qui arrivent en temps réel (avec animation d'entrée). L'hôte peut exclure un joueur.
- Déroulé d'une question :
  1. Compte à rebours animé (3, 2, 1).
  2. Affichage de la question et des réponses (hôte) ; boutons de réponse colorés (joueur).
  3. Timer visible et synchronisé (calculé côté serveur).
  4. Fin de question (temps écoulé ou tous ont répondu) : révélation de la bonne réponse, répartition des réponses en histogramme animé.
  5. Classement intermédiaire (top 5) avec animation de changement de rang.
- **Enchaînement automatique** (activé par défaut) : 5 s après la révélation de la bonne réponse, le serveur lance la question suivante (ou le podium) sans passer par le classement intermédiaire. Un décompte est affiché chez l'hôte et chez les joueurs ; l'hôte peut le désactiver (`host:set-auto-advance`) ou passer tout de suite.
- Fin de partie : **podium animé** (top 3), classement complet, stats personnelles pour chaque joueur.
- Reconnexion : un joueur qui perd sa connexion peut revenir dans la partie avec le même pseudo (token de session stocké localement).
- L'hôte peut : passer à la question suivante, mettre en pause, terminer la partie.

### 3.4 Score

- Bonne réponse : points selon l'**ordre d'arrivée** des bonnes réponses (calculé à la fin de la question à partir des temps de réponse, pauses exclues) : 1er 100 % de la base, puis −10 % par place, 50 % minimum (`rankFactor`). Ex-aequo à la milliseconde : même place.
- Fin de question : l'hôte voit les trois plus rapides (`fastest`), chaque joueur sa place (`speedRank`).
- Mauvaise réponse ou absence de réponse : 0.
- **Série (streak)** : bonus de +100 par bonne réponse consécutive (plafonné à +500).
- Le calcul est une fonction pure dans `packages/shared` ou un service serveur, 100 % testée.

### 3.4 bis Quiz prêts à jouer

- Bibliothèque proposée à tous les hôtes : drapeaux d'Europe, drapeaux du monde, capitales d'Europe, capitales du monde.
- Chaque question a une image servie par l'application : drapeau (`/quiz-images/flags/<code>.svg`) ou carte de situation du pays (`/quiz-images/maps/<code>.svg`).
- Les pays sont tirés au hasard à chaque ajout (alternance des continents pour les quiz « du monde »), les mauvaises réponses viennent de la même région, la dernière question compte double.
- `GET /api/templates` liste les modèles ; `POST /api/templates/:slug/import` crée une copie modifiable dans le compte de l'hôte.

### 3.4 ter Entraînement en solo

- Page publique `/practice` : choix d'un quiz prêt à jouer (série tirée au hasard à chaque fois) ou, pour un hôte connecté, d'un de ses quiz (`/practice/quiz/:id`).
- Deux modes : **Apprendre** (sans chrono ni points, correction et phrase d'explication après chaque réponse) et **Défi chrono** (temps limité, `computeScore` avec `timeFactor` : sans adversaire, la rapidité se mesure au temps mis, 100 % à 50 % de la base).
- Passage automatique 5 s après la correction, réponses au clavier, bilan détaillé, révision des seules questions ratées, record local.
- `GET /api/practice/templates` et `GET /api/practice/templates/:slug` (public, limité en débit) : questions avec bonnes réponses et explication. Exception assumée à la règle « le serveur corrige » : rien n'est classé ni enregistré, la correction se fait côté client dans un réducteur pur testé.

### 3.5 Historique

- Après la partie, l'hôte consulte les résultats : classement final, taux de réussite par question, questions les plus ratées.
- Export CSV des résultats.

## 4. Machine à états d'une partie

`LOBBY → COUNTDOWN → QUESTION → RESULTS → LEADERBOARD → (QUESTION | PODIUM) → FINISHED`
Avec l'enchaînement automatique : `RESULTS → (COUNTDOWN | PODIUM)` au bout de 5 s.
Chaque transition est déclenchée par le serveur (timer ou action de l'hôte) et diffusée à la salle. La machine à états est un module isolé, testé avec des timers simulés.

## 5. Modèle de données (Prisma, indicatif)

- `User` : id, email (unique), passwordHash, displayName, createdAt
- `Quiz` : id, ownerId → User, title, description, coverUrl?, isPublic, createdAt, updatedAt
- `Question` : id, quizId → Quiz, type, text, imageUrl?, timeLimitSec, basePoints, position
- `Choice` : id, questionId → Question, text, isCorrect, position
- `Game` : id, quizId → Quiz, hostId → User, code (unique tant que actif), status, startedAt, endedAt?
- `Player` : id, gameId → Game, nickname (unique par partie), sessionToken, finalScore, finalRank?
- `Answer` : id, playerId → Player, questionId → Question, choiceId?, isCorrect, timeTakenMs, pointsAwarded, streakAtTime

Index : `Game.code`, `Answer(playerId, questionId)` unique.

## 6. Événements Socket.IO (typés dans `packages/shared`)

**Client → serveur**

- `host:create-game` { quizId }
- `host:rejoin` { gameId } (rechargement de la page de l'hôte)
- `host:start-game`, `host:next`, `host:pause`, `host:resume`, `host:end-game`, `host:kick-player` { playerId }, `host:set-auto-advance` { enabled }
- `player:join` { code, nickname }
- `player:rejoin` { sessionToken }
- `player:answer` { questionId, choiceId }

Chaque événement reçoit un accusé de réception typé : `{ ok: true, data }` ou `{ ok: false, error: { code, message } }`.

**Serveur → client** (implémentation retenue)

- `game:state` : l'état complet de la partie, adapté au destinataire (`role`, `me`, `view`). `view` est une union discriminée sur `status` (`LOBBY`, `COUNTDOWN`, `QUESTION`, `RESULTS`, `LEADERBOARD`, `PODIUM`, `FINISHED`) qui remplace les événements `lobby:updated`, `question:started`, `question:results`, `leaderboard:updated` et `game:finished` prévus au départ.
- `player:kicked` { message }
- `game:closed` { message }

Pourquoi un seul événement d'état : un client qui se reconnecte reçoit simplement l'état courant, sans rejouer d'historique, et le front n'a qu'une source de vérité à afficher. Chaque état contient aussi `serverNow` pour synchroniser les comptes à rebours.

Règles : la bonne réponse n'est **jamais** envoyée avant la fin de la question. Chaque événement entrant est validé avec Zod. Rate limiting sur `player:join`, `player:answer` et les commandes de l'hôte.

## 7. API REST (Express)

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/quizzes`, `GET/PUT/DELETE /api/quizzes/:id`, `POST /api/quizzes/:id/duplicate`
- `POST /api/quizzes/:id/questions`, `PUT/DELETE /api/questions/:id`, `PUT /api/quizzes/:id/questions/reorder`
- `GET /api/games` (historique), `GET /api/games/:id/results`, `GET /api/games/:id/results.csv`
- `GET /api/templates`, `POST /api/templates/:slug/import`, `GET /api/practice/templates`, `GET /api/practice/templates/:slug`
- `GET /api/health`
- Documentation Swagger sur `/api/docs`.

## 8. Écrans (front)

- **Public** : accueil (saisie du code + pseudo), connexion/inscription, entraînement en solo (choix du quiz, mode, questions, bilan).
- **Hôte** : tableau de bord des quiz, éditeur de quiz, écran de lobby, écran de jeu (grand écran), podium, page de résultats.
- **Joueur** : attente, écran de réponse (4 gros boutons colorés), feedback bonne/mauvaise réponse, rang et score, écran final.

## 9. Animations (le point fort à montrer)

- Entrée des joueurs dans le lobby (pop + léger rebond).
- Compte à rebours 3-2-1 plein écran (GSAP timeline).
- Barre de temps fluide qui change de couleur à l'approche de la fin.
- Boutons de réponse : feedback au tap, shake sur mauvaise réponse, pulse sur bonne réponse.
- Histogramme des réponses qui se remplit.
- Classement avec réordonnancement animé (layout animations de Framer Motion).
- Podium : montée des 3 marches, apparition des noms, confettis.
- Transitions de pages douces ; respect de `prefers-reduced-motion`.
- **Son** (Web Audio API, sans fichier) sur l'écran projeté et en solo : bips 3-2-1 et « top », tic-tac des 5 dernières secondes, notes des marches du podium et fanfare, bonne/mauvaise réponse en solo. Bouton pour couper, réglage mémorisé ; rien sur les téléphones des joueurs.

## 10. Qualité et déploiement

- Tests unitaires : calcul des scores, machine à états, validation Zod.
- Tests d'intégration : API (Supertest) et un scénario de partie complet avec 2 clients Socket.IO.
- GitHub Actions : lint, typecheck, tests à chaque PR.
- Docker Compose pour la base en local ; Dockerfile pour le serveur.
- Déploiement : front sur Vercel, serveur sur Render ou Railway, base sur Neon ou Supabase. Lien de démo dans le README.
- README : présentation, GIF de démonstration, schéma d'architecture, schéma de la base, instructions d'installation, choix techniques.

## 11. Jalons (à livrer dans l'ordre)

1. **Fondations** : monorepo, TypeScript, ESLint/Prettier, Docker Compose, Prisma + première migration, CI de base, endpoint `/api/health`.
2. **Auth hôte** : inscription/connexion JWT, routes protégées, pages front, tests.
3. **CRUD quiz et questions** : API + éditeur front (avec drag & drop), documentation Swagger.
4. **Moteur de jeu (serveur)** : machine à états, calcul des scores, événements Socket.IO, tests d'un scénario complet. Aucun front nécessaire à ce stade (script de test avec clients simulés).
5. **Parcours joueur et hôte (front)** : lobby, questions, résultats, classement. Version fonctionnelle, animations minimales.
6. **Animations et finitions** : tout le chapitre 9, responsive, accessibilité.
7. **Historique et export** : résultats, statistiques, CSV.
8. **Qualité et déploiement** : tests complémentaires, Dockerfile, déploiement, README final avec GIF.

## 12. Hors périmètre (pour plus tard)

Questions à choix multiple et réponse libre, mode équipes, import de quiz (CSV), bibliothèque de quiz publics créés par les hôtes, sons et musique, thèmes personnalisables, internationalisation.
