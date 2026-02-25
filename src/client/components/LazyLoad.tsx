import React, { useRef, useState, useEffect } from 'react';
import { SkeletonLoader } from './SkeletonLoader';

export interface LazyLoadProps {
  children: React.ReactNode;

  placeholder?: React.ReactNode;

  rootMargin?: string;

  threshold?: number;

  placeholderHeight?: string;
}

export const LazyLoad: React.FC<LazyLoadProps> = ({
  children,
  placeholder,
  rootMargin = '200px',
  threshold = 0,
  placeholderHeight = '80px',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  if (isVisible) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} aria-hidden="true">
      {placeholder ?? <SkeletonLoader count={1} height={placeholderHeight} />}
    </div>
  );
};
