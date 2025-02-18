import type { HttpMethod } from '@effect/platform';
import { MediaType } from '@omaxa-csas/openapi-effect-sdk';
import {
	Array,
	Effect,
	Match,
	Option,
	Order,
	Record,
	String,
	Tuple,
	pipe,
} from 'effect';
import ts from 'typescript';
import { ApiDevContext, type OnOperation } from '../adapter';
import { Function, Module, Struct } from '../compiler';
import { defaultConfig } from '../config';
import { Comment, Naming } from '../override';
import type { IROperationObject, IRPathItemObject } from '../override/types';
import {
	generateRoot,
	responseNamespace,
	schemaNamespace,
	wrapOptional,
} from './schema';

type DataSchemas = {
	path: Option.Option<Record<string, ts.Expression>>;
	query: Option.Option<Record<string, ts.Expression>>;
	body: Option.Option<ts.Expression>;
	response: ts.Expression;
};

const requestNamespace = ts.factory.createIdentifier('Request');

const generateParamSchema = (
	schemas: Option.Option<Record<string, ts.Expression>>,
): Effect.Effect<ts.Expression> =>
	schemas.pipe(
		Option.map(Record.toEntries),
		Option.map(Struct.createObject),
		Option.map(Effect.map(Array.of)),
		Option.map(
			Effect.andThen(Function.createMethodCall(schemaNamespace, 'Struct')),
		),
		Option.getOrElse(() =>
			Struct.createPropertyAccess(schemaNamespace, 'Void'),
		),
	);

const createFetch =
	(isStreamed: boolean) => (data: DataSchemas) => (wrapperName: string) =>
		pipe(
			data,
			Effect.succeed,
			Effect.bind('pathSchema', ({ path }) => generateParamSchema(path)),
			Effect.bind('querySchema', ({ query }) => generateParamSchema(query)),
			Effect.bind('bodySchema', ({ body }) =>
				body.pipe(
					Option.map(Effect.succeed),
					Option.getOrElse(() =>
						Function.createMethodCall(requestNamespace, 'emptyBody')([]),
					),
				),
			),
			Effect.map(({ pathSchema, querySchema, bodySchema, response }) =>
				Array.make(
					Tuple.make('pathParamsEncoder', pathSchema),
					Tuple.make('queryParamsEncoder', querySchema),
					Tuple.make('bodyEncoder', bodySchema),
					Tuple.make('responseDecoder', response),
				),
			),
			Effect.andThen(Struct.createObject),
			Effect.map(Array.of),
			Effect.andThen(
				Function.createMethodCall(
					ts.factory.createIdentifier(wrapperName),
					isStreamed ? 'subscribe' : 'fetch',
				),
			),
		);

const mapMethod = (
	method: keyof IRPathItemObject,
): Effect.Effect<HttpMethod.HttpMethod, string> =>
	pipe(method, String.toUpperCase, (method) =>
		method === 'TRACE'
			? Effect.fail('Method TRACE not supported')
			: Effect.succeed(method),
	);

const useFetch =
	(url: string, method: HttpMethod.HttpMethod, data: DataSchemas) =>
	(fnName: string) =>
		pipe(
			data,
			Record.toEntries,
			Array.filterMap(([key, value]) =>
				Option.isOption(value) && Option.isNone(value as Option.Option<unknown>)
					? Option.some(key)
					: Option.none(),
			),
			Array.map((data) =>
				Tuple.make(data, ts.factory.createIdentifier('undefined')),
			),
			Array.append(
				Tuple.make('method', ts.factory.createStringLiteral(method)),
			),
			Array.append(Tuple.make('url', ts.factory.createStringLiteral(url))),
			Struct.createObject,
			Effect.map(Array.of),
			Effect.andThen(
				Function.createFunctionCall(ts.factory.createIdentifier(fnName)),
			),
		);

const effectMap = (
	name: string,
	inner: (name: string) => Effect.Effect<ts.Expression>,
) =>
	inner(name).pipe(
		Effect.map((node) =>
			ts.factory.createArrowFunction(
				undefined,
				undefined,
				[
					ts.factory.createParameterDeclaration(
						undefined,
						undefined,
						ts.factory.createIdentifier(name),
					),
				],
				undefined,
				undefined,
				node,
			),
		),
		Effect.map(Array.of),
		Effect.andThen(
			Function.createMethodCall(ts.factory.createIdentifier('Effect'), 'map'),
		),
	);

const combineToOperation = (
	createFetch: (wrapperName: string) => Effect.Effect<ts.Expression>,
	useFetch: (fnName: string) => Effect.Effect<ts.Expression>,
	id: string,
	provideLayers: boolean,
) =>
	Effect.Do.pipe(
		Effect.bind('wrapper', () => effectMap('wrapper', createFetch)),
		Effect.bind('fetch', () => effectMap('fetch', useFetch)),
		Effect.bind('extract', () =>
			Function.createMethodCall(
				ts.factory.createIdentifier('Wrapper'),
				provideLayers ? 'extractCallableAndProvide' : 'extractCallable',
			)(
				provideLayers
					? Array.of(ts.factory.createIdentifier('ClientLayer'))
					: Array.empty(),
			),
		),
		Effect.map(({ wrapper, fetch, extract }) =>
			ts.factory.createCallExpression(
				ts.factory.createIdentifier('Wrapper.Wrapper.pipe'),
				undefined,
				[
					wrapper,
					fetch,
					ts.factory.createIdentifier(`Effect.withLogSpan('${id}')`),
					ts.factory.createIdentifier(`Effect.withSpan('${id}')`),
					extract,
				],
			),
		),
	);

