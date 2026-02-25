import type { ServiceCategory } from '@shared/types';

/** Maps service categories to i18n keys for display names. */
export const CATEGORY_NAME_KEYS: Record<ServiceCategory, string> = {
  reparos_domesticos: 'home.categoryName.reparos_domesticos',
  servicos_pessoais: 'home.categoryName.servicos_pessoais',
  automotivo: 'home.categoryName.automotivo',
  construcao: 'home.categoryName.construcao',
  outros: 'home.categoryName.outros',
};

/** Emoji and short label per category (used in chips and cards). */
export const CATEGORY_LABELS: Record<ServiceCategory, { emoji: string; short: string }> = {
  reparos_domesticos: { emoji: '🔧', short: 'Reparos' },
  servicos_pessoais: { emoji: '💇', short: 'Pessoais' },
  automotivo: { emoji: '🚗', short: 'Auto' },
  construcao: { emoji: '🏗️', short: 'Construção' },
  outros: { emoji: '📦', short: 'Outros' },
};
