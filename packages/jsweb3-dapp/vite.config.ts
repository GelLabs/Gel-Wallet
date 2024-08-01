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
			fileName: format => `dapp.${format}.js`, // 输出文件名
			formats: ['es', 'iife']
		}
	}
});
