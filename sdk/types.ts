import { Flags } from "./models";

export interface FlagsmithCache {
  get(key: string): Promise<Flags|undefined> | undefined;
  set(key: string, value: Flags, ttl: string | number): boolean | Promise<boolean>;
  has(key: string): boolean | Promise<boolean>;
  [key: string]: any;
}