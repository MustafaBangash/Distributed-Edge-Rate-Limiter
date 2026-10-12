import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	consumeToken,
	createTokenBucket,
} from "../src/rate-limiter/token-bucket.ts";

const policy = {
	capacity: 5,
	refillRatePerSecond: 1,
};

describe("token bucket", () => {
	it("starts with a full bucket", () => {
		assert.deepEqual(createTokenBucket(policy, 1_000), {
			tokens: 5,
			lastRefillAtMs: 1_000,
		});
	});

	it("allows an initial burst up to the bucket capacity", () => {
		let state = createTokenBucket(policy, 0);

		for (let request = 0; request < policy.capacity; request += 1) {
			const decision = consumeToken(policy, state, 0);
			assert.equal(decision.allowed, true);
			state = decision.state;
		}

		assert.equal(state.tokens, 0);
		assert.equal(consumeToken(policy, state, 0).allowed, false);
	});

	it("refills tokens according to elapsed time", () => {
		const emptyState = { tokens: 0, lastRefillAtMs: 0 };
		const decision = consumeToken(policy, emptyState, 2_000);

		assert.equal(decision.allowed, true);
		assert.equal(decision.remainingTokens, 1);
	});

	it("reports how long a rejected request should wait", () => {
		const emptyState = { tokens: 0, lastRefillAtMs: 0 };
		const decision = consumeToken(policy, emptyState, 250);

		assert.equal(decision.allowed, false);
		assert.equal(decision.remainingTokens, 0.25);
		assert.equal(decision.retryAfterSeconds, 1);
	});

	it("never refills beyond capacity", () => {
		const state = createTokenBucket(policy, 0);
		const decision = consumeToken(policy, state, 60_000);

		assert.equal(decision.allowed, true);
		assert.equal(decision.remainingTokens, 4);
	});
});
