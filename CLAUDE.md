# CLAUDE.md : Quiz multijoueur en direct (type Kahoot)

## Contexte

Projet portfolio d'un développeur web junior (Bachelor informatique, option dev web). L'objectif est double :

1. Une application fonctionnelle, déployée en ligne, démontrable en vidéo.
2. Un code propre, lisible et documenté, que des recruteurs liront sur GitHub.

Le dépôt doit donc être soigné : commits clairs, README illustré, tests, CI.

## Stack

- **Monorepo** avec npm workspaces : `apps/web`, `apps/server`, `packages/shared`
- **Front** : React + Vite + TypeScript, React Router, Zustand (état), Tailwind CSS
- **Animation** : Framer Motion (transitions, composants) et GSAP (séquences : compte à rebours, podium)
- **Back** : Node.js + Express + TypeScript
- **Temps réel** : Socket.IO
- **Base de données** : PostgreSQL + Prisma
- **Auth** : JWT (hôtes uniquement), mots de passe hachés avec argon2 ou bcrypt
- **Validation** : Zod (partagé entre front et back via `packages/shared`)
- **Tests** : Vitest (unitaires et intégration), Supertest pour l'API
- **Outillage** : ESLint, Prettier, Husky + lint-staged, Docker Compose (Postgres local), GitHub Actions
- **API documentée** : OpenAPI/Swagger sur `/api/docs`

## Conventions

- TypeScript strict partout, pas de `any` sans justification en commentaire.
- Les types et schémas Zod communs (événements socket, DTO) vivent dans `packages/shared`. Jamais de duplication front/back.
- Nommage : code en anglais, commentaires et README en français.
- Commits au format Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`), petits et atomiques.
- Une fonctionnalité = une branche `feat/...` puis une PR (même en solo), pour montrer une vraie démarche.
- Le serveur est l'unique source de vérité : scores, timers et état de la partie sont calculés côté serveur. Le client n'affiche que ce qu'il reçoit.
- Aucune logique métier dans les contrôleurs ou handlers socket : elle va dans des services testables.
- Variables d'environnement via `.env`, jamais commitées ; fournir un `.env.example` complet.
- Accessibilité : contrastes suffisants, navigation clavier, `prefers-reduced-motion` respecté pour les animations.
- Responsive mobile-first : les joueurs jouent sur téléphone, l'hôte projette sur grand écran.

## Commandes attendues

- `npm run dev` : lance web + server en parallèle
- `npm run test` : tous les tests
- `npm run lint` et `npm run typecheck`
- `docker compose up -d` : base de données locale
- `npx prisma migrate dev` : migrations

## Règles de travail pour Claude Code

- Avancer **jalon par jalon** (voir SPEC.md). S'arrêter à la fin de chaque jalon, résumer ce qui est fait et lancer les tests avant de continuer.
- Avant de coder un jalon, proposer en quelques lignes le plan d'implémentation.
- Ne pas ajouter de dépendances lourdes sans le signaler et le justifier.
- Écrire les tests en même temps que le code, surtout pour le calcul des scores et la machine à états de la partie.
- Garder le README à jour à chaque jalon.
