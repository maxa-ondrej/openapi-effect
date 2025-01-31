import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';

describe('Dummy', () => {
	it.effect('should pass', () =>
		Effect.gen(function* () {
			yield* Effect.logDebug('Hello');
			expect(1).toBe(1);
		}),
	);
});
