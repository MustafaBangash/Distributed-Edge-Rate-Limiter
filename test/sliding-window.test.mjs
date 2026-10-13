import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	createSlidingWindow,
	evaluateSlidingWindow,
} from "../src/rate-limiter/sliding-window.ts";

const policy = {
	limit: 3,
	windowSeconds: 10,
};

describe("sliding window", () => {
	it("starts with no recorded requests", () => {
		assert.deepEqual(createSlidingWindow(), { requestTimestampsMs: [] });
	});

	it("allows requests up to the configured limit", () => {
		let state = createSlidingWindow();

		for (const timestamp of [1_000, 2_000, 3_000]) {
			const decision = evaluateSlidingWindow(policy, state, timestamp);
			assert.equal(decision.allowed, true);
			state = decision.state;
		}

		assert.equal(state.requestTimestampsMs.length, 3);
		assert.equal(evaluateSlidingWindow(policy, state, 4_000).allowed, false);
	});

	it("calculates when the oldest request will leave the window", () => {
		const state = { requestTimestampsMs: [1_000, 2_000, 3_000] };
		const decision = evaluateSlidingWindow(policy, state, 4_000);

		assert.equal(decision.allowed, false);
		assert.equal(decision.remaining, 0);
		assert.equal(decision.retryAfterSeconds, 7);
	});

	it("removes requests that have left the window", () => {
		const state = { requestTimestampsMs: [1_000, 2_000, 3_000] };
		const decision = evaluateSlidingWindow(policy, state, 11_000);

		assert.equal(decision.allowed, true);
		assert.equal(decision.remaining, 0);
		assert.deepEqual(decision.state.requestTimestampsMs, [2_000, 3_000, 11_000]);
	});

	it("keeps different moving windows independent of fixed clock boundaries", () => {
		const firstState = evaluateSlidingWindow(
			policy,
			{ requestTimestampsMs: [9_000, 10_000] },
			11_000,
		).state;
		const decision = evaluateSlidingWindow(policy, firstState, 19_000);

		assert.equal(decision.allowed, true);
		assert.deepEqual(decision.state.requestTimestampsMs, [10_000, 11_000, 19_000]);
	});

	it("rejects invalid policies", () => {
		assert.throws(
			() =>
				evaluateSlidingWindow(
					{ limit: 0, windowSeconds: 10 },
					createSlidingWindow(),
					0,
				),
			RangeError,
		);
	});
});
