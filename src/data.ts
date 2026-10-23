import { Dataset } from "./schema";
import meta from "../data/meta.json";
import events from "../data/events.json";
import eras from "../data/eras.json";
import metrics from "../data/metrics.json";
import clock from "../data/clock.json";
import scenarios from "../data/scenarios.json";
import indicators from "../data/indicators.json";
import changelog from "../data/changelog.json";
import citations from "../data/citations.json";

export const data = Dataset.parse({ meta, events, eras, metrics, clock, scenarios, indicators, changelog, citations });
export const YEAR_MIN = 2026;
export const YEAR_MAX = 2200;
/** Most forecast lines sit before 2070; open there and keep the long tail one click away. */
export const DEFAULT_VIEW: [number, number] = [2025.5, 2070.5];
export const TODAY = new Date();
export const THIS_YEAR = TODAY.getFullYear() + (TODAY.getMonth() + 1) / 12;
