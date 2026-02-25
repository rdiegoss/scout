import type { ServiceProvider } from '@shared/types';

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

export interface ShareResult {
  success: boolean;
  method: 'webshare' | 'clipboard' | 'none';
  error?: string;
}

export function buildServiceUrl(serviceId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://app.example.com');
  return `${base}/service/${serviceId}`;
}

export function formatCategoryName(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildShareData(service: ServiceProvider, baseUrl?: string): ShareData {
  const categoryDisplay = formatCategoryName(service.category);
  const url = buildServiceUrl(service.id, baseUrl);

  const text = [
    `Recomendo: ${service.name}`,
    `Categoria: ${categoryDisplay}`,
    `Telefone: ${service.phone}`,
    url,
  ].join('\n');

  return {
    title: `Indicação: ${service.name}`,
    text,
    url,
  };
}

export function isWebShareAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function shareService(service: ServiceProvider, baseUrl?: string): Promise<ShareResult> {
  const data = buildShareData(service, baseUrl);

  if (isWebShareAvailable()) {
    try {
      await navigator.share({ title: data.title, text: data.text, url: data.url });
      return { success: true, method: 'webshare' };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, method: 'webshare', error: 'Compartilhamento cancelado' };
      }
    }
  }

  const copied = await copyToClipboard(data.text);
  if (copied) {
    return { success: true, method: 'clipboard' };
  }

  return { success: false, method: 'none', error: 'Não foi possível compartilhar' };
}
