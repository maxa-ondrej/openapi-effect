import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [dts({ outDir: 'dist/dts', tsconfigPath: 'tsconfig.src.json' })],
	build: {
		sourcemap: true,
		lib: {
			entry: 'src/index.ts',
			name: 'openapi-effect',
			formats: ['es', 'cjs'],
		},
		rollupOptions: {
			external: ['effect', '@effect/platform', 'typescript'],
		},
	},
	test: {
		globals: true,
		setupFiles: [join(__dirname, 'setupTests.ts')],
		include: ['./test/**/*.test.ts', './src/**/*.test.ts'],
		includeSource: ['./src/**/*.ts'],
	},
	define: {
		'import.meta.vitest': 'undefined',
	},
});
