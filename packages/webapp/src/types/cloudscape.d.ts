declare module '@cloudscape-design/components' {
    import { ReactNode, CSSProperties } from 'react';
    
    export interface StatusIndicatorProps {
        type: 'error' | 'warning' | 'success' | 'pending' | 'in-progress';
        children?: ReactNode;
        style?: CSSProperties;
    }
    
    export const StatusIndicator: React.FC<StatusIndicatorProps>;
}