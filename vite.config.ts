import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';
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
			// input: Object.fromEntries(
			// 	globSync('src/**/*.ts').map((file) => [
			// 		path.relative(
			// 			'src',
			// 			file.slice(0, file.length - path.extname(file).length),
			// 		),
			// 		fileURLToPath(new URL(file, import.meta.url)),
			// 	]),
			// ),
			// output: [
			// 	{
			// 		format: 'cjs',
			// 		dir: 'dist/cjs',
			// 		entryFileNames: 'src/[name].js',
			// 	},
			// 	{
			// 		format: 'esm',
			// 		dir: 'dist/esm',
			// 		entryFileNames: 'src/[name].js',
			// 	},
			// ],
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
