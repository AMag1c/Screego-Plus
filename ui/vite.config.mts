import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
    base: './',
    server: {
        host: '127.0.0.1',
        port: 9100,
        open: false,
        proxy: {
            '^/(config|logout|login|stream|rooms)$': {
                target: 'http://localhost:9101',
                ws: true,
            },
        },
    },
    build: {outDir: 'build/'},
    plugins: [react()],
});
