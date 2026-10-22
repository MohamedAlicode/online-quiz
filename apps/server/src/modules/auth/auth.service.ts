import type { AuthResponse, LoginInput, RegisterInput, UserDto } from '@quiz/shared';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { HttpError } from '../../lib/http-error';
import { signToken } from '../../lib/jwt';
import { prisma } from '../../lib/prisma';

interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

// Hash factice : on compare toujours un mot de passe, même si l'email n'existe pas,
// pour que le temps de réponse ne révèle pas quels comptes existent.
const DUMMY_HASH = bcrypt.hashSync('mot-de-passe-factice', 4);

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw HttpError.conflict('Un compte existe déjà avec cet email');
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: input.email, displayName: input.displayName, passwordHash },
  });

  return { token: signToken(user.id), user: toUserDto(user) };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    // Message volontairement identique dans les deux cas.
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect');
  }

  return { token: signToken(user.id), user: toUserDto(user) };
}

export async function getMe(userId: string): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw HttpError.unauthorized('Compte introuvable');
  }
  return toUserDto(user);
}
