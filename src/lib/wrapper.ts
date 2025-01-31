import {
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

type Data<P, Q, B> = (P extends void ? object : { path: P }) &
	(Q extends void ? object : { query: Q }) &
	(B extends void ? object : { body: B });

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
	<I, R, E, C>(effect: Effect.Effect<(arg: I) => R, E, C>) =>
	(data: I) =>
		Effect.andThen(effect, (fetch) => fetch(data));

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
			Effect.let(
				'url',
				({ config, path }) =>
					config.baseUrl +
					base.url.replaceAll(/\{([^}]+\})/g, (_, key) => path[key]),
			),
			Effect.let('request', ({ url, query, body }) =>
				HttpClientRequest.make(base.method)(url).pipe(
					HttpClientRequest.setBody(body),
					HttpClientRequest.appendUrlParams(query),
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
