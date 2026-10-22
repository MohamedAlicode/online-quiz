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
- Fin de partie : **podium animé** (top 3), classement complet, stats personnelles pour chaque joueur.
- Reconnexion : un joueur qui perd sa connexion peut revenir dans la partie avec le même pseudo (token de session stocké localement).
- L'hôte peut : passer à la question suivante, mettre en pause, terminer la partie.

### 3.4 Score

- Bonne réponse : `points = base * (1 - (tempsMis / tempsImparti) / 2)`, arrondi. Une réponse instantanée vaut presque 100 % de la base, une réponse au dernier moment 50 %.
- Mauvaise réponse ou absence de réponse : 0.
- **Série (streak)** : bonus de +100 par bonne réponse consécutive (plafonné à +500).
- Le calcul est une fonction pure dans `packages/shared` ou un service serveur, 100 % testée.

### 3.5 Historique

- Après la partie, l'hôte consulte les résultats : classement final, taux de réussite par question, questions les plus ratées.
- Export CSV des résultats.

## 4. Machine à états d'une partie

`LOBBY → COUNTDOWN → QUESTION → RESULTS → LEADERBOARD → (QUESTION | PODIUM) → FINISHED`
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
- `host:start-game`, `host:next`, `host:pause`, `host:resume`, `host:end-game`, `host:kick-player` { playerId }
- `player:join` { code, nickname }
- `player:rejoin` { sessionToken }
- `player:answer` { questionId, choiceId }

**Serveur → client**

- `lobby:updated` { players[] }
- `game:state` { status, ...données de l'état courant }
- `question:started` { question (sans la bonne réponse), endsAt }
- `question:results` { correctChoiceId, distribution, playerResult }
- `leaderboard:updated` { top[], playerRank? }
- `game:finished` { podium[], fullRanking[] }
- `error` { code, message }

Règles : la bonne réponse n'est **jamais** envoyée avant la fin de la question. Chaque événement entrant est validé avec Zod. Rate limiting sur `player:join` et `player:answer`.

## 7. API REST (Express)

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/quizzes`, `GET/PUT/DELETE /api/quizzes/:id`, `POST /api/quizzes/:id/duplicate`
- `POST /api/quizzes/:id/questions`, `PUT/DELETE /api/questions/:id`, `PUT /api/quizzes/:id/questions/reorder`
- `GET /api/games/:id/results`, `GET /api/games/:id/results.csv`
- `GET /api/health`
- Documentation Swagger sur `/api/docs`.

## 8. Écrans (front)

- **Public** : accueil (saisie du code + pseudo), connexion/inscription.
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

Questions à choix multiple et réponse libre, mode équipes, import de quiz (CSV), bibliothèque de quiz publics, sons et musique, thèmes personnalisables, internationalisation.
