import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (!id.includes('node_modules'))
                        return undefined;
                    if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
                        return 'react-vendor';
                    }
                    if (id.includes('/@radix-ui/')) {
                        return 'radix-vendor';
                    }
                    if (id.includes('/lucide-react/')) {
                        return 'icon-vendor';
                    }
                    if (id.includes('/zustand/')
                        || id.includes('/clsx/')
                        || id.includes('/tailwind-merge/')
                        || id.includes('/class-variance-authority/')) {
                        return 'ui-vendor';
                    }
                    return 'vendor';
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
    },
});
