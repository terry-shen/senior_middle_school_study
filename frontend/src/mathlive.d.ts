// Type declarations for MathLive custom elements
import type { MathfieldElement } from 'mathlive';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement> & {
          // MathLive-specific attributes
          'default-mode'?: string;
          'read-only'?: boolean;
          'math-mode-space'?: string;
          onInput?: (event: any) => void;
          ref?: any;
        },
        MathfieldElement
      >;
    }
  }
}

export {};
