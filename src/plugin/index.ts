import { before } from './before';
import { schema } from './schema';
import { operation } from './operation';
import { after } from './after';
import { effectHandler } from '../adapter';

export const handler = effectHandler({
	before,
	schema,
	operation,
	after,
});
