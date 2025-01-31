import { Array, Effect, Record, pipe } from 'effect';
import { ApiDevContext, type OnBefore } from '../adapter';
import type { TSFile } from '../override/types';

type Import = Parameters<TSFile['import']>[0];
type ImportDefinition = Omit<Import, 'module'>;

export const before: OnBefore = () =>
	ApiDevContext.ApiDevContext.pipe(
		Effect.bind('imports', ({ file }) =>
			pipe(
				createImports(),
				Array.map((importDefinition) =>
					Effect.try(() => file.import(importDefinition)),
				),
				Effect.all,
			),
		),
		Effect.tap(() => Effect.logInfo('Starting plugin')),
	);

const createImports = () =>
	pipe(
		Record.empty<string, Array.NonEmptyReadonlyArray<ImportDefinition>>(),
		Record.set('effect', Array.make('Effect', 'Schema', 'Layer')),
		Record.set('@effect/platform', Array.make('FetchHttpClient')),
		Record.set(
			'@majksa/openapi-effect',
			Array.make('Wrapper', 'ApiConfig', 'Request', 'Response'),
		),
		mapImports,
	);

const mapImports = (
	imports: Record<
		string,
		Array.NonEmptyReadonlyArray<string | ImportDefinition>
	>,
): Import[] =>
	pipe(
		imports,
		Record.toEntries,
		Array.map(([module, modules]) =>
			Array.map(modules, (definition) =>
				typeof definition === 'string'
					? ({ module, name: definition } satisfies Import)
					: ({ ...definition, module } satisfies Import),
			),
		),
		Array.flatten,
	);
