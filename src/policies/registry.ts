import type { RateLimitPolicy } from "./types.ts";

export const rateLimitPolicies = [
	{
		id: "protected-api",
		method: "GET",
		path: "/api/protected",
		identity: "api-key",
		algorithm: "token-bucket",
		capacity: 1,
		refillRatePerSecond: 0.5,
	},
] as const satisfies readonly RateLimitPolicy[];
