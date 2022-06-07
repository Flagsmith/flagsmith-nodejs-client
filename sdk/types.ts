import { Flags } from "./models";

export interface FlagsmithCache {
  get(key: string): Promise<Flags>;
  set(key: string, value: Flags): Promise<void>;
  has(key: string): Promise<boolean>;
  [key: string]: any;
}
