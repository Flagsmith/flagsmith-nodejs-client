import {DefaultFlag, Flags} from "./models";
import {AgentOptions} from "https";
import {EnvironmentModel} from "../flagsmith-engine";

export interface FlagsmithCache {
  get(key: string): Promise<Flags|undefined> | undefined;
  set(key: string, value: Flags, ttl: string | number): boolean | Promise<boolean>;
  has(key: string): boolean | Promise<boolean>;
  [key: string]: any;
}

export interface FlagsmithConfig {
  environmentKey: string;
  apiUrl?: string;
  agentOptions?:AgentOptions;
  customHeaders?: { [key: string]: any };
  requestTimeoutSeconds?: number;
  enableLocalEvaluation?: boolean;
  environmentRefreshIntervalSeconds?: number;
  retries?: number;
  enableAnalytics?: boolean;
  defaultFlagHandler?: (featureName: string) => DefaultFlag;
  cache?: FlagsmithCache,
  onEnvironmentChange?: (error: Error | null, result: EnvironmentModel) => void,
}
