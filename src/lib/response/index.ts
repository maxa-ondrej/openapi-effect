import { Schema } from 'effect';

export { paginate, createPaginator } from './pagination';
export { parseSync } from './sync';
export { parseStream } from './stream';

export const EmptyStruct = (tag: string = 'EmptyStruct') =>
	Schema.Struct({
		_tag: Schema.Literal(tag).pipe(
			Schema.optional,
			Schema.withDefaults({
				constructor: () => tag,
				decoding: () => tag,
			}),
		),
	});

export const empty = () =>
	Schema.transform(Schema.Unknown, Schema.Void, {
		strict: true,
		encode: (input) => input,
		decode: () => undefined,
	}).pipe(Schema.asSchema);
