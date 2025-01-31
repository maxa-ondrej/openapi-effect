import { HttpClientError, type HttpClientResponse } from '@effect/platform';
import { Effect, Either, Match, type ParseResult, type Stream } from 'effect';
import { MediaType } from '../..';
import { plain } from './plain';
import { sse } from './sse';

export type ParseStream = (
	stream: Stream.Stream<
		Uint8Array<ArrayBufferLike>,
		HttpClientError.ResponseError
	>,
) => Stream.Stream<
	unknown,
	HttpClientError.ResponseError | ParseResult.ParseError
>;

export const parseStream = (response: HttpClientResponse.HttpClientResponse) =>
	Match.value(MediaType.getType(response)).pipe(
		Match.when(MediaType.MediaType.SSE, () => sse(response.stream)),
		Match.when(MediaType.MediaType.Plain, () => plain(response.stream)),
		Match.either,
		Either.match({
			onRight: Effect.succeed,
			onLeft: (type) =>
				Effect.if(MediaType.isStreamed(type), {
					onTrue: () =>
						Effect.fail(
							new HttpClientError.ResponseError({
								reason: 'Decode',
								request: response.request,
								response,
								description: `${type} decoding is not implemented for yet`,
							}),
						),
					onFalse: () =>
						Effect.fail(
							new HttpClientError.ResponseError({
								reason: 'Decode',
								request: response.request,
								response,
								description: `${type} decoding is not supported for streamed response`,
							}),
						),
				}),
		}),
	);
