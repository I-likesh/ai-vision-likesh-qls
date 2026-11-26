export const OFFLINE_PROJECT_LOADERS = import.meta.glob(
  [
    '/src/**/*.ts',
    '/src/**/*.tsx',
    '/src/**/*.css',
    '/index.html',
    '/package.json',
    '/tsconfig.json',
    '/vite.config.ts',
    '/metadata.json',
    '/.env.example',
  ],
  { query: '?raw', import: 'default' }
) as Record<string, () => Promise<string>>;
