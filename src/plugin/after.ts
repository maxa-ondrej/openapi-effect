import { Array, Effect, Record, pipe } from 'effect';
import { ApiDevContext, type OnAfter } from '../adapter';
import { Module } from '../compiler';

export const after: OnAfter = () =>
	ApiDevContext.ApiDevContext.pipe(
		Effect.bind('namespaces', () => createNamespaces()),
		Effect.tap(({ file, namespaces }) =>
			Effect.try(() => file.add(...namespaces)),
		),
		Effect.tap(() => Effect.logDebug('Finished adding operation namespaces')),
		Effect.tap(({ file }) => Effect.try(() => file.write('\n'))),
		Effect.tap(() => Effect.logDebug('Finished writing file')),
		Effect.tap(() => Effect.logInfo('Done')),
	);

const createNamespaces = () =>
	ApiDevContext.ApiDevContext.pipe(
		Effect.andThen(({ getNamespaces }) => getNamespaces()),
		Effect.andThen((namespaces) =>
			pipe(
				namespaces,
				Record.toEntries,
				Array.map(([name, nodes]) => Module.createModule(name)(nodes)),
				Effect.all,
			),
		),
	);
