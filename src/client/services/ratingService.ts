import type { Rating, ServiceProvider, GeoPosition } from '@shared/types';
import { isValidComment } from '@shared/utils/validation';
import { type AppDatabase, db as defaultDb } from './database';

export interface SubmitRatingInput {
  serviceId: string;
  userId: string;
  score: number;
  comment?: string;
  userLocation: GeoPosition;
  isNeighbor: boolean;
}

export interface SubmitRatingResult {
  rating: Rating;
  newAverageRating: number;
  newTotalRatings: number;
}

export class RatingService {
  private db: AppDatabase;

  constructor(db: AppDatabase = defaultDb) {
    this.db = db;
  }

  async submitRating(input: SubmitRatingInput): Promise<SubmitRatingResult> {
    this.validateScore(input.score);
    this.validateComment(input.comment);

    const rating: Rating = {
      id: crypto.randomUUID(),
      serviceId: input.serviceId,
      userId: input.userId,
      score: input.score,
      comment: input.comment,
      userLocation: input.userLocation,
      isNeighbor: input.isNeighbor,
      createdAt: Date.now(),
      helpful: 0,
    };

    await this.db.ratings.put(rating);

    const { newAverage, newTotal } = await this.recalculateAverage(input.serviceId);

    const recentRatings = await this.getRecentRatings(input.serviceId);

    await this.db.services.update(input.serviceId, {
      averageRating: newAverage,
      totalRatings: newTotal,
      recentRatings,
      updatedAt: Date.now(),
    });

    return {
      rating,
      newAverageRating: newAverage,
      newTotalRatings: newTotal,
    };
  }

  async recalculateAverage(serviceId: string): Promise<{ newAverage: number; newTotal: number }> {
    const allRatings = await this.db.ratings
      .where('serviceId')
      .equals(serviceId)
      .toArray();

    if (allRatings.length === 0) {
      return { newAverage: 0, newTotal: 0 };
    }

    const sum = allRatings.reduce((acc, r) => acc + r.score, 0);
    const newAverage = Math.round((sum / allRatings.length) * 100) / 100;

    return { newAverage, newTotal: allRatings.length };
  }

  async getRecentRatings(serviceId: string): Promise<Rating[]> {
    const allRatings = await this.db.ratings
      .where('serviceId')
      .equals(serviceId)
      .toArray();

    return allRatings
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3);
  }

  private validateScore(score: number): void {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error('Rating score must be an integer between 1 and 5');
    }
  }

  private validateComment(comment: string | undefined): void {
    if (!isValidComment(comment)) {
      throw new Error('Comment must not exceed 500 characters');
    }
  }
}
