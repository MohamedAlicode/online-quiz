import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('bloque au-delà de la limite puis libère après la fenêtre', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);

    expect(limiter.consume('a')).toBe(true);
    expect(limiter.consume('a')).toBe(true);
    expect(limiter.consume('a')).toBe(false);
    expect(limiter.consume('b')).toBe(true);

    now = 1000;
    expect(limiter.consume('a')).toBe(true);
  });

  it('oublie les clés inactives avec prune', () => {
    let now = 0;
    const limiter = new RateLimiter(1, 1000, () => now);
    limiter.consume('a');
    now = 5000;
    limiter.prune();
    expect(limiter.consume('a')).toBe(true);
  });
});
