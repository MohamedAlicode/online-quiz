import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

interface TokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign({ sub: userId } satisfies TokenPayload, env.JWT_SECRET, options);
}

/** Retourne l'identifiant de l'utilisateur, ou `null` si le jeton est invalide ou expiré. */
export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'object' && typeof payload.sub === 'string') {
      return payload.sub;
    }
    return null;
  } catch {
    return null;
  }
}
