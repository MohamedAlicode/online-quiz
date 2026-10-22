import { z } from 'zod';
import { LIMITS } from '../constants';

/** Nettoie l'email (espaces, majuscules) AVANT de valider son format. */
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Adresse email invalide'));

export const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(LIMITS.passwordMin, `Le mot de passe doit faire au moins ${LIMITS.passwordMin} caractères`)
    .max(128, 'Mot de passe trop long'),
  displayName: z.string().trim().min(2, 'Nom trop court').max(40, 'Nom trop long'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
