import type { Plugin } from '@hey-api/openapi-ts';

import { handler } from './plugin';
import type { Config } from './types';

export const defaultConfig: Plugin.Config<Config> = {
	_dependencies: [],
	_handler: handler,
	_handlerLegacy: () => {},
	name: 'effect',
	output: 'effect',
	baseUrl: 'localhost',
	exportFromIndex: true,
};

export const defineConfig: Plugin.DefineConfig<Config> = (config) => ({
	...defaultConfig,
	...config,
});
