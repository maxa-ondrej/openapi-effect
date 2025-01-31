import {
	Array,
	Effect,
	Match,
	Option,
	Record,
	Schema,
	Tuple,
	pipe,
} from 'effect';
import ts from 'typescript';
import { ApiDevContext, type OnSchema } from '../adapter';
import { Function, Module, Struct, Typing } from '../compiler';
import type { Types } from '../override';

export const schema: OnSchema = ({ name, schema }) =>
	ApiDevContext.ApiDevContext.pipe(
		Effect.bind('node', () =>
			pipe(
				schema,
				generateRoot,
				Effect.andThen(Function.createFunction(Array.empty())),
				Effect.andThen(Module.createConstExport(name)),
			),
		),
		Effect.bind('type', () =>
			pipe(
				Typing.createReturnType(name),
				Effect.andThen(Typing.createTypePropertyAccess('Type')),
				Effect.andThen(Typing.createTypeExport(name)),
			),
		),
		Effect.tap(({ file, node }) => Effect.try(() => file.add(node))),
		Effect.tap(({ file, type }) => Effect.try(() => file.add(type))),
	);

export const schemaNamespace = ts.factory.createIdentifier('Schema');
export const responseNamespace = ts.factory.createIdentifier('Response');

const number = Struct.createPropertyAccess(schemaNamespace, 'Number');

const int = Effect.Do.pipe(
	Effect.bind('number', () => number),
	Effect.bind('int', () =>
		Function.createMethodCall(schemaNamespace, 'int')([]),
	),
	Effect.andThen(({ number, int }) =>
		Function.createFunctionCall(int)([number]),
	),
);

export const wrapOptional = (
	value: Effect.Effect<ts.Expression, string, ApiDevContext.ApiDevContext>,
) =>
	value.pipe(
		Array.of,
		Array.append(
			Struct.createObject([
				Tuple.make('as', ts.factory.createStringLiteral('Option')),
			]),
		),
		Effect.all,
		Effect.andThen(Function.createMethodCall(schemaNamespace, 'optionalWith')),
	);

