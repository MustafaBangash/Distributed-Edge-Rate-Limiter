export interface TokenBucketPolicy {
	capacity: number;
	refillRatePerSecond: number;
}

export interface TokenBucketState {
	tokens: number;
	lastRefillAtMs: number;
}

export interface TokenBucketDecision {
	allowed: boolean;
	remainingTokens: number;
	retryAfterSeconds: number;
	state: TokenBucketState;
}

export function createTokenBucket(
	policy: TokenBucketPolicy,
	nowMs: number,
): TokenBucketState {
	validatePolicy(policy);
	validateTimestamp(nowMs);

	return {
		tokens: policy.capacity,
		lastRefillAtMs: nowMs,
	};
}

export function consumeToken(
	policy: TokenBucketPolicy,
	state: TokenBucketState,
	nowMs: number,
): TokenBucketDecision {
	validatePolicy(policy);
	validateState(state, policy);
	validateTimestamp(nowMs);

	const effectiveNowMs = Math.max(nowMs, state.lastRefillAtMs);
	const elapsedSeconds = (effectiveNowMs - state.lastRefillAtMs) / 1_000;
	const refilledTokens = Math.min(
		policy.capacity,
		state.tokens + elapsedSeconds * policy.refillRatePerSecond,
	);
	const allowed = refilledTokens >= 1;
	const remainingTokens = allowed ? refilledTokens - 1 : refilledTokens;
	const retryAfterSeconds = allowed
		? 0
		: Math.ceil((1 - refilledTokens) / policy.refillRatePerSecond);

	return {
		allowed,
		remainingTokens,
		retryAfterSeconds,
		state: {
			tokens: remainingTokens,
			lastRefillAtMs: effectiveNowMs,
		},
	};
}

function validatePolicy(policy: TokenBucketPolicy): void {
	if (!Number.isFinite(policy.capacity) || policy.capacity < 1) {
		throw new RangeError("Token bucket capacity must be at least 1");
	}

	if (
		!Number.isFinite(policy.refillRatePerSecond) ||
		policy.refillRatePerSecond <= 0
	) {
		throw new RangeError("Token bucket refill rate must be greater than 0");
	}
}

function validateState(
	state: TokenBucketState,
	policy: TokenBucketPolicy,
): void {
	if (
		!Number.isFinite(state.tokens) ||
		state.tokens < 0 ||
		state.tokens > policy.capacity
	) {
		throw new RangeError("Token bucket state has an invalid token balance");
	}

	validateTimestamp(state.lastRefillAtMs);
}

function validateTimestamp(timestampMs: number): void {
	if (!Number.isFinite(timestampMs) || timestampMs < 0) {
		throw new RangeError("Timestamp must be a non-negative finite number");
	}
}
