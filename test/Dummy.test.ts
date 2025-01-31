import { FetchHttpClient } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import { describe, expect, it } from '@effect/vitest';
import { Effect, LogLevel, Logger, Option } from 'effect';
import { ClientLayer, addPet, findPetsByStatus } from './effect.bak';

describe('Dummy', () => {
	it.effect('should pass', () =>
		Effect.gen(function* () {
			const a = yield* findPetsByStatus({
				query: {
					status: Option.some('available'),
				},
			});
			console.log(a[0].name);
			expect(false).toBeTruthy();
		}).pipe(
			Effect.provide(ClientLayer),
			Effect.provide(FetchHttpClient.layer),
			Effect.provide(NodeContext.layer),
			Effect.provide(Logger.pretty),
			Effect.provide(Logger.minimumLogLevel(LogLevel.Debug)),
		),
	);
});
