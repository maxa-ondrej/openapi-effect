import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [dts({ outDir: 'dist/dts', tsconfigPath: 'tsconfig.src.json' })],
	build: {
		outDir: 'dist',
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			formats: ['cjs', 'es'],
			name: 'openapi-effect',
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
