import { Effect } from 'effect';
import ts from 'typescript';

export const createConstExport = (name: string) => (node: ts.Expression) =>
	Effect.try(() =>
		ts.factory.createVariableStatement(
			[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
			ts.factory.createVariableDeclarationList(
				[
					ts.factory.createVariableDeclaration(
						ts.factory.createIdentifier(name),
						undefined,
						undefined,
						node,
					),
				],
				ts.NodeFlags.Const,
			),
		),
	).pipe(
		Effect.tapErrorTag('UnknownException', (error) =>
			Effect.logError('Error creating const export', error),
		),
		Effect.catchTag('UnknownException', Effect.die),
	);

export const createModule = (name: string) => (body: readonly ts.Statement[]) =>
	Effect.try(() =>
		ts.factory.createModuleDeclaration(
			[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
			ts.factory.createIdentifier(name),
			ts.factory.createModuleBlock(body),
			ts.NodeFlags.Namespace,
		),
	).pipe(
		Effect.tapErrorTag('UnknownException', (error) =>
			Effect.logError('Error creating module', error),
		),
		Effect.catchTag('UnknownException', Effect.die),
	);