const generateRootInner = (
	schema: Types.IRSchemaObject,
): Effect.Effect<ts.Expression, string, ApiDevContext.ApiDevContext> =>
	Match.value(schema).pipe(
		Match.when({ type: 'null' }, () =>
			Struct.createPropertyAccess(schemaNamespace, 'Null'),
		),
		Match.when({ type: 'boolean' }, (data) =>
			pipe(
				data.const,
				Schema.decodeUnknownOption(Schema.Boolean),
				Option.match({
					onSome: (value) =>
						pipe(
							value ? ts.factory.createTrue() : ts.factory.createFalse(),
							Array.of,
							Function.createMethodCall(schemaNamespace, 'Literal'),
						),
					onNone: () => Struct.createPropertyAccess(schemaNamespace, 'Boolean'),
				}),
			),
		),
		Match.when({ type: 'string' }, (data) =>
			pipe(
				data.const,
				Schema.decodeUnknownOption(Schema.String),
				Option.match({
					onSome: (value) =>
						pipe(
							value,
							ts.factory.createStringLiteral,
							Array.of,
							Function.createMethodCall(schemaNamespace, 'Literal'),
						),
					onNone: () =>
						Match.value(data.format).pipe(
							Match.when('date-time', () =>
								Struct.createPropertyAccess(schemaNamespace, 'DateFromString'),
							),
							Match.when('date', () =>
								Struct.createPropertyAccess(schemaNamespace, 'DateFromString'),
							),
							Match.when('uuid', () =>
								Struct.createPropertyAccess(schemaNamespace, 'UUID'),
							),
							Match.orElse(() =>
								Struct.createPropertyAccess(schemaNamespace, 'String'),
							),
						),
				}),
			),
		),
		Match.when({ type: 'number' }, (data) =>
			pipe(
				data.const,
				Schema.decodeUnknownOption(Schema.Number),
				Option.match({
					onSome: (value) =>
						pipe(
							value,
							ts.factory.createNumericLiteral,
							Array.of,
							Function.createMethodCall(schemaNamespace, 'Literal'),
						),
					onNone: () =>
						Match.value(data.format).pipe(
							Match.when('int', () => int),
							Match.when('integer', () => int),
							Match.when('int32', () => int),
							Match.orElse(() => number),
						),
				}),
			),
		),
		Match.when({ type: 'integer' }, (data) =>
			pipe(
				data.const,
				Schema.decodeUnknownOption(Schema.Number),
				Option.match({
					onSome: (value) =>
						pipe(
							value,
							ts.factory.createNumericLiteral,
							Array.of,
							Function.createMethodCall(schemaNamespace, 'Literal'),
						),
					onNone: () => int,
				}),
			),
		),
		Match.when({ type: 'never' }, () =>
			Struct.createPropertyAccess(schemaNamespace, 'Never'),
		),
		Match.when({ type: 'unknown' }, () =>
			Struct.createPropertyAccess(schemaNamespace, 'Unknown'),
		),
		Match.when({ type: 'undefined' }, () =>
			Struct.createPropertyAccess(schemaNamespace, 'Undefined'),
		),
		Match.when({ type: 'void' }, () =>
			Struct.createPropertyAccess(schemaNamespace, 'Void'),
		),
		Match.when({ type: 'enum' }, (data) =>
			pipe(
				data.items,
				Effect.fromNullable,
				Effect.mapError(() => 'Enum must have items'),
				Effect.map(Array.map(generateRootInner)),
				Effect.andThen(Effect.all),
				Effect.andThen(Function.createMethodCall(schemaNamespace, 'Union')),
			),
		),
		Match.when({ type: 'tuple' }, ({ items }) =>
			pipe(
				items,
				Effect.fromNullable,
				Effect.mapError(() => 'Tuple must have items'),
				Effect.map(Array.map(generateRootInner)),
				Effect.andThen(Effect.all),
				Effect.andThen(Function.createMethodCall(schemaNamespace, 'Tuple')),
			),
		),
		Match.when({ type: 'array' }, ({ items }) =>
			pipe(
				items,
				Option.fromNullable,
				Option.andThen(Array.head),
				Option.getOrNull,
				Effect.fromNullable,
				Effect.mapError(() => 'Array must have 1 item'),
				Effect.andThen(generateRootInner),
				Effect.map(Array.of),
				Effect.andThen(Function.createMethodCall(schemaNamespace, 'Array')),
			),
		),
		Match.when({ type: 'object' }, ({ properties, required }) =>
			pipe(
				properties,
				Effect.fromNullable,
				Effect.map(Record.map(generateRootInner)),
				Effect.map(
					Record.map((value, name) =>
						required?.includes(name) ? value : wrapOptional(value),
					),
				),
				Effect.map(Record.toEntries),
				Effect.map(
					Array.map(([key, value]) =>
						Effect.map(value, (value) => Tuple.make(key, value)),
					),
				),
				Effect.andThen(Effect.all),
				Effect.andThen(Struct.createObject),
				Effect.map(Array.of),
				Effect.andThen(Function.createMethodCall(schemaNamespace, 'Struct')),
				Effect.catchTag('NoSuchElementException', () =>
					Function.createMethodCall(responseNamespace, 'EmptyStruct')([]),
				),
			),
		),
		Match.orElse((_) =>
			pipe(
				schema.$ref,
				Effect.fromNullable,
				Effect.andThen((ref) =>
					ApiDevContext.ApiDevContext.pipe(
						Effect.andThen((context) => context.referenceSchema(ref)),
						Effect.mapError(() => 'Schema reference not found'),
					),
				),
				Effect.map(ts.factory.createIdentifier),
				Effect.map(Function.createFunctionCall),
				Effect.andThen((fn) => fn(Array.empty())),
				Effect.catchTag('NoSuchElementException', () =>
					pipe(
						schema.logicalOperator,
						Effect.fromNullable,
						Effect.andThen((op) =>
							Match.value(op).pipe(
								Match.when('or', () =>
									Function.createMethodCall(schemaNamespace, 'Union'),
								),
								Match.when('and', () =>
									Function.createMethodCall(schemaNamespace, 'Union'),
								),
								Match.exhaustive,
								(fn) =>
									pipe(
										schema.items,
										Effect.fromNullable,
										Effect.map(Array.map(generateRootInner)),
										Effect.andThen(Effect.all),
										Effect.andThen(fn),
									),
							),
						),
					),
				),
				Effect.catchTag('NoSuchElementException', () =>
					Effect.fail(
						'Schema must have a type, be a reference or have a logical operator',
					),
				),
				Effect.tapError((msg) => Effect.logError(msg, schema)),
			),
		),
	);

export const generateRoot = (schema: Types.IRSchemaObject) =>
	generateRootInner(schema).pipe(
		Effect.withLogSpan('generateRoot'),
		Effect.withSpan('generateRoot'),
	);
