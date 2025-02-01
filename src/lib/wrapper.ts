import {
	Headers,
	type HttpBody,
	HttpClient,
	type HttpClientError,
	HttpClientRequest,
	type HttpMethod,
} from '@effect/platform';
import {
	Context,
	Effect,
	Layer,
	Option,
	type ParseResult,
	type Record,
	Ref,
	Schema,
	Stream,
	pipe,
} from 'effect';
import { Config } from './config';
import { parseStream, parseSync } from './response';
import { RecordFrom } from './schema';

type BaseData<P, Q, B> = {
	method: HttpMethod.HttpMethod;
	url: string;
} & (P extends void ? { path: P } : object) &
	(Q extends void ? { query: Q } : object) &
	(B extends void ? { body: B } : object);

type Data<P, Q, B> = {
	readonly headers?: Headers.Input;
} & (P extends void ? object : { readonly path: P }) &
	(Q extends void ? object : { readonly query: Q }) &
	(B extends void ? object : { readonly body: B });

type Schemas<Path, Query, Body, P, Q, Response, R> = {
	pathParamsEncoder: Schema.Schema<Path, P>;
	queryParamsEncoder: Schema.Schema<Query, Q>;
	bodyEncoder: Schema.Schema<Body, HttpBody.HttpBody>;
	responseDecoder: Schema.Schema<Response, R>;
};

export class Wrapper extends Context.Tag('ApiClientEffectWrapper')<
	Wrapper,
	{
		fetch: <Path, Query, Body, P, Q, Response, R>(
			schemas: Schemas<Path, Query, Body, P, Q, Response, R>,
		) => (
			data: BaseData<Path, Query, Body>,
		) => (
			data: Data<Path, Query, Body>,
		) => Effect.Effect<
			Response,
			| HttpBody.HttpBodyError
			| HttpClientError.HttpClientError
			| ParseResult.ParseError,
			HttpClient.HttpClient | Config
		>;
		subscribe: <Path, Query, Body, P, Q, Response, R>(
			schemas: Schemas<Path, Query, Body, P, Q, Response, R>,
		) => (
			base: BaseData<Path, Query, Body>,
		) => (
			data: Data<Path, Query, Body>,
		) => Effect.Effect<
			Stream.Stream<
				Response,
				HttpClientError.ResponseError | ParseResult.ParseError
			>,
			| HttpBody.HttpBodyError
			| HttpClientError.HttpClientError
			| ParseResult.ParseError,
			HttpClient.HttpClient | Config
		>;
	}
>() {}

export const extractCallable =
	() =>
	<I, T, E1, E2, R1, R2>(
		effect: Effect.Effect<(arg: I) => Effect.Effect<T, E1, R1>, E2, R2>,
	) =>
	(data: I): Effect.Effect<T, E1 | E2, R1 | R2> =>
		effect.pipe(Effect.andThen((fetch) => fetch(data)));

export const extractCallableAndProvide =
	<R>(layers: Layer.Layer<R>) =>
	<I, T, E1, E2, R1 extends R, R2 extends R>(
		effect: Effect.Effect<(arg: I) => Effect.Effect<T, E1, R1>, E2, R2>,
	) =>
	(data: I): Effect.Effect<T, E1 | E2> =>
		effect.pipe(
			Effect.andThen((fetch) => fetch(data)),
			Effect.provide(layers),
		);

const createPathFromTemplate = (
	template: string,
	params: Record.ReadonlyRecord<string, string>,
) =>
	pipe(template, (template) =>
		template.replaceAll(/\{([^}]+)\}/g, (_, key) =>
			key in params ? params[key] : `{${key}}`,
		),
	);

if (import.meta.vitest) {
	const { it, expect } = import.meta.vitest;
	it('extract callable', () => {
		expect(createPathFromTemplate('/hello', {})).toBe('/hello');
		expect(
			createPathFromTemplate('/hello/{abc}', {
				abc: '123',
			}),
		).toBe('/hello/123');
		expect(
			createPathFromTemplate('/hello/{abc}/{def}', {
				abc: '123',
				def: '456',
			}),
		).toBe('/hello/123/456');
		expect(
			createPathFromTemplate('/hello/{abc}/{abc}', {
				abc: '123',
			}),
		).toBe('/hello/123/123');
		expect(
			createPathFromTemplate('/hello/{abc}/{def}', {
				abc: '123',
			}),
		).toBe('/hello/123/{def}');
		expect(
			createPathFromTemplate('/hello/{abc}', {
				def: '123',
			}),
		).toBe('/hello/{abc}');
	});
}

const executeRequest =
	<Path, Query, Body, P, Q, Response, R>({
		bodyEncoder,
		pathParamsEncoder,
		queryParamsEncoder,
	}: Schemas<Path, Query, Body, P, Q, Response, R>) =>
	(base: BaseData<Path, Query, Body>) =>
	(data: Data<Path, Query, Body>) =>
		HttpClient.HttpClient.pipe(
			Effect.bindTo('client'),
			Effect.bind('config', () => Config.pipe(Effect.andThen(Ref.get))),
			Effect.tap(({ config }) => Effect.logDebug('⚙️ Api Config', config)),
			Effect.bind('path', () =>
				pipe(
					Option.fromNullable('path' in data ? data.path : null),
					Option.getOrNull,
					(path) => path as Schema.Schema.Type<typeof pathParamsEncoder>,
					Schema.encode(RecordFrom(pathParamsEncoder)),
				),
			),
			Effect.bind('query', () =>
				pipe(
					Option.fromNullable('query' in data ? data.query : null),
					Option.getOrNull,
					(query) => query as Schema.Schema.Type<typeof queryParamsEncoder>,
					Schema.encode(RecordFrom(queryParamsEncoder)),
				),
			),
			Effect.bind('body', () =>
				pipe(
					Option.fromNullable('body' in data ? data.body : null),
					Option.getOrNull,
					(body) => body as Schema.Schema.Type<typeof bodyEncoder>,
					Schema.encode(bodyEncoder),
				),
			),
			Effect.let('url', ({ config, path }) =>
				createPathFromTemplate(config.baseUrl + base.url, path),
			),
			Effect.let('request', ({ url, query, body, config }) =>
				HttpClientRequest.make(base.method)(url).pipe(
					HttpClientRequest.setBody(body),
					HttpClientRequest.appendUrlParams(query),
					HttpClientRequest.setHeaders(
						Headers.merge(
							Headers.fromInput(config.headers),
							Headers.fromInput(data.headers),
						),
					),
				),
			),
			Effect.andThen(({ client, request }) => client.execute(request)),
		);

export const WrapperLive = Layer.succeed(
	Wrapper,
	Wrapper.of({
		fetch: (schemas) => (base) => (data) =>
			executeRequest(schemas)(base)(data).pipe(
				Effect.andThen(parseSync),
				Effect.andThen((response) =>
					pipe(response, Schema.decodeUnknown(schemas.responseDecoder)),
				),
				Effect.scoped,
			),
		subscribe: (schemas) => (base) => (data) =>
			executeRequest(schemas)(base)(data).pipe(
				Effect.andThen(parseStream),
				Effect.map((response) =>
					Stream.mapEffect(
						response,
						Schema.decodeUnknown(schemas.responseDecoder),
					),
				),
				Effect.scoped,
			),
	}),
);
