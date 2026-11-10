import React, { useRef, useEffect } from 'react';

/**
 * Horizontal scroll wrapper for data tables that keeps the horizontal scrollbar
 * hidden at rest, briefly reveals it while scrolling horizontally, and hides it again.
 */
export default function TableScrollContainer({
  className = '',
  allowVerticalScroll = false,
  children
}) {
  const containerRef = useRef(null);
  const lastScrollLeftRef = useRef(0);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      lastScrollLeftRef.current = containerRef.current.scrollLeft;
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollLeft !== lastScrollLeftRef.current) {
      lastScrollLeftRef.current = el.scrollLeft;
      el.classList.add('is-scrolling-x');
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        el.classList.remove('is-scrolling-x');
      }, 1000);
    }
  };

  const overflowClasses = allowVerticalScroll
    ? 'overflow-x-auto overflow-y-auto min-h-0'
    : 'overflow-x-auto';

  const modeClass = allowVerticalScroll
    ? 'table-scroll-x table-scroll-x--keep-y'
    : 'table-scroll-x';

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`${overflowClasses} ${modeClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

