import type { ComponentType, ReactNode, CSSProperties } from 'react';

declare module '@cloudscape-design/components' {
    export interface NonCancelableCustomEvent<DetailType> {
        detail: DetailType;
    }

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
        alignItems?: string;
        justifyContent?: string;
        gap?: string;
        marginLeft?: string;
        flex?: number;
        style?: CSSProperties;
    }

    export interface StatusIndicatorProps {
        type: 'error' | 'warning' | 'success' | 'pending' | 'in-progress';
        children?: ReactNode;
        style?: CSSProperties;
    }

    export interface TableProps {
        filteringText?: string;
        onChange?: (event: NonCancelableCustomEvent<{ filteringText: string }>) => void;
    }

    export interface TabsProps {
        activeTabId?: string;
        onChange?: (event: NonCancelableCustomEvent<{ activeTabId: string }>) => void;
    }
}

declare module '@cloudscape-design/components/input' {
    export interface InputProps {
        value?: string;
        multiline?: boolean;
        rows?: number;
        placeholder?: string;
        onChange?: (event: { detail: { value: string } }) => void;
    }

    const Input: ComponentType<InputProps>;
    export default Input;
}

declare module '@cloudscape-design/components/form-field' {
    export interface FormFieldProps {
        label?: ReactNode;
        description?: ReactNode;
        children?: ReactNode;
        errorText?: ReactNode;
    }

    const FormField: ComponentType<FormFieldProps>;
    export default FormField;
}

declare module '@cloudscape-design/components/container' {
    export interface ContainerProps {
        header?: ReactNode;
        children?: ReactNode;
    }

    const Container: ComponentType<ContainerProps>;
    export default Container;
}

declare module '@cloudscape-design/components/column-layout' {
    export interface ColumnLayoutProps {
        columns: number;
        children?: ReactNode;
        variant?: "text-grid" | "default";
    }

    const ColumnLayout: ComponentType<ColumnLayoutProps>;
    export default ColumnLayout;
}