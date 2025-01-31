import { Effect } from 'effect';
import ts from 'typescript';
import { Object } from '.';

export const createFunctionCall =
	(method: ts.Expression) => (args: ts.Expression[]) =>
		Effect.try(() =>
			ts.factory.createCallChain(method, undefined, undefined, args),
		).pipe(
			Effect.tapErrorTag('UnknownException', (error) =>
				Effect.logError('Error creating function call', error),
			),
			Effect.catchTag('UnknownException', Effect.die),
		);

export const createMethodCall =
	(parent: ts.Expression, method: string) => (args: ts.Expression[]) =>
		Object.createPropertyAccess(parent, method).pipe(
			Effect.andThen(createFunctionCall),
			Effect.andThen((fn) => fn(args)),
		);

export const createFunction =
	(params: readonly ts.ParameterDeclaration[]) => (body: ts.ConciseBody) =>
		Effect.try(() =>
			ts.factory.createArrowFunction(
				undefined,
				undefined,
				params,
				undefined,
				undefined,
				body,
			),
		).pipe(
			Effect.tapErrorTag('UnknownException', (error) =>
				Effect.logError('Error creating const export', error),
			),
			Effect.catchTag('UnknownException', Effect.die),
		);
