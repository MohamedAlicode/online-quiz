/**
 * Documentation OpenAPI 3.1 de l'API REST, servie sur /api/docs.
 * Le temps réel (Socket.IO) est documenté dans le README et typé dans `packages/shared/src/socket.ts`.
 */
const bearer = [{ bearerAuth: [] }];

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const json = (ref: string) => ({
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } },
});

const wrapped = (key: string, ref: string, isArray = false) => ({
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          [key]: isArray
            ? { type: 'array', items: { $ref: `#/components/schemas/${ref}` } }
            : { $ref: `#/components/schemas/${ref}` },
        },
      },
    },
  },
});

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Quiz Live API',
    version: '1.0.0',
    description:
      "API REST de Quiz Live : comptes hôtes, gestion des quiz et résultats des parties. Les routes protégées attendent l'en-tête `Authorization: Bearer <jwt>`.",
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Santé' },
    { name: 'Authentification' },
    { name: 'Quiz' },
    { name: 'Questions' },
    { name: 'Parties' },
    { name: 'Quiz prêts à jouer' },
    { name: 'Entraînement solo' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION' },
              message: { type: 'string' },
              details: {},
            },
            required: ['code', 'message'],
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          displayName: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } },
      },
      RegisterInput: {
        type: 'object',
        required: ['email', 'password', 'displayName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          displayName: { type: 'string', minLength: 2, maxLength: 40 },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string' }, password: { type: 'string' } },
      },
      QuizInput: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', maxLength: 120 },
          description: { type: 'string', maxLength: 500 },
          coverUrl: { type: ['string', 'null'], format: 'uri' },
          isPublic: { type: 'boolean', default: false },
        },
      },
      ChoiceInput: {
        type: 'object',
        required: ['text', 'isCorrect'],
        properties: { text: { type: 'string' }, isCorrect: { type: 'boolean' } },
      },
      QuestionInput: {
        type: 'object',
        required: ['text', 'choices'],
        properties: {
          type: { type: 'string', enum: ['SINGLE', 'TRUE_FALSE'], default: 'SINGLE' },
          text: { type: 'string', maxLength: 300 },
          imageUrl: { type: ['string', 'null'], format: 'uri' },
          timeLimitSec: { type: 'integer', minimum: 5, maximum: 60, default: 20 },
          basePoints: { type: 'integer', enum: [1000, 2000, 0], default: 1000 },
          choices: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            description: 'Exactement une réponse correcte. Deux réponses pour TRUE_FALSE.',
            items: { $ref: '#/components/schemas/ChoiceInput' },
          },
        },
      },
      Choice: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          isCorrect: { type: 'boolean' },
          position: { type: 'integer' },
        },
      },
      Question: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          quizId: { type: 'string' },
          type: { type: 'string', enum: ['SINGLE', 'TRUE_FALSE'] },
          text: { type: 'string' },
          imageUrl: { type: ['string', 'null'] },
          timeLimitSec: { type: 'integer' },
          basePoints: { type: 'integer' },
          position: { type: 'integer' },
          choices: { type: 'array', items: { $ref: '#/components/schemas/Choice' } },
        },
      },
      QuizSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          coverUrl: { type: ['string', 'null'] },
          isPublic: { type: 'boolean' },
          questionCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Quiz: {
        allOf: [
          { $ref: '#/components/schemas/QuizSummary' },
          {
            type: 'object',
            properties: {
              questions: { type: 'array', items: { $ref: '#/components/schemas/Question' } },
            },
          },
        ],
      },
      GameSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          quizTitle: { type: 'string' },
          code: { type: 'string', example: '482913' },
          status: { type: 'string' },
          startedAt: { type: 'string', format: 'date-time' },
          endedAt: { type: ['string', 'null'], format: 'date-time' },
          playerCount: { type: 'integer' },
        },
      },
      QuizTemplate: {
        type: 'object',
        properties: {
          slug: { type: 'string', example: 'capitales-monde' },
          title: { type: 'string' },
          description: { type: 'string' },
          questionCount: { type: 'integer' },
          previewImages: {
            type: 'array',
            items: { type: 'string', example: '/quiz-images/flags/fr.svg' },
          },
        },
      },
      PracticeQuiz: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                imageUrl: { type: ['string', 'null'] },
                timeLimitSec: { type: 'integer' },
                basePoints: { type: 'integer' },
                choices: { type: 'array', items: { $ref: '#/components/schemas/Choice' } },
                explanation: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
      GameResults: {
        type: 'object',
        properties: {
          game: { $ref: '#/components/schemas/GameSummary' },
          ranking: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rank: { type: 'integer' },
                nickname: { type: 'string' },
                score: { type: 'integer' },
                correctCount: { type: 'integer' },
                answeredCount: { type: 'integer' },
              },
            },
          },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                position: { type: 'integer' },
                text: { type: 'string' },
                answeredCount: { type: 'integer' },
                correctCount: { type: 'integer' },
                successRate: { type: 'number', minimum: 0, maximum: 1 },
                averageTimeMs: { type: ['integer', 'null'] },
              },
            },
          },
          hardestQuestionIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Santé'],
        summary: 'État du serveur et de la base de données',
        responses: {
          200: { description: 'Serveur opérationnel' },
          503: { description: 'Base indisponible' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentification'],
        summary: 'Créer un compte hôte',
        requestBody: { required: true, ...json('RegisterInput') },
        responses: {
          201: { description: 'Compte créé', ...json('AuthResponse') },
          400: errorResponse('Données invalides'),
          409: errorResponse('Email déjà utilisé'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentification'],
        summary: 'Se connecter',
        requestBody: { required: true, ...json('LoginInput') },
        responses: {
          200: { description: 'Connecté', ...json('AuthResponse') },
          401: errorResponse('Identifiants incorrects'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentification'],
        summary: "Profil de l'hôte connecté",
        security: bearer,
        responses: {
          200: { description: 'Profil', ...wrapped('user', 'User') },
          401: errorResponse('Non authentifié'),
        },
      },
    },
    '/api/quizzes': {
      get: {
        tags: ['Quiz'],
        summary: "Lister les quiz de l'hôte",
        security: bearer,
        responses: { 200: { description: 'Liste', ...wrapped('quizzes', 'QuizSummary', true) } },
      },
      post: {
        tags: ['Quiz'],
        summary: 'Créer un quiz',
        security: bearer,
        requestBody: { required: true, ...json('QuizInput') },
        responses: {
          201: { description: 'Quiz créé', ...wrapped('quiz', 'Quiz') },
          400: errorResponse('Données invalides'),
        },
      },
    },
    '/api/quizzes/{id}': {
      parameters: [idParam],
      get: {
        tags: ['Quiz'],
        summary: 'Détail d’un quiz avec ses questions',
        security: bearer,
        responses: {
          200: { description: 'Quiz', ...wrapped('quiz', 'Quiz') },
          404: errorResponse('Introuvable'),
        },
      },
      put: {
        tags: ['Quiz'],
        summary: 'Modifier un quiz',
        security: bearer,
        requestBody: { required: true, ...json('QuizInput') },
        responses: {
          200: { description: 'Quiz modifié', ...wrapped('quiz', 'Quiz') },
          403: errorResponse('Pas le propriétaire'),
          404: errorResponse('Introuvable'),
        },
      },
      delete: {
        tags: ['Quiz'],
        summary: 'Supprimer un quiz',
        security: bearer,
        responses: { 204: { description: 'Supprimé' }, 404: errorResponse('Introuvable') },
      },
    },
    '/api/quizzes/{id}/duplicate': {
      parameters: [idParam],
      post: {
        tags: ['Quiz'],
        summary: 'Dupliquer un quiz (le sien ou un quiz public)',
        security: bearer,
        responses: { 201: { description: 'Copie créée', ...wrapped('quiz', 'Quiz') } },
      },
    },
    '/api/quizzes/{id}/questions': {
      parameters: [idParam],
      post: {
        tags: ['Questions'],
        summary: 'Ajouter une question en fin de quiz',
        security: bearer,
        requestBody: { required: true, ...json('QuestionInput') },
        responses: {
          201: { description: 'Question créée', ...wrapped('question', 'Question') },
          400: errorResponse('Données invalides'),
        },
      },
    },
    '/api/quizzes/{id}/questions/reorder': {
      parameters: [idParam],
      put: {
        tags: ['Questions'],
        summary: 'Réordonner les questions (drag & drop)',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['questionIds'],
                properties: { questionIds: { type: 'array', items: { type: 'string' } } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Nouvel ordre', ...wrapped('quiz', 'Quiz') },
          400: errorResponse('Liste incomplète ou invalide'),
        },
      },
    },
    '/api/questions/{id}': {
      parameters: [idParam],
      put: {
        tags: ['Questions'],
        summary: 'Modifier une question (les réponses sont remplacées)',
        security: bearer,
        requestBody: { required: true, ...json('QuestionInput') },
        responses: {
          200: { description: 'Question modifiée', ...wrapped('question', 'Question') },
        },
      },
      delete: {
        tags: ['Questions'],
        summary: 'Supprimer une question',
        security: bearer,
        responses: { 204: { description: 'Supprimée' } },
      },
    },
    '/api/templates': {
      get: {
        tags: ['Quiz prêts à jouer'],
        summary: 'Lister les quiz prêts à jouer (drapeaux, capitales…)',
        security: bearer,
        responses: { 200: { description: 'Liste', ...wrapped('templates', 'QuizTemplate', true) } },
      },
    },
    '/api/templates/{slug}/import': {
      parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        tags: ['Quiz prêts à jouer'],
        summary: 'Ajouter une copie du quiz (pays tirés au hasard) à ses quiz',
        security: bearer,
        responses: {
          201: { description: 'Quiz créé', ...wrapped('quiz', 'Quiz') },
          404: errorResponse('Modèle introuvable'),
        },
      },
    },
    '/api/practice/templates': {
      get: {
        tags: ['Entraînement solo'],
        summary: 'Quiz disponibles pour s’entraîner seul (sans compte)',
        responses: { 200: { description: 'Liste', ...wrapped('templates', 'QuizTemplate', true) } },
      },
    },
    '/api/practice/templates/{slug}': {
      parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Entraînement solo'],
        summary: 'Tirer une série de questions avec réponses et explications (sans compte)',
        responses: {
          200: { description: 'Série de questions', ...wrapped('practice', 'PracticeQuiz') },
          404: errorResponse('Quiz introuvable'),
        },
      },
    },
    '/api/games': {
      get: {
        tags: ['Parties'],
        summary: 'Historique des parties terminées',
        security: bearer,
        responses: { 200: { description: 'Liste', ...wrapped('games', 'GameSummary', true) } },
      },
    },
    '/api/games/{id}/results': {
      parameters: [idParam],
      get: {
        tags: ['Parties'],
        summary: 'Résultats et statistiques d’une partie',
        security: bearer,
        responses: {
          200: { description: 'Résultats', ...wrapped('results', 'GameResults') },
          404: errorResponse('Introuvable'),
          409: errorResponse('Partie non terminée'),
        },
      },
    },
    '/api/games/{id}/results.csv': {
      parameters: [idParam],
      get: {
        tags: ['Parties'],
        summary: 'Export CSV des résultats',
        security: bearer,
        responses: {
          200: {
            description: 'Fichier CSV',
            content: { 'text/csv': { schema: { type: 'string' } } },
          },
        },
      },
    },
  },
};
