import { defineConfig } from '@hey-api/openapi-ts';
import * as Effect from './src';

export default {
	...defineConfig({
		client: '@hey-api/client-fetch',
		experimentalParser: true,
		input: './openapi.json',
		output: {
			path: 'tmp/client',
			format: 'biome',
			lint: 'biome',
		},
	}),
	plugins: [
		Effect.defineConfig({
			name: 'effect',
			baseUrl: 'https://api.example.com',
		}),
	],
};
