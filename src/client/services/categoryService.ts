import type { ServiceProvider, ServiceCategory, CategoryDefinition } from '@shared/types';
import type { GeoPosition } from '@shared/types';
import { type AppDatabase, db as defaultDb } from './database';
import { haversineDistanceKm } from './vectorDatabaseClient';

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'reparos_domesticos',
    name: 'Reparos Domésticos',
    icon: '🔧',
    subcategories: [
      { id: 'eletricista', name: 'Eletricista', keywords: ['elétrica', 'fiação', 'tomada', 'disjuntor', 'curto-circuito', 'instalação elétrica'] },
      { id: 'encanador', name: 'Encanador', keywords: ['hidráulica', 'vazamento', 'cano', 'torneira', 'esgoto', 'caixa d\'água'] },
      { id: 'pintor', name: 'Pintor', keywords: ['pintura', 'parede', 'tinta', 'textura', 'acabamento'] },
      { id: 'marceneiro', name: 'Marceneiro', keywords: ['móveis', 'madeira', 'armário', 'porta', 'reparo em móveis'] },
      { id: 'serralheiro', name: 'Serralheiro', keywords: ['grade', 'portão', 'ferro', 'solda', 'metalúrgica'] },
    ],
  },
  {
    id: 'servicos_pessoais',
    name: 'Serviços Pessoais',
    icon: '💇',
    subcategories: [
      { id: 'costureira', name: 'Costureira', keywords: ['costura', 'roupa', 'ajuste', 'bainha', 'conserto de roupa'] },
      { id: 'cabeleireiro', name: 'Cabeleireiro', keywords: ['cabelo', 'corte', 'tintura', 'escova', 'penteado'] },
      { id: 'manicure', name: 'Manicure', keywords: ['unha', 'esmalte', 'pedicure', 'nail designer'] },
      { id: 'diarista', name: 'Diarista', keywords: ['limpeza', 'faxina', 'doméstica', 'passadeira'] },
    ],
  },
  {
    id: 'automotivo',
    name: 'Automotivo',
    icon: '🚗',
    subcategories: [
      { id: 'mecanico', name: 'Mecânico', keywords: ['carro', 'motor', 'freio', 'suspensão', 'oficina'] },
      { id: 'eletricista_auto', name: 'Eletricista Automotivo', keywords: ['bateria', 'alternador', 'parte elétrica', 'injeção eletrônica'] },
      { id: 'funileiro', name: 'Funileiro', keywords: ['lataria', 'amassado', 'funilaria', 'pintura automotiva'] },
      { id: 'borracheiro', name: 'Borracheiro', keywords: ['pneu', 'borracharia', 'calibragem', 'rodízio'] },
    ],
  },
  {
    id: 'construcao',
    name: 'Construção',
    icon: '🏗️',
    subcategories: [
      { id: 'pedreiro', name: 'Pedreiro', keywords: ['obra', 'alvenaria', 'reboco', 'contrapiso', 'construção'] },
      { id: 'azulejista', name: 'Azulejista', keywords: ['azulejo', 'piso', 'revestimento', 'cerâmica', 'porcelanato'] },
      { id: 'gesseiro', name: 'Gesseiro', keywords: ['gesso', 'forro', 'drywall', 'sanca', 'moldura'] },
      { id: 'vidraceiro', name: 'Vidraceiro', keywords: ['vidro', 'box', 'espelho', 'janela', 'vidraçaria'] },
    ],
  },
  {
    id: 'outros',
    name: 'Outros',
    icon: '📦',
    subcategories: [
      { id: 'jardineiro', name: 'Jardineiro', keywords: ['jardim', 'poda', 'grama', 'paisagismo', 'plantas'] },
      { id: 'dedetizador', name: 'Dedetizador', keywords: ['pragas', 'insetos', 'dedetização', 'cupim', 'rato'] },
      { id: 'chaveiro', name: 'Chaveiro', keywords: ['chave', 'fechadura', 'cadeado', 'tranca', 'cofre'] },
      { id: 'tecnico_informatica', name: 'Técnico de Informática', keywords: ['computador', 'notebook', 'formatação', 'rede', 'impressora'] },
    ],
  },
];

const DEFAULT_RADIUS_KM = 5;

export interface CategoryCount {
  categoryId: ServiceCategory;
  count: number;
}

export class CategoryService {
  private db: AppDatabase;

  constructor(db: AppDatabase = defaultDb) {
    this.db = db;
  }

  getAllCategories(): CategoryDefinition[] {
    return CATEGORIES;
  }

  getCategoryById(id: ServiceCategory): CategoryDefinition | undefined {
    return CATEGORIES.find((c) => c.id === id);
  }

  getSubcategories(categoryId: ServiceCategory): CategoryDefinition['subcategories'] {
    const cat = this.getCategoryById(categoryId);
    return cat ? cat.subcategories : [];
  }

  async getServiceCountsByCategory(
    userLocation: GeoPosition,
    radiusKm: number = DEFAULT_RADIUS_KM,
  ): Promise<CategoryCount[]> {
    const allServices = await this.db.services
      .filter((s) => s.isActive)
      .toArray();

    const nearbyServices = allServices.filter((s) =>
      haversineDistanceKm(
        userLocation.latitude,
        userLocation.longitude,
        s.location.latitude,
        s.location.longitude,
      ) <= radiusKm,
    );

    const counts = new Map<ServiceCategory, number>();
    for (const cat of CATEGORIES) {
      counts.set(cat.id, 0);
    }

    for (const svc of nearbyServices) {
      counts.set(svc.category, (counts.get(svc.category) ?? 0) + 1);
    }

    return CATEGORIES.map((cat) => ({
      categoryId: cat.id,
      count: counts.get(cat.id) ?? 0,
    }));
  }

  filterByCategory(
    services: ServiceProvider[],
    categoryId: ServiceCategory,
  ): ServiceProvider[] {
    return services.filter((s) => s.category === categoryId);
  }

  filterBySubcategory(
    services: ServiceProvider[],
    subcategoryId: string,
  ): ServiceProvider[] {
    return services.filter((s) => s.subcategory === subcategoryId);
  }

  async favoriteCategory(userId: string, categoryId: ServiceCategory): Promise<void> {
    const profile = await this.db.userProfile.get(userId);
    if (!profile) {
      throw new Error(`UserProfile not found: ${userId}`);
    }

    if (profile.favoriteCategories.includes(categoryId)) {
      return; // already favorited
    }

    const updated = [...profile.favoriteCategories, categoryId];
    await this.db.userProfile.update(userId, { favoriteCategories: updated });
  }

  async unfavoriteCategory(userId: string, categoryId: ServiceCategory): Promise<void> {
    const profile = await this.db.userProfile.get(userId);
    if (!profile) {
      throw new Error(`UserProfile not found: ${userId}`);
    }

    const updated = profile.favoriteCategories.filter((c) => c !== categoryId);
    await this.db.userProfile.update(userId, { favoriteCategories: updated });
  }

  async getFavoriteCategories(userId: string): Promise<ServiceCategory[]> {
    const profile = await this.db.userProfile.get(userId);
    if (!profile) {
      return [];
    }
    return profile.favoriteCategories;
  }

  async isFavorite(userId: string, categoryId: ServiceCategory): Promise<boolean> {
    const favorites = await this.getFavoriteCategories(userId);
    return favorites.includes(categoryId);
  }
}
