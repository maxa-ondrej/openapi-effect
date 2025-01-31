import { HttpBody } from '@effect/platform';
import { Effect, Match, ParseResult, Schema, Stream, pipe } from 'effect';

export const emptyBody = () =>
	Schema.transformOrFail(Schema.declare(HttpBody.isHttpBody), Schema.Void, {
		strict: true,
		decode: (input, _options, ast) =>
			ParseResult.fail(
				new ParseResult.Forbidden(ast, input, 'Decode is not implemented'),
			),
		encode: () => ParseResult.succeed(HttpBody.empty),
	});

const StreamSchema = Schema.declare(
	(value: unknown): value is Stream.Stream<Uint8Array, unknown> =>
		typeof value === 'object' && value !== null && Stream.StreamTypeId in value,
);

const PlainSchema = Schema.Union(
	Schema.String,
	Schema.Uint8Array,
	StreamSchema,
);

export const plain = (options?: {
	readonly contentType?: string | undefined;
	readonly contentLength?: number | undefined;
}) =>
	Schema.transformOrFail(Schema.declare(HttpBody.isHttpBody), PlainSchema, {
		strict: true,
		decode: (input, _options, ast) =>
			ParseResult.fail(
				new ParseResult.Forbidden(ast, input, 'Decode is not implemented'),
			),
		encode: (_toI, _options, _ast, input) =>
			Match.value(input).pipe(
				Match.when(Match.string, (value) =>
					HttpBody.text(value, options?.contentType),
				),
				Match.when(Schema.is(Schema.Uint8Array), (value) =>
					HttpBody.uint8Array(value),
				),
				Match.orElse((value) =>
					HttpBody.stream(value, options?.contentType, options?.contentLength),
				),
				Effect.succeed,
			),
	});

export const encodeJson = <A, I>(schema: Schema.Schema<A, I>) =>
	Schema.transformOrFail(Schema.declare(HttpBody.isHttpBody), schema, {
		strict: true,
		decode: (input, _options, ast) =>
			ParseResult.fail(
				new ParseResult.Forbidden(ast, input, 'Decode is not implemented'),
			),
		encode: (_toI, _options, ast, input) =>
			pipe(
				HttpBody.jsonSchema(schema),
				(encode) => encode(input),
				Effect.mapError(
					(error) => new ParseResult.Forbidden(ast, input, `${error}`),
				),
			),
	});
