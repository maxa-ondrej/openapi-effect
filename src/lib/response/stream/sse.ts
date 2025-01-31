import { Array, Effect, Stream, String, Tuple, pipe } from 'effect';
import type { ParseStream } from '.';
import { jsonParse, mapStreamToString } from '../util';

export const sse: ParseStream = (stream) =>
	stream.pipe(mapStreamToString, SSESink(jsonParse));

const SSESink =
	<E1>(parse: (raw: string) => Effect.Effect<unknown, E1>) =>
	<E2>(stream: Stream.Stream<string, E2>) =>
		stream.pipe(
			Stream.mapAccumEffect('', (acc, chunk) =>
				pipe(
					chunk,
					String.split('\n\n'),
					Effect.succeed,
					Effect.bindTo('messages'),
					Effect.let('chunk', ({ messages }) => Array.initNonEmpty(messages)),
					Effect.let('last', ({ messages }) => Array.lastNonEmpty(messages)),
					Effect.andThen(({ chunk, last }) =>
						pipe(
							chunk,
							Array.map((message, i) =>
								i === 0 ? `${acc}${message}` : message,
							),
							(messages) => Tuple.make(last, messages),
						),
					),
				),
			),
			Stream.mapConcat((messages) => messages),
			Stream.map(String.replace(/^\s*data:\s*/, '')),
			Stream.mapEffect(parse),
		);
