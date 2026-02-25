import React from 'react';
import styles from '@client/styles/components/SkeletonLoader.module.scss';

interface SkeletonLoaderProps {
  count?: number;
  height?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ count = 3, height = '80px' }) => {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={styles.skeleton}
          style={{ '--skeleton-height': height } as React.CSSProperties}
          aria-hidden="true"
        />
      ))}
    </>
  );
};
