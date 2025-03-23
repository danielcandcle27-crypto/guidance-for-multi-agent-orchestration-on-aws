import type { ReactNode, CSSProperties } from 'react';

declare module '@cloudscape-design/components' {
    export interface BoxProps {
        children?: ReactNode;
        variant?: "div" | "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5";
        padding?: { top?: string; bottom?: string; horizontal?: string; vertical?: string } | string;
        margin?: { top?: string; bottom?: string; horizontal?: string; vertical?: string } | string;
        display?: string;
        fontSize?: string;
        color?: string;
        textAlign?: string;
        className?: string;
        style?: CSSProperties;
        alignItems?: string;
        justifyContent?: string;
        gap?: string;
        marginLeft?: string;
    }
}