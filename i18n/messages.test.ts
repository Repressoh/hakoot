// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkMessage } from "../scripts/icu-messages";
import { locales } from "./locales";

const MESSAGES_DIR = join(import.meta.dirname, "..", "messages");

function flatten(
  value: unknown,
  path = "",
  out = new Map<string, unknown>()
): Map<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, path ? `${path}.${key}` : key, out);
    }
  } else {
    out.set(path, value);
  }
  return out;
}

function readCatalog(locale: string): Map<string, unknown> {
  return flatten(
    JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8"))
  );
}

const catalogs = readdirSync(MESSAGES_DIR)
  .filter((fileName) => fileName.endsWith(".json"))
  .map((fileName) => fileName.slice(0, -".json".length))
  .sort();
const source = readCatalog("en");

describe("message catalogs", () => {
  it("are all routed", () => {
    expect([...locales].sort()).toEqual(catalogs);
  });

  it.each(catalogs)("%s has the same keys as en", (locale) => {
    expect([...readCatalog(locale).keys()].sort()).toEqual(
      [...source.keys()].sort()
    );
  });

  it.each(catalogs)("%s has valid ICU messages", (locale) => {
    const catalog = readCatalog(locale);
    const problems = [...source].flatMap(([key, message]) => {
      const translation = catalog.get(key);
      if (typeof translation !== "string") {
        return [`${key}: not a string`];
      }
      return checkMessage(String(message), translation).map(
        (problem) => `${key}: ${problem}`
      );
    });

    expect(problems).toEqual([]);
  });
});
