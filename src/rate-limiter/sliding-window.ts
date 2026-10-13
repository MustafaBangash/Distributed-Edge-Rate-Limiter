export interface SlidingWindowPolicy {
	limit: number;
	windowSeconds: number;
}

export interface SlidingWindowState {
	requestTimestampsMs: number[];
}

export interface SlidingWindowDecision {
	allowed: boolean;
	remaining: number;
	retryAfterSeconds: number;
	state: SlidingWindowState;
}

export function createSlidingWindow(): SlidingWindowState {
	return { requestTimestampsMs: [] };
}

export function evaluateSlidingWindow(
	policy: SlidingWindowPolicy,
	state: SlidingWindowState,
	nowMs: number,
): SlidingWindowDecision {
	validatePolicy(policy);
	validateTimestamp(nowMs);
	validateState(state);

	const sortedTimestamps = [...state.requestTimestampsMs].sort(
		(first, second) => first - second,
	);
	const latestStoredTimestamp = sortedTimestamps.at(-1) ?? 0;
	const effectiveNowMs = Math.max(nowMs, latestStoredTimestamp);
	const windowLengthMs = policy.windowSeconds * 1_000;
	const windowStartMs = effectiveNowMs - windowLengthMs;
	const activeTimestamps = sortedTimestamps.filter(
		(timestamp) => timestamp > windowStartMs,
	);
	const allowed = activeTimestamps.length < policy.limit;
	const nextTimestamps = allowed
		? [...activeTimestamps, effectiveNowMs]
		: activeTimestamps;
	const remaining = Math.max(0, policy.limit - nextTimestamps.length);
	const retryAfterSeconds = allowed
		? 0
		: Math.max(
				1,
				Math.ceil(
					((activeTimestamps[0] ?? effectiveNowMs) + windowLengthMs -
						effectiveNowMs) /
						1_000,
				),
			);

	return {
		allowed,
		remaining,
		retryAfterSeconds,
		state: { requestTimestampsMs: nextTimestamps },
	};
}

function validatePolicy(policy: SlidingWindowPolicy): void {
	if (!Number.isInteger(policy.limit) || policy.limit < 1) {
		throw new RangeError("Sliding-window limit must be a positive integer");
	}

	if (!Number.isFinite(policy.windowSeconds) || policy.windowSeconds <= 0) {
		throw new RangeError(
			"Sliding-window duration must be greater than 0 seconds",
		);
	}
}

function validateState(state: SlidingWindowState): void {
	for (const timestamp of state.requestTimestampsMs) {
		validateTimestamp(timestamp);
	}
}

function validateTimestamp(timestampMs: number): void {
	if (!Number.isFinite(timestampMs) || timestampMs < 0) {
		throw new RangeError("Timestamp must be a non-negative finite number");
	}
}
