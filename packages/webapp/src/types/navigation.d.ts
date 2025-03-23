export interface NavigationEvent {
    preventDefault: () => void;
    detail: {
        href: string;
        external?: boolean;
    };
}