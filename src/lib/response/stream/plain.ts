import { Schema, Stream } from 'effect';
import type { ParseStream } from '.';

export const plain: ParseStream = (stream) =>
	stream.pipe(Stream.mapEffect(Schema.decode(Schema.Unknown)));
