import { DurableObject } from "cloudflare:workers";

import { matchPolicy } from "./policies/match-policy.ts";
import type { RateLimitIdentity } from "./policies/types.ts";
import {
	consumeToken,
	createTokenBucket,
	type TokenBucketPolicy,
	type TokenBucketState,
} from "./rate-limiter/token-bucket.ts";

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

function getClientIdentity(
	request: Request,
	identityType: RateLimitIdentity,
): string | null {
	switch (identityType) {
		case "api-key":
			return request.headers.get("x-api-key");
		case "ip":
			return request.headers.get("cf-connecting-ip");
		case "user":
			return null;
	}
}

async function getBucketName(
	policyId: string,
	clientIdentity: string,
): Promise<string> {
	const identityBytes = new TextEncoder().encode(clientIdentity);
	const digest = await crypto.subtle.digest("SHA-256", identityBytes);
	const identityHash = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");

	return `${policyId}:${identityHash}`;
}

function rateLimitHeaders(result: RateLimitResult): HeadersInit {
	return {
		"x-ratelimit-limit": result.limit.toString(),
		"x-ratelimit-remaining": result.remaining.toString(),
	};
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/health") {
			return jsonResponse({
				status: "ok",
				service: "distributed-edge-rate-limiter",
			});
		}

		const policy = matchPolicy(request.method, url.pathname);

		if (policy) {
			const clientIdentity = getClientIdentity(request, policy.identity);

			if (!clientIdentity) {
				return jsonResponse({ error: "Client identity is required" }, 401);
			}

			if (policy.algorithm !== "token-bucket") {
				return jsonResponse(
					{ error: "Rate-limit algorithm is not implemented" },
					501,
				);
			}

			const bucketName = await getBucketName(policy.id, clientIdentity);
			const bucket = env.RATE_LIMITER.getByName(bucketName);
			const result = await bucket.checkLimit(policy);
			const headers = new Headers(rateLimitHeaders(result));

			if (!result.allowed) {
				headers.set("retry-after", result.retryAfterSeconds.toString());

				return Response.json(
					{
						error: "Rate limit exceeded",
						retryAfterSeconds: result.retryAfterSeconds,
					},
					{ status: 429, headers },
				);
			}

			return Response.json(
				{
					message: "Request reached the protected API",
					rateLimitApplied: true,
				},
				{ headers },
			);
		}

		return jsonResponse({ error: "Not found" }, 404);
	},
} satisfies ExportedHandler<Env>;
