import { rateLimitPolicies } from "./registry.ts";
import type { RateLimitPolicy } from "./types.ts";

export function matchPolicy(
	method: string,
	path: string,
	policies: readonly RateLimitPolicy[] = rateLimitPolicies,
): RateLimitPolicy | undefined {
	const normalizedMethod = method.toUpperCase();

	return policies.find(
		(policy) => policy.method === normalizedMethod && policy.path === path,
	);
}
