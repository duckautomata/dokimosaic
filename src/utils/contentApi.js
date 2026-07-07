import { isMockMode } from "../config";
import * as real from "./contentApi.real";
import * as mock from "./contentApi.mock";

const impl = isMockMode ? mock : real;

export const { fetchPublicConfig, submitSuggestion } = impl;
