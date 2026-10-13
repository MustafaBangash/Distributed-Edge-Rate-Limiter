import type { TokenBucketPolicy } from "../rate-limiter/token-bucket.ts";

export type HttpMethod =
	| "GET"
	| "POST"
	| "PUT"
	| "PATCH"
	| "DELETE"
	| "OPTIONS"
	| "HEAD";

export type RateLimitIdentity = "api-key" | "ip" | "user";

interface PolicyTarget {
	id: string;
	method: HttpMethod;
	path: string;
	identity: RateLimitIdentity;
}

export type TokenBucketRateLimitPolicy = PolicyTarget &
	TokenBucketPolicy & {
		algorithm: "token-bucket";
	};

export type SlidingWindowRateLimitPolicy = PolicyTarget & {
	algorithm: "sliding-window";
	limit: number;
	windowSeconds: number;
};

export type RateLimitPolicy =
	| TokenBucketRateLimitPolicy
	| SlidingWindowRateLimitPolicy;
