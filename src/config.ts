import { ImmutableObject } from "seamless-immutable";

export interface Config {
  serviceAreaUrl: string;
  colors: string[];
  resultColor: string;
  facilityColor: string;
  interval: number;
  intervalMin: number;
  intervalMax: number;
  intervalStep: number;
  repetition: number;
  repetitionMin: number;
  repetitionMax: number;
  dayOfWeek: number;
}

export type IMConfig = ImmutableObject<Config>;
