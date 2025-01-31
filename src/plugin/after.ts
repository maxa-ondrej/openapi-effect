import { Array, Effect, Record, String, Tuple, pipe } from 'effect';
import ts from 'typescript';
import { ApiDevContext, type OnAfter } from '../adapter';
import { Function, Module, Struct } from '../compiler';

export const after: OnAfter = () =>
	ApiDevContext.ApiDevContext.pipe(
		Effect.bind('layer', () => createAppLayer()),
		Effect.bind('namespaces', () => createNamespaces()),
		Effect.tap(({ file, namespaces }) =>
			Effect.try(() => file.add(...namespaces)),
		),
		Effect.tap(() => Effect.logDebug('Finished adding operation namespaces')),
		Effect.tap(({ file, layer }) => Effect.try(() => file.add(layer))),
		Effect.tap(() => Effect.logDebug('Finished adding layers')),
		Effect.tap(({ file }) => Effect.try(() => file.write('\n'))),
		Effect.tap(() => Effect.logDebug('Finished writing file')),
		Effect.tap(() => Effect.logInfo('Done')),
	);

const createAppLayer = () =>
	ApiDevContext.ApiDevContext.pipe(
		Effect.let('baseUrl', ({ plugin }) =>
			pipe(
				plugin.baseUrl,
				String.replaceAll(/'/g, "\\'"),
				ts.factory.createStringLiteral,
				(value) => Tuple.make('baseUrl', value),
			),
		),
		Effect.bind('apiConfig', ({ baseUrl }) => Struct.createObject([baseUrl])),
		Effect.bind('apiLayer', ({ apiConfig }) =>
			Function.createMethodCall(
				ts.factory.createIdentifier('ApiConfig'),
				'layer',
			)([apiConfig]),
		),
		Effect.bind('wrapperLayer', () =>
			Struct.createPropertyAccess(
				ts.factory.createIdentifier('Wrapper'),
				'WrapperLive',
			),
		),
		Effect.bind('clientLayer', () =>
			Struct.createPropertyAccess(
				ts.factory.createIdentifier('FetchHttpClient'),
				'layer',
			),
		),
		Effect.map(({ apiLayer, wrapperLayer, clientLayer }) =>
			Array.make(apiLayer, wrapperLayer, clientLayer),
		),
		Effect.andThen(
			Function.createMethodCall(
				ts.factory.createIdentifier('Layer'),
				'mergeAll',
			),
		),
		Effect.andThen(Module.createConstExport('ClientLayer')),
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
