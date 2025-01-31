import { Effect } from 'effect';
import ts from 'typescript';

export const createPropertyAccess = (parent: ts.Expression, property: string) =>
	Effect.try(() =>
		ts.factory.createPropertyAccessChain(parent, undefined, property),
	).pipe(
		Effect.tapErrorTag('UnknownException', (error) =>
			Effect.logError('Error creating property access', error),
		),
		Effect.catchTag('UnknownException', Effect.die),
	);

export const createObject = (
	properties: readonly (readonly [string, ts.Expression])[],
) =>
	Effect.try(() =>
		ts.factory.createObjectLiteralExpression(
			properties.map(([key, value]) =>
				ts.factory.createPropertyAssignment(key, value),
			),
			true,
		),
	).pipe(
		Effect.tapErrorTag('UnknownException', (error) =>
			Effect.logError('Error creating object', error),
		),
		Effect.catchTag('UnknownException', Effect.die),
	);
