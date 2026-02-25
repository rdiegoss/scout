import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for PWA configuration (task 27.1)
 * Validates: Requirements 6.2, 6.3, 6.6
 */

describe('PWA Manifest Configuration', () => {
  it('should have manifest with required icon sizes (192x192, 512x512)', async () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8',
    );
    expect(viteConfig).toContain("sizes: '192x192'");
    expect(viteConfig).toContain("sizes: '512x512'");
  });

  it('should have a maskable icon', async () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8',
    );
    expect(viteConfig).toContain("purpose: 'maskable'");
  });

  it('should have proper theme and background colors', async () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8',
    );
    expect(viteConfig).toContain("theme_color: '#4f46e5'");
    expect(viteConfig).toContain("background_color: '#ffffff'");
  });

  it('should have standalone display mode', async () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8',
    );
    expect(viteConfig).toContain("display: 'standalone'");
  });

  it('should have pt-BR language', async () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8',
    );
    expect(viteConfig).toContain("lang: 'pt-BR'");
  });

  it('should have categories defined', async () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8',
    );
    expect(viteConfig).toContain('categories:');
  });
});

describe('Workbox Caching Strategies', () => {
  it('should have StaleWhileRevalidate for API calls', async () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8',
    );
    expect(viteConfig).toContain("cacheName: 'api-cache'");
    expect(viteConfig).toContain("handler: 'StaleWhileRevalidate'");
  });

  it('should have CacheFirst for Google Fonts', async () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8',
    );
    expect(viteConfig).toContain("cacheName: 'google-fonts-cache'");
    expect(viteConfig).toContain("handler: 'CacheFirst'");
  });

  it('should have caching for images', async () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8',
    );
    expect(viteConfig).toContain("cacheName: 'images-cache'");
  });

  it('should include font file types in glob patterns', async () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8',
    );
    expect(viteConfig).toContain('woff');
    expect(viteConfig).toContain('woff2');
  });
});

describe('Theme Support (Light/Dark)', () => {
  it('should have theme.css with light and dark theme variables', () => {
    const themeCss = fs.readFileSync(
      path.resolve(__dirname, '../../client/styles/theme.css'),
      'utf-8',
    );
    expect(themeCss).toContain('prefers-color-scheme: dark');
    expect(themeCss).toContain('--color-bg-primary');
    expect(themeCss).toContain('--color-text-primary');
    expect(themeCss).toContain('--color-accent');
  });

  it('should have different values for light and dark themes', () => {
    const themeCss = fs.readFileSync(
      path.resolve(__dirname, '../../client/styles/theme.css'),
      'utf-8',
    );
    // Light theme has white background
    expect(themeCss).toContain('--color-bg-primary: #ffffff');
    // Dark theme has dark background (inside the media query)
    expect(themeCss).toContain('--color-bg-primary: #111827');
  });

  it('should have color-scheme property set', () => {
    const themeCss = fs.readFileSync(
      path.resolve(__dirname, '../../client/styles/theme.css'),
      'utf-8',
    );
    expect(themeCss).toContain('color-scheme: light dark');
  });

  it('should have dark theme-color meta tag in index.html', () => {
    const indexHtml = fs.readFileSync(
      path.resolve(__dirname, '../../../index.html'),
      'utf-8',
    );
    expect(indexHtml).toContain(
      'content="#111827" media="(prefers-color-scheme: dark)"',
    );
    expect(indexHtml).toContain(
      'content="#4f46e5" media="(prefers-color-scheme: light)"',
    );
  });
});

describe('InstallPrompt Component', () => {
  it('should be a valid React functional component', async () => {
    const module = await import('../../client/components/InstallPrompt');
    expect(module.InstallPrompt).toBeDefined();
    expect(typeof module.InstallPrompt).toBe('function');
  });

  it('should export InstallPrompt as named and default export', async () => {
    const module = await import('../../client/components/InstallPrompt');
    expect(module.InstallPrompt).toBeDefined();
    expect(module.default).toBeDefined();
    expect(module.InstallPrompt).toBe(module.default);
  });
});

describe('Service Worker Registration', () => {
  it('should import registerSW in main.tsx', () => {
    const mainTsx = fs.readFileSync(
      path.resolve(__dirname, '../../client/main.tsx'),
      'utf-8',
    );
    expect(mainTsx).toContain("import { registerSW } from 'virtual:pwa-register'");
    expect(mainTsx).toContain('registerSW(');
  });

  it('should import theme.css in main.tsx', () => {
    const mainTsx = fs.readFileSync(
      path.resolve(__dirname, '../../client/main.tsx'),
      'utf-8',
    );
    expect(mainTsx).toContain("import './styles/theme.css'");
  });

  it('should include InstallPrompt in the app', () => {
    const appTsx = fs.readFileSync(
      path.resolve(__dirname, '../../client/App.tsx'),
      'utf-8',
    );
    expect(appTsx).toContain('InstallPrompt');
  });
});
