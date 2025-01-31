import { KeyValueStore } from '@effect/platform';
import type { Plugin } from '@hey-api/openapi-ts';
import { Effect, Layer, LogLevel, Logger, ManagedRuntime, Match } from 'effect';
import type { IRContext } from '../override/types';
import type { Config } from '../types';
import * as ApiDevContext from './context';
import type { EffectHandler } from './handler';

export { ApiDevContext };
export type * from './handler';

export const effectHandler =
	(handler: EffectHandler): Plugin.Handler<Config> =>
	({ context, plugin }) => {
		const ctx = ApiDevContext.layer(context, plugin);
		const logLevel = detectLogLevel(context.config.logs.level);
		const appLayer = Layer.mergeAll(
			Logger.pretty,
			Logger.minimumLogLevel(logLevel),
			Layer.provide(ctx, KeyValueStore.layerMemory),
		);
		const runtime = ManagedRuntime.make(appLayer);

		const run = (
			effect: Effect.Effect<void, unknown, ApiDevContext.ApiDevContext>,
		) => effect.pipe(Effect.catchAll(Effect.die), runtime.runSync);

		context.subscribe('before', () =>
			handler
				.before()
				.pipe(Effect.withSpan('before'), Effect.withLogSpan('before'), run),
		);
		context.subscribe('operation', (data) =>
			handler
				.operation(data)
				.pipe(
					Effect.withSpan('operation'),
					Effect.withLogSpan('operation'),
					run,
				),
		);
		context.subscribe('schema', (data) =>
			handler
				.schema(data)
				.pipe(Effect.withSpan('schema'), Effect.withLogSpan('schema'), run),
		);
		context.subscribe('after', () =>
			handler
				.after()
				.pipe(Effect.withSpan('after'), Effect.withLogSpan('after'), run),
		);
	};

const detectLogLevel = Match.type<IRContext['config']['logs']['level']>().pipe(
	Match.when('silent', () => LogLevel.None),
	Match.when('trace', () => LogLevel.Trace),
	Match.when('debug', () => LogLevel.Debug),
	Match.when('info', () => LogLevel.Info),
	Match.when('warn', () => LogLevel.Warning),
	Match.when('error', () => LogLevel.Error),
	Match.when('fatal', () => LogLevel.Fatal),
	Match.exhaustive,
);
