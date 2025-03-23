// src/atoms/SettingsAtom.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { SelectProps } from '@cloudscape-design/components/select';

export type SettingsType = {
  model: SelectProps.Option;
  temperature: number;
  k?: number;
  top_p?: number;
  top_k?: number;
  max_gen_len?: number;
  max_tokens?: number;
};

const defaultSettings: SettingsType[] = [
  {
    model: {
      label: 'Amazon Nova Pro',
      value: 'us.amazon.nova-pro-v1:0',
    },
    temperature: 0.2,
    top_p: 0.2,
  },
  {
    model: {
      label: 'Claude 3 Haiku',
      value: 'anthropic.claude-3-haiku-20240307-v1:0',
    },
    temperature: 0.2,
    top_p: 0.2,
  },
  {
    model: {
      label: 'Claude 3 Sonnet',
      value: 'anthropic.claude-3-sonnet-20240229-v1:0',
    },
    temperature: 0.2,
    top_p: 0.2,
  },
  {
    model: { label: 'Mixtral 8X7B Instruct', value: 'mistral.mixtral-8x7b-instruct-v0:1' },
    temperature: 0.5,
    top_p: 0.4,
  },
  {
    model: { label: 'Mistral Large 2', value: 'mistral.mistral-large-2407-v1:0' },
    temperature: 0.5,
    top_p: 0.4,
  },
  {
    model: { label: 'Command R', value: 'cohere.command-r-v1:0' },
    temperature: 0.5,
    top_p: 0.4,
  },
];

export const settingsAtom = atomWithStorage<SettingsType[]>('settings', defaultSettings);
export const currentSettingsIndexAtom = atom<number>(0);
