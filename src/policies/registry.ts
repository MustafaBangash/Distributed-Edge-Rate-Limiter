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
	{
		id: "sliding-window-api",
		method: "GET",
		path: "/api/sliding-window",
		identity: "api-key",
		algorithm: "sliding-window",
		limit: 3,
		windowSeconds: 10,
	},
] as const satisfies readonly RateLimitPolicy[];
