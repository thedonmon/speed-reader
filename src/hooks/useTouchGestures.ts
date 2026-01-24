'use client';

import { useRef, useCallback } from 'react';

interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  minSwipeDistance?: number;
}

export function useTouchGestures(options: TouchGestureOptions) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    minSwipeDistance = 50,
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number; target: EventTarget | null } | null>(null);
  const touchMoveRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      target: e.target,
    };
    touchMoveRef.current = null;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchMoveRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) return;

    const start = touchStartRef.current;
    const end = touchMoveRef.current || start;
    const elapsed = Date.now() - start.time;

    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Check if it's a tap (short duration, minimal movement)
    if (elapsed < 300 && absX < 10 && absY < 10) {
      // Don't trigger tap if the touch started on an interactive element
      // Use the original touch target, not the touchend target
      const target = start.target as HTMLElement | null;
      const isInteractive = target?.closest('button, a, input, [role="button"], [data-no-tap]');
      if (!isInteractive) {
        onTap?.();
      }
      touchStartRef.current = null;
      return;
    }

    // Check for swipe
    if (absX > minSwipeDistance || absY > minSwipeDistance) {
      // Horizontal swipe is dominant
      if (absX > absY) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      } 
      // Vertical swipe is dominant
      else {
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }

    touchStartRef.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, minSwipeDistance]);

  const bindGestures = useCallback((element: HTMLElement | null) => {
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { bindGestures };
}
