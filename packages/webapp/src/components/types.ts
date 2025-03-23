export interface TableItem {
    id: string;
    imageKey: string;
    category: string;
    language: string;
    settings: string;
}

export interface TableRenderProps {
    firstIndex: number;
    lastIndex: number;
    totalItemsCount: number;
}