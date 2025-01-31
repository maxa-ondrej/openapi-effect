import { type Error, KeyValueStore } from '@effect/platform';
import {
	Array,
	Context,
	Effect,
	Layer,
	Option,
	type ParseResult,
	Record,
	Schema,
	String,
	pipe,
} from 'effect';
import type { NoSuchElementException } from 'effect/Cause';
import type ts from 'typescript';
import type { IRContext, IRPlugin, TSFile } from '../override/types';

export class ApiDevContext extends Context.Tag('ApiDevContext')<
	ApiDevContext,
	{
		file: TSFile;
		plugin: IRPlugin;
		config: IRContext['config'];
		createFile: (
			file: Parameters<IRContext['createFile']>[0],
		) => Effect.Effect<TSFile, CreateFileError>;
		relativePath: (
			file: TSFile,
			id: string,
		) => Effect.Effect<string, RelativeFilePathError>;
		addToNamespace: (
			tag: string,
			node: ts.Statement,
		) => Effect.Effect<void, Error.PlatformError | ParseResult.ParseError>;
		getNamespaces: () => Effect.Effect<
			Record.ReadonlyRecord<string, ReadonlyArray<ts.Statement>>,
			Error.PlatformError | ParseResult.ParseError
		>;
		referenceSchema: (
			ref: string,
		) => Effect.Effect<string, NoSuchElementException>;
	}
>() {}

export class CreateFileError {
	readonly _tag = 'CreateFileError';
	constructor(readonly error: unknown) {}
}

export class RelativeFilePathError {
	readonly _tag = 'RelativeFilePathError';
	constructor(readonly error: unknown) {}
}

const NamespacesDatabase = 'NamespacesDatabase';
const NamespacesSchema = Schema.Record({
	key: Schema.String,
	value: Schema.Array(Schema.declare((input): input is ts.Statement => true)),
});

export const layer = (context: IRContext, plugin: IRPlugin) =>
	Layer.effect(
		ApiDevContext,
		KeyValueStore.KeyValueStore.pipe(
			Effect.map((kv): ApiDevContext['Type'] => ({
				file: context.createFile({
					id: plugin.name,
					path: plugin.output,
					exportFromIndex: plugin.exportFromIndex,
				}),
				plugin,
				config: context.config,
				createFile: (file) =>
					Effect.try({
						try: () => context.createFile(file),
						catch: (error) => new CreateFileError(error),
					}),
				relativePath: (file, id) =>
					Effect.try({
						try: () => file.relativePathToFile({ context, id }),
						catch: (error) => new RelativeFilePathError(error),
					}),
				referenceSchema: (ref) =>
					pipe(
						ref,
						String.match(/^#\/components\/schemas\/(.*)/),
						Option.andThen(Array.get(1)),
						Option.getOrNull,
						Effect.fromNullable,
					),
				addToNamespace: (tag, node) =>
					Effect.Do.pipe(
						Effect.let('tag', () =>
							pipe(
								tag,
								String.trim,
								String.replaceAll(/\s/g, '-'),
								String.kebabToSnake,
								String.snakeToPascal,
							),
						),
						Effect.let('kv', () => kv),
						Effect.let('store', ({ kv }) => kv.forSchema(NamespacesSchema)),
						Effect.tap(({ store, tag }) =>
							Effect.if(store.has(NamespacesDatabase), {
								onTrue: () =>
									store.modify(NamespacesDatabase, (db) =>
										pipe(
											db,
											Record.modifyOption(tag, Array.append(node)),
											Option.getOrElse(() =>
												Record.set(db, tag, Array.of(node)),
											),
										),
									),
								onFalse: () =>
									store.set(
										NamespacesDatabase,
										Record.singleton(tag, Array.of(node)),
									),
							}),
						),
						Effect.andThen(() => Effect.void),
						Effect.provideService(KeyValueStore.KeyValueStore, kv),
					),
				getNamespaces: () =>
					Effect.succeed(kv).pipe(
						Effect.map((kv) => kv.forSchema(NamespacesSchema)),
						Effect.andThen((store) => store.get(NamespacesDatabase)),
						Effect.map(Option.getOrElse(Record.empty)),
					),
			})),
		),
	);
