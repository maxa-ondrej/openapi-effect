import type { Plugin } from '@hey-api/openapi-ts';
import type { Config } from '../types';

type IRHandler = Parameters<Plugin.Handler<Config>>[0];
export type IRPlugin = IRHandler['plugin'];
export type IRContext = IRHandler['context'];

export type TSFile = ReturnType<IRContext['createFile']>;

export type IR = IRContext['ir'];

export type IRSchemaObject = NonNullable<
	NonNullable<IR['components']>['schemas']
>[string];

export type IRPathItemObject = NonNullable<IR['paths']>[`/${string}`];

export type IROperationObject = NonNullable<IRPathItemObject['get']>;
