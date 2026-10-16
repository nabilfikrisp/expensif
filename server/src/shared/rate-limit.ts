import { initClientIp, initRateLimit } from "@/pkg/http/rate-limit";
import type { ProxyKind } from "@/shared/proxy-ip";
import { clientIpHeaderFor } from "@/shared/proxy-ip";

export type PolicyName = "default" | "login" | "register";

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

/** Per-policy limits; keys not present keep the default policy values. */
export type RateLimitOverrides = Partial<Record<PolicyName, RateLimitPolicy>>;

export type RateLimiters = Record<PolicyName, ReturnType<typeof initRateLimit>>;
export type RateLimitMiddleware = ReturnType<typeof initRateLimit>;

const POLICIES: Record<PolicyName, RateLimitPolicy> = {
  default: { limit: 100, windowMs: 60_000 },
  login: { limit: 20, windowMs: 60_000 },
  register: { limit: 10, windowMs: 60_000 },
};

/**
 * Build one limiter per policy. Each limiter has its own in-memory store, so a
 * login request counts against both `default` and `login` (intended).
 * Overrides are merged on top; used by tests to lower limits.
 */
export function initRateLimiters(
  proxyKind: ProxyKind,
  overrides: RateLimitOverrides = {}
): RateLimiters {
  const keyGenerator = initClientIp(clientIpHeaderFor(proxyKind));
  const resolved: Record<PolicyName, RateLimitPolicy> = {
    default: { ...POLICIES.default, ...overrides.default },
    login: { ...POLICIES.login, ...overrides.login },
    register: { ...POLICIES.register, ...overrides.register },
  };

  const rateLimiters = {} as RateLimiters;
  for (const name of Object.keys(resolved) as PolicyName[]) {
    rateLimiters[name] = initRateLimit({
      limit: resolved[name].limit,
      windowMs: resolved[name].windowMs,
      keyGenerator,
    });
  }
  return rateLimiters;
}
