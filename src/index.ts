import { DurableObject } from "cloudflare:workers";

import {
	consumeToken,
	createTokenBucket,
	type TokenBucketPolicy,
	type TokenBucketState,
} from "./rate-limiter/token-bucket";

export interface RateLimitResult {
	allowed: boolean;
	limit: number;
	remaining: number;
	retryAfterSeconds: number;
}

export class RateLimitBucket extends DurableObject<Env> {
	checkLimit(policy: TokenBucketPolicy): RateLimitResult {
		const nowMs = Date.now();
		const storedState = this.ctx.storage.kv.get<TokenBucketState>("bucket");
		const state = storedState
			? {
					tokens: Math.min(storedState.tokens, policy.capacity),
					lastRefillAtMs: storedState.lastRefillAtMs,
				}
			: createTokenBucket(policy, nowMs);
		const decision = consumeToken(policy, state, nowMs);

		this.ctx.storage.kv.put("bucket", decision.state);

		return {
			allowed: decision.allowed,
			limit: policy.capacity,
			remaining: Math.floor(decision.remainingTokens),
			retryAfterSeconds: decision.retryAfterSeconds,
		};
	}
}

function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

export default {
	async fetch(request): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/health") {
			return jsonResponse({
				status: "ok",
				service: "distributed-edge-rate-limiter",
			});
		}

		if (request.method === "GET" && url.pathname === "/api/protected") {
			return jsonResponse({
				message: "Request reached the protected API",
				rateLimitApplied: false,
			});
		}

		return jsonResponse({ error: "Not found" }, 404);
	},
} satisfies ExportedHandler<Env>;
