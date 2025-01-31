import { Effect } from 'effect';
import ts from 'typescript';

export const createTypeExport = (name: string) => (node: ts.TypeNode) =>
	Effect.try(() =>
		ts.factory.createTypeAliasDeclaration(
			[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
			name,
			undefined,
			node,
		),
	).pipe(
		Effect.tapErrorTag('UnknownException', (error) =>
			Effect.logError('Error creating type export', error),
		),
		Effect.catchTag('UnknownException', Effect.die),
	);

export const createTypePropertyAccess =
	(property: string) => (node: ts.TypeNode) =>
		Effect.try(() =>
			ts.factory.createIndexedAccessTypeNode(
				node,
				ts.factory.createLiteralTypeNode(
					ts.factory.createStringLiteral(property),
				),
			),
		).pipe(
			Effect.tapErrorTag('UnknownException', (error) =>
				Effect.logError('Error creating type property access', error),
			),
			Effect.catchTag('UnknownException', Effect.die),
		);

export const createReturnType = (name: string) =>
	Effect.try(() =>
		ts.factory.createTypeReferenceNode(
			ts.factory.createIdentifier('ReturnType'),
			[
				ts.factory.createTypeQueryNode(
					ts.factory.createIdentifier(name),
					undefined,
				),
			],
		),
	).pipe(
		Effect.tapErrorTag('UnknownException', (error) =>
			Effect.logError('Error creating return type', error),
		),
		Effect.catchTag('UnknownException', Effect.die),
	);
