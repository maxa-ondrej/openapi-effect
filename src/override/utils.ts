import { Effect } from 'effect';
import ts from 'typescript';

const printer = ts.createPrinter({
	newLine: ts.NewLineKind.LineFeed,
	removeComments: false,
});

export const createSourceFile = (sourceText: string) =>
	ts.createSourceFile(
		'',
		sourceText,
		ts.ScriptTarget.ESNext,
		false,
		ts.ScriptKind.TS,
	);

const blankSourceFile = createSourceFile('');

const unescapeUnicode = (value: string) =>
	value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
		String.fromCharCode(Number.parseInt(hex, 16)),
	);

/**
 * Print a TypeScript node to a string.
 * @param node the node to print
 * @returns string
 */
export function tsNodeToString({
	node,
	// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
	unescape = false,
}: {
	node: ts.Node;
	unescape?: boolean;
}): Effect.Effect<string> {
	const result = printer.printNode(
		ts.EmitHint.Unspecified,
		node,
		blankSourceFile,
	);

	if (!unescape) {
		return Effect.succeed(result);
	}

	try {
		/**
		 * TypeScript Compiler API escapes unicode characters by default and there
		 * is no way to disable this behavior
		 * {@link https://github.com/microsoft/TypeScript/issues/36174}
		 */
		return Effect.succeed(unescapeUnicode(result));
	} catch {
		Effect.logDebug('Could not decode value:', result);
		return Effect.succeed(result);
	}
}
