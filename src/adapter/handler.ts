import type { Effect } from 'effect';
import type {
	IROperationObject,
	IRPathItemObject,
	IRSchemaObject,
} from '../override/types';
import type { ApiDevContext } from './context';

export type OnBefore = () => Effect.Effect<void, unknown, ApiDevContext>;
export type OnOperation = (operation: {
	method: keyof IRPathItemObject;
	operation: IROperationObject;
	path: string;
}) => Effect.Effect<void, unknown, ApiDevContext>;
export type OnSchema = (schema: {
	$ref: string;
	name: string;
	schema: IRSchemaObject;
}) => Effect.Effect<void, unknown, ApiDevContext>;
export type OnAfter = () => Effect.Effect<void, unknown, ApiDevContext>;

export type EffectHandler = Readonly<{
	before: OnBefore;
	schema: OnSchema;
	operation: OnOperation;
	after: OnAfter;
}>;
