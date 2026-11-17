import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * 让弹窗真正“接管”页面：
 * - 打开时锁定 body 滚动（补偿滚动条宽度，避免页面横向跳动）
 * - 把焦点移入弹窗，并在弹窗内循环 Tab
 * - Escape 关闭
 * - 关闭后恢复滚动与之前的焦点
 */
export function useModalDialog<T extends HTMLElement>(
  open: boolean,
  onClose?: () => void
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const html = document.documentElement;
    const prevOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    const el = ref.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    el?.focus({ preventScroll: true });

    const SELECTOR =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const focusables = Array.from(el.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      );
      if (focusables.length === 0) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      body.style.overflow = prevOverflow;
      html.style.overflow = prevHtmlOverflow;
      body.style.paddingRight = prevPaddingRight;
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return ref;
}
