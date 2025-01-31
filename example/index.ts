import { BunContext, BunRuntime } from '@effect/platform-bun';
import { Effect, Schedule } from 'effect';
import { Cat, ClientLayer } from './client';

const expensive = Cat.getFacts({}).pipe(
	Effect.tap(() => Effect.logInfo('fetching...')),
	Effect.cachedWithTTL('3 seconds'),
	Effect.flatten,
);

const getCatFacts = Effect.cachedWithTTL(expensive, '3 seconds');

const fetcher = (effect: Effect.Effect.Success<typeof getCatFacts>) =>
	effect.pipe(
		Effect.tap((pets) => Effect.logInfo('Facts', pets.length)),
		Effect.repeat({ schedule: Schedule.fixed('1 second'), times: 5 }),
	);

getCatFacts.pipe(
	Effect.andThen(fetcher),
	Effect.provide(ClientLayer),
	Effect.provide(BunContext.layer),
	BunRuntime.runMain,
);
