import ts from 'typescript';
import { tsNodeToString } from './utils';
import { Effect } from 'effect';

type CommentLines = Array<string | null | false | undefined>;

type CommentObject = {
	jsdoc?: boolean;
	lines: CommentLines;
};

export type Comments = CommentLines | Array<CommentObject>;

const processCommentObject = ({
	commentObject,
	node,
}: {
	commentObject: CommentObject;
	node: ts.Node;
}): Effect.Effect<void> =>
	Effect.gen(function* () {
		const lines = commentObject.lines.filter(
			(line) => Boolean(line) || line === '',
		) as string[];
		if (!lines.length) {
			return;
		}

		if (!commentObject.jsdoc) {
			for (const line of lines) {
				ts.addSyntheticLeadingComment(
					node,
					ts.SyntaxKind.SingleLineCommentTrivia,
					` ${line}`,
					true,
				);
			}
			return;
		}

		const jsdocTexts = lines.map((line, index) => {
			let text = line;
			if (index !== lines.length) {
				text = `${text}\n`;
			}
			const jsdocText = ts.factory.createJSDocText(text);
			return jsdocText;
		});

		const jsdoc = ts.factory.createJSDocComment(
			ts.factory.createNodeArray(jsdocTexts),
			undefined,
		);

		const cleanedJsdoc = (yield* tsNodeToString({
			node: jsdoc,
			unescape: true,
		}))
			.replace('/*', '')
			.replace('*  */', '');

		ts.addSyntheticLeadingComment(
			node,
			ts.SyntaxKind.MultiLineCommentTrivia,
			cleanedJsdoc,
			true,
		);
	});

export const addLeadingComments = ({
	comments = [],
	node,
}: {
	comments?: Comments;
	node: ts.Node;
}): Effect.Effect<void> =>
	Effect.gen(function* () {
		const isObjectStyle = Boolean(
			comments.find((comment) => typeof comment === 'object' && comment),
		);

		let commentObjects = comments as Array<CommentObject>;
		if (!isObjectStyle) {
			commentObjects = [
				{
					jsdoc: true,
					lines: comments as CommentLines,
				},
			];
		}

		for (const commentObject of commentObjects) {
			yield* processCommentObject({
				commentObject,
				node,
			});
		}
	});
