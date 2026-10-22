import type { ApiErrorBody } from '@quiz/shared';
import { useAuthStore } from '../stores/auth-store';

/** URL du serveur en production (Vercel → Render). Vide en dev : Vite proxifie /api. */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

async function send(path: string, { method = 'GET', body }: RequestOptions): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Serveur injoignable. Vérifie ta connexion puis réessaie.');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorBody | null;
    // Jeton expiré ou révoqué : on déconnecte proprement.
    if (response.status === 401 && token) useAuthStore.getState().logout();
    throw new ApiError(
      response.status,
      payload?.error.code ?? 'UNKNOWN',
      payload?.error.message ?? `Erreur ${response.status}`,
      payload?.error.details,
    );
  }
  return response;
}

/** Appel JSON typé vers l'API REST. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Télécharge un fichier protégé (ex. export CSV) en conservant l'authentification. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await send(path, {});
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Une erreur inattendue est survenue';
}
