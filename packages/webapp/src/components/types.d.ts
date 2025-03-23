import { TableProps } from "@cloudscape-design/components";

export interface TableItem {
    id: string;
    imageKey: string;
    category: string;
    language: string;
    settings: string;
}

export interface BaseTransactionType extends TableItem {
    userId: string;
    username: string;
    phase: string;
    oprStatus: string;
    timestamp: string;
    success: boolean;
    error: string | null;
    metadata: any;
    input: any;
    output: any;
    duration: number;
}

export interface TableRenderProps {
    firstIndex: number;
    lastIndex: number;
    totalItemsCount: number;
}

export type HistoryType = BaseTransactionType;

export type LiveAnnouncement = TableProps.LiveAnnouncement;