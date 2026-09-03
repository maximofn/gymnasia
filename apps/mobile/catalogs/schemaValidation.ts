import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";

import {
  EXERCISE_ENTRY_SCHEMA,
  FOOD_ENTRY_SCHEMA,
} from "./generated/catalogSchemas.generated";
import type { RawExerciseCatalogEntry, RawFoodCatalogEntry } from "./types";

type JsonSchema = {
  type?: "object" | "array" | "string" | "number";
  additionalProperties?: boolean;
  required?: readonly string[];
  properties?: Readonly<Record<string, JsonSchema>>;
  items?: JsonSchema;
  pattern?: string;
  minLength?: number;
  minimum?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function matchesCatalogSchema(value: unknown, schema: JsonSchema): boolean {
  if (schema.type === "object") {
    if (!isRecord(value)) return false;
    const properties = schema.properties ?? {};
    if (schema.required?.some((key) => !(key in value))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !(key in properties))) {
      return false;
    }
    return Object.entries(value).every(([key, entry]) => {
      const propertySchema = properties[key];
      return !propertySchema || matchesCatalogSchema(entry, propertySchema);
    });
  }
  if (schema.type === "array") {
    return Array.isArray(value)
      && (!schema.items || value.every((entry) => matchesCatalogSchema(entry, schema.items!)));
  }
  if (schema.type === "string") {
    return typeof value === "string"
      && (schema.minLength === undefined || value.length >= schema.minLength)
      && (schema.pattern === undefined || new RegExp(schema.pattern, "u").test(value));
  }
  if (schema.type === "number") {
    return typeof value === "number"
      && Number.isFinite(value)
      && (schema.minimum === undefined || value >= schema.minimum);
  }
  return false;
}

function parseArray<T>(value: unknown, schema: JsonSchema): T[] | null {
  if (!Array.isArray(value) || !value.every((entry) => matchesCatalogSchema(entry, schema))) return null;
  return value as T[];
}

export function parseFoodCatalog(value: unknown): RawFoodCatalogEntry[] | null {
  return parseArray<RawFoodCatalogEntry>(value, FOOD_ENTRY_SCHEMA);
}

export function parseExerciseCatalog(value: unknown): RawExerciseCatalogEntry[] | null {
  return parseArray<RawExerciseCatalogEntry>(value, EXERCISE_ENTRY_SCHEMA);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalCatalogJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function catalogContentHash(value: unknown): `sha256:${string}` {
  const digest = sha256(new TextEncoder().encode(canonicalCatalogJson(value)));
  return `sha256:${bytesToHex(digest)}`;
}
