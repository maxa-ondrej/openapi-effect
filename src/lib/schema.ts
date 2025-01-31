import {
	Array,
	Either,
	Match,
	ParseResult,
	Record,
	Schema,
	pipe,
} from 'effect';

export const ParseString = (value: unknown): string =>
	Match.value(value).pipe(
		Match.when(Match.string, (string) => string),
		Match.orElse((value) => `${value}`),
	);

export const ParseArrayOfStrings = (value: unknown[]): string =>
	pipe(value, Array.map(ParseString), Array.join(','));

export const ParseRecordOfStrings = (
	record: Record<string | symbol, unknown>,
): Record<string, string> =>
	Record.map(record, (value) =>
		Match.value(value).pipe(
			Match.when(Array.isArray, ParseArrayOfStrings),
			Match.orElse(ParseString),
		),
	);

export const matchRecordFromUnknown = Match.type<unknown>().pipe(
	Match.when(Match.null, () => ({})),
	Match.when(Match.undefined, () => ({})),
	Match.when(Match.record, (record) => ParseRecordOfStrings(record)),
	Match.either,
);

export const RecordFrom = <A, I>(schema: Schema.Schema<A, I>) =>
	Schema.transformOrFail(
		Schema.Record({ key: Schema.String, value: Schema.String }),
		schema,
		{
			strict: true,
			decode: (input, _options, ast) =>
				ParseResult.fail(
					new ParseResult.Type(ast, input, 'Decode is not implemented'),
				),
			encode: (toI, _options, ast) =>
				matchRecordFromUnknown(toI).pipe(
					Either.mapLeft((error) => new ParseResult.Type(ast, toI, `${error}`)),
				),
		},
	);
