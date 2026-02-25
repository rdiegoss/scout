import React, { useState } from 'react';
import styles from '@client/styles/components/StarRating.module.scss';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: number;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  readOnly = false,
  size = 24,
}) => {
  const [hovered, setHovered] = useState(0);

  const displayValue = hovered || value;

  return (
    <div
      role="group"
      aria-label={`Rating: ${value} out of 5 stars`}
      className={styles.group}
      style={{ '--star-size': `${size}px` } as React.CSSProperties}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`${readOnly ? '' : 'star-interactive'} ${styles.star}`}
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          data-active={star <= displayValue ? 'true' : undefined}
        >
          ★
        </button>
      ))}
    </div>
  );
};
