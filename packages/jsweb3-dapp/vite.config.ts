import { defineConfig } from 'vite';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
	envDir: 'env',
	plugins: [nodePolyfills()],
	build: {
		lib: {
			entry: resolve(__dirname, 'lib/index.ts'),
			name: 'dapp',
			fileName: 'dapp',
			formats: ['es', 'iife']
		}
	}
});
