import { defineConfig } from '@hey-api/openapi-ts';
import * as Effect from '@majksa/openapi-effect';

export default {
	...defineConfig({
		experimentalParser: true,
		input: './openapi.json',
		output: {
			path: './client',
			format: 'biome',
			lint: 'biome',
		},
		logs: {
			level: 'debug',
			path: './logs',
		},
	}),
	plugins: [
		Effect.defineConfig({
			name: 'effect',
			baseUrl: 'https://cat-fact.herokuapp.com',
		}),
	],
};
