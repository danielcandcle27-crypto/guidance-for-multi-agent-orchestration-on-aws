import { atom } from 'jotai'
import { atomWithReset, atomWithStorage } from 'jotai/utils'
import { Mode } from '@cloudscape-design/global-styles';
import { AuthUser } from 'aws-amplify/auth';
import { SettingsType } from "./SettingsAtom";

// query keys

export enum QUERY_KEYS {
    PRODUCTS = "PRODUCTS",
    PRODUCT = "PRODUCT",
    TRANSACTIONS = "TRANSACTIONS"
}

export type AttributesType = {
    name: string,
    description: string
}
export type AttributesResponseType = {
    attributes: AttributesType[]
}

export type DescriptionResponseType = {
    data: TransactionType
}

export type HistoryResponseType = {
    data: HistoryType[]
}

type BaseTransactionType = {
    id: string;
    userId: string;
    username: string;
    imageKey: string;
    category: string;
    phase: string;
    oprStatus: string;
    generatedAttributes: AttributesType[];
    editedAttributes: AttributesType[];
    language: string;
    demographics: string;
    brandMessaging: string;
    generatedDescription: string;
    createdAt: string;
    updatedAt: string;
    sessionId?: string;
    agentId?: string;
    aliasId?: string;
    websocketId?: string;
}
export type HistoryType = BaseTransactionType & {
    settings: string;
}

export type TransactionType = BaseTransactionType & {
    settings: SettingsType,
}

// 
export const appName = "Multi-agent Collaboration"
// Theme atom
export const themeAtom = atomWithStorage<Mode>('theme', Mode.Light);

export const toggleThemeAtom = atom(null, (get, set) => set(themeAtom, get(themeAtom) === Mode.Light ? Mode.Dark : Mode.Light));


// loading modal 
type LoadingModalAtomType = {
    visible: boolean,
    header: string;
    message: string
}
export const loadingModalAtom = atom<LoadingModalAtomType>({
    visible: false, header: "", message: ""
});

// the transaction that will be written to DB
export const transactionAtom = atomWithReset<TransactionType>({
    id: "",
    userId: "",
    username: "",
    category: "",
    imageKey: "",
    phase: "",
    oprStatus: "",
    settings: {
        model: {
            label: "Claude 3 Haiku",
            value: "anthropic.claude-3-haiku-20240307-v1:0"
        },
        temperature: 0.2,
        top_p: 0.2,

    },
    generatedAttributes: [],
    editedAttributes: [],
    demographics: "",
    brandMessaging: "",
    language: "english",
    generatedDescription: "",
    createdAt: "",
    updatedAt: "",
})

export const setEditedAttributesAtom = atom(null, (get, set, editedAttributes: AttributesType[]) => set(transactionAtom, { ...get(transactionAtom), editedAttributes }))

export const setLanguageAtom = atom(null, (get, set, language: string) => set(transactionAtom, { ...get(transactionAtom), language: language.toLowerCase() }))

// attribute list atom 
export const attributeListAtom = atom<AttributesType[]>([]);


// left side nav drawer
export const navDrawerAtom = atom(true);
// right side info panel drawer
export const infoDrawerAtom = atom(false);

export enum HelpPanelTitle {
    EMPTY = "EMPTY"
}
export const infoIdAtom = atom<HelpPanelTitle>(HelpPanelTitle.EMPTY);

export interface DetailsModalProps {
    visible: boolean;
    item: HistoryType | null;
}
export const DetailsModalAtom = atom<DetailsModalProps>({
    visible: false,
    item: null
})

export const termsAtom = atomWithStorage('terms', false);