const extractParam = (
	params: Option.Option<
		NonNullable<NonNullable<IROperationObject['parameters']>['path']>
	>,
) =>
	params.pipe(
		Option.andThen((param) =>
			Record.isEmptyRecord(param) ? Option.none() : Option.some(param),
		),
		Option.andThen(
			Record.map((object) =>
				generateRoot(object.schema).pipe((node) =>
					object.required ? node : wrapOptional(node, false),
				),
			),
		),
		Option.map(Record.toEntries),
		Option.map(
			Array.map(([key, value]) =>
				value.pipe(Effect.map((value) => Tuple.make(key, value))),
			),
		),
		Option.map(Effect.all),
		Option.match({
			onSome: (value) =>
				value.pipe(
					Effect.map(Option.some),
					Effect.map(Option.map(Record.fromEntries)),
				),
			onNone: () => Effect.succeed(Option.none()),
		}),
	);

const extractPath = (operation: IROperationObject) =>
	pipe(
		operation.parameters,
		Option.fromNullable,
		Option.map((object) => object.path),
		Option.andThen(Option.fromNullable),
		extractParam,
	);

const extractQuery = (operation: IROperationObject) =>
	pipe(
		operation.parameters,
		Option.fromNullable,
		Option.map((object) => object.query),
		Option.andThen(Option.fromNullable),
		extractParam,
	);

const mapRequestEncode = Match.type<MediaType.MediaType>().pipe(
	Match.when(MediaType.MediaType.JSON, () =>
		Function.createMethodCall(requestNamespace, 'encodeJson'),
	),
	Match.when(MediaType.MediaType.Text, () =>
		Function.createMethodCall(requestNamespace, 'encodeText'),
	),
	Match.when(
		MediaType.MediaType.Plain,
		() => () => Function.createMethodCall(requestNamespace, 'plain')([]),
	),
	Match.either,
);

const wrapByMediaType =
	(mediaType: MediaType.MediaType) => (node: ts.Expression) =>
		mapRequestEncode(mediaType).pipe(
			Array.of,
			Effect.all,
			Effect.map(Array.headNonEmpty),
			Effect.andThen((createCall) => createCall([node])),
			Effect.catchAll((type) =>
				Effect.dieMessage(`Unknown media type ${type}`),
			),
		);

const extractBody = (operation: IROperationObject) =>
	pipe(
		operation.body,
		Option.fromNullable,
		Option.andThen((object) =>
			generateRoot(object.schema).pipe(
				Effect.andThen(
					pipe(object.mediaType, MediaType.parse, wrapByMediaType),
				),
			),
		),
		Option.match({
			onSome: (value) => value.pipe(Effect.map(Option.some)),
			onNone: () => Effect.succeed(Option.none()),
		}),
	);

const extractResponse = (operation: IROperationObject) =>
	pipe(
		operation.responses,
		Option.fromNullable,
		Option.andThen((responses) =>
			pipe(
				responses,
				Record.filterMap(Option.fromNullable),
				Record.toEntries,
				Array.filter(([key]) => key.startsWith('2')),
				Array.sort(Order.tuple(Order.string, Order.empty())),
				Array.head,
				Option.map(Tuple.getSecond),
				Option.orElse(() => Option.fromNullable(responses.default)),
			),
		),
		Option.map((first) =>
			Tuple.make(
				first,
				first.mediaType
					? MediaType.isStreamed(MediaType.parse(first.mediaType))
					: false,
			),
		),
		Option.map(Tuple.mapFirst((object) => generateRoot(object.schema))),
		Option.getOrElse(() =>
			Tuple.make(
				Function.createMethodCall(responseNamespace, 'empty')([]),
				false,
			),
		),
		([effect, isStreamed]) =>
			Effect.map(effect, (node) => Tuple.make(node, isStreamed)),
	);

export const operation: OnOperation = ({ operation, method, path }) =>
	Effect.gen(function* () {
		yield* Effect.logInfo(`> Processing operation ${operation.id}`);
		yield* Effect.logDebug('Operation:', operation);
		const knownMethod = yield* mapMethod(method);
		const context = yield* ApiDevContext.ApiDevContext;
		const tag = pipe(
			operation.tags,
			Option.fromNullable,
			Option.getOrElse(Array.empty),
			Array.head,
			Option.getOrElse(() => String.empty),
		);
		const id = pipe(operation.id, String.replace(/[^A-Za-z]+$/, ''));
		const fullId = pipe(id, Array.of, Array.prepend(tag), Array.join('.'));
		const name = Naming.serviceFunctionIdentifier({
			config: context.config,
			id,
			operation: operation,
			handleIllegal: true,
		});
		const [response, streamed] = yield* extractResponse(operation);
		const data = {
			path: yield* extractPath(operation),
			query: yield* extractQuery(operation),
			body: yield* extractBody(operation),
			response,
		} satisfies DataSchemas;
		const createableFetch = createFetch(streamed)(data);
		const useableFetch = useFetch(path, knownMethod, data);
		const node = yield* combineToOperation(
			createableFetch,
			useableFetch,
			fullId,
			context.plugin.provideLayers ?? defaultConfig.provideLayers,
		).pipe(Effect.andThen(Module.createConstExport(name)));

		yield* Comment.addLeadingComments({
			node,
			comments: [
				operation.description,
				'',
				operation.deprecated ? '@deprecated' : undefined,
				operation.summary ? `@summary ${operation.summary}` : undefined,
				`@method ${method}`,
				`@path ${path}`,
				...(operation.tags ?? []).map((tag) => `@tag ${tag}`),
			],
		});
		yield* context.addToNamespace(tag, node);
		yield* Effect.logInfo(`< Finished processing operation ${operation.id}`);
	});
