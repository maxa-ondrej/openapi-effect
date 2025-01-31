import type { HttpClientError } from '@effect/platform';
import { Effect, ParseResult, Schema, Stream } from 'effect';

export const decodeUintArray = (input: Uint8Array) =>
	Effect.try({
		try: () => new TextDecoder().decode(input),
		catch: (error) =>
			new ParseResult.ParseError({
				issue: new ParseResult.Unexpected(error, 'Failed to decode Uint8Array'),
			}),
	});

export const jsonParse = Schema.parseJson(Schema.Unknown).pipe(Schema.decode);

export const mapStreamToString = (
	stream: Stream.Stream<
		Uint8Array<ArrayBufferLike>,
		HttpClientError.ResponseError
	>,
) => stream.pipe(Stream.mapEffect(decodeUintArray));
