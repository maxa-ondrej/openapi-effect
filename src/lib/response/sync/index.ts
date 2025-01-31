import { HttpClientError, type HttpClientResponse } from '@effect/platform';
import { Effect, Either, Match } from 'effect';
import { MediaType } from '../..';

export const parseSync = (response: HttpClientResponse.HttpClientResponse) =>
	Match.value(MediaType.getType(response)).pipe(
		Match.when(MediaType.MediaType.JSON, () => response.json),
		Match.when(MediaType.MediaType.Text, () => response.text),
		Match.when(MediaType.MediaType.Plain, () => response.json),
		Match.either,
		Either.match({
			onRight: (decode) => decode,
			onLeft: (type) =>
				Effect.if(MediaType.isStreamed(type), {
					onFalse: () =>
						Effect.fail(
							new HttpClientError.ResponseError({
								reason: 'Decode',
								request: response.request,
								response,
								description: `${type} decoding is not implemented for yet`,
							}),
						),
					onTrue: () =>
						Effect.fail(
							new HttpClientError.ResponseError({
								reason: 'Decode',
								request: response.request,
								response,
								description: `${type} decoding is not supported for synced response`,
							}),
						),
				}),
		}),
	);
