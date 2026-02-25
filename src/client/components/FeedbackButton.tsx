import React, { useRef, useCallback } from 'react';

export interface FeedbackButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {

  feedbackColor?: string;
}

const FEEDBACK_STYLE_ID = 'feedback-button-styles';

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FEEDBACK_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = FEEDBACK_STYLE_ID;
  style.textContent = `
    .feedback-btn {
      position: relative;
      overflow: hidden;
      transition: transform 50ms ease, opacity 50ms ease;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .feedback-btn:active,
    .feedback-btn[data-pressed="true"] {
      transform: scale(0.97);
      opacity: 0.85;
    }
    .feedback-btn .feedback-ripple {
      position: absolute;
      border-radius: 50%;
      transform: scale(0);
      animation: feedback-ripple-anim 400ms ease-out forwards;
      pointer-events: none;
    }
    @keyframes feedback-ripple-anim {
      to {
        transform: scale(2.5);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  children,
  feedbackColor = 'rgba(99, 102, 241, 0.25)',
  className,
  style,
  onClick,
  onPointerDown,
  ...rest
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      ensureStyles();
      const btn = btnRef.current;
      if (!btn) return;

      btn.setAttribute('data-pressed', 'true');

      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'feedback-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.background = feedbackColor;
      btn.appendChild(ripple);

      const cleanup = () => {
        btn.removeAttribute('data-pressed');
        ripple.remove();
      };
      ripple.addEventListener('animationend', cleanup, { once: true });
      setTimeout(cleanup, 500);

      onPointerDown?.(e);
    },
    [feedbackColor, onPointerDown],
  );

  return (
    <button
      ref={btnRef}
      className={`feedback-btn${className ? ` ${className}` : ''}`}
      style={style}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      {...rest}
    >
      {children}
    </button>
  );
};
