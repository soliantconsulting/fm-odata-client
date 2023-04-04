import {defineConfig} from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/ClarisId.ts'],
    splitting: false,
    sourcemap: true,
    clean: true,
    format: ['esm', 'cjs'],
    dts: true,
});
