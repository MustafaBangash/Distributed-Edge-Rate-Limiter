import type { SlidingWindowPolicy } from "../rate-limiter/sliding-window.ts";
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

export type SlidingWindowRateLimitPolicy = PolicyTarget &
	SlidingWindowPolicy & {
		algorithm: "sliding-window";
	};

export type RateLimitPolicy =
	| TokenBucketRateLimitPolicy
	| SlidingWindowRateLimitPolicy;
