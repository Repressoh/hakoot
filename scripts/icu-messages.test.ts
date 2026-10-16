// @vitest-environment node
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import {
  checkMessage,
  type TranslateBatch,
  translateMessage,
} from "./icu-messages";

const STEPS = "{count, plural, =0 {No steps} =1 {1 step} other {# steps}}";
const SENT = "Sent {sent} {sent, plural, =1 {invite} other {invites}}";
const JOINED =
  "You're in! {count, plural, =1 {1 person} other {# people}} joined so far.";
const REMAINING =
  "{seconds, plural, one {# second remaining} other {# seconds remaining}}";
const UNPARSEABLE = /^does not parse/;
const MISSING_NUMBER = /missing \{number\}/;
const UNKNOWN_PLACEHOLDER = /Unknown placeholder/;
const UNBALANCED = /Unbalanced/;

/** A translator that returns its input and records what it was sent. Like DeepL, it rejects an empty batch. */
function echo() {
  const seen: string[] = [];
  const translate: TranslateBatch = (texts) => {
    if (texts.length === 0) {
      return Promise.reject(new Error("The text field is required."));
    }
    seen.push(...texts);
    return Promise.resolve(texts);
  };
  return { seen, translate };
}

/** A translator that answers from a fixed table and fails on anything else. */
function dictionary(entries: Record<string, string>): TranslateBatch {
  return (texts) =>
    Promise.resolve(
      texts.map((text) => {
        const translation = entries[text];
        if (translation === undefined) {
          throw new Error(`Unexpected text: ${text}`);
        }
        return translation;
      })
    );
}

function render(
  locale: string,
  message: string,
  values: Record<string, number | string>
) {
  return createTranslator({ locale, messages: { message } })("message", values);
}

describe("checkMessage", () => {
  it("accepts a faithful translation", () => {
    expect(
      checkMessage(
        STEPS,
        "{count, plural, =0 {Keine Schritte} =1 {1 Schritt} other {# Schritte}}"
      )
    ).toEqual([]);
  });

  it("accepts a plain argument turned into a plural for agreement", () => {
    expect(
      checkMessage(
        "{seconds} seconds",
        "{seconds, plural, one {# секунда} few {# секунды} many {# секунд} other {# секунды}}"
      )
    ).toEqual([]);
  });

  it.each([
    [
      "translated argument names",
      "{conteggio, plural, =0 {Nessun passo} other {# passi}}",
      ["missing {count}", "unknown argument {conteggio}"],
    ],
    [
      "translated plural keywords",
      "{count, plural, =0 {Nessun passo} uno {1 passo} other {# passi}}",
      ["{count} has invalid plural keys: uno"],
    ],
    ["a flattened plural", "{count} passi", ["{count} is no longer a plural"]],
  ])("flags %s", (_, translation, problems) => {
    expect(checkMessage(STEPS, translation)).toEqual(problems);
  });

  it.each([
    [
      "full-width braces",
      "｛count, plural, =0 {Nessun passo} other {# passi}}",
    ],
    [
      "a translated other",
      "{count, plural, =0 {Nessun passo} altro {# passi}}",
    ],
  ])("flags %s as unparseable", (_, translation) => {
    expect(checkMessage(STEPS, translation)).toEqual([
      expect.stringMatching(UNPARSEABLE),
    ]);
  });
});

describe("translateMessage", () => {
  it("sends whole sentences with placeholders instead of ICU syntax", async () => {
    const { seen, translate } = echo();

    const result = await translateMessage(
      "Step {current} of {total}",
      "en",
      translate
    );

    expect(seen).toEqual(['Step <x i="0"/> of <x i="1"/>']);
    expect(result).toBe("Step {current} of {total}");
  });

  it("writes a plural's own argument as a sample count", async () => {
    const { seen, translate } = echo();

    const result = await translateMessage(SENT, "en", translate);

    expect(seen).toEqual(["Sent 1 invite", "Sent 2 invites"]);
    expect(result).toBe(
      "{sent, plural, =1 {Sent # invite} other {Sent # invites}}"
    );
  });

  it("hoists a plural out of the middle of a sentence", async () => {
    const { seen, translate } = echo();

    const result = await translateMessage(JOINED, "en", translate);

    expect(seen).toEqual([
      "You're in! 1 person joined so far.",
      "You're in! 2 people joined so far.",
    ]);
    expect(result).toBe(
      "{count, plural, =1 {You're in! 1 person joined so far.} other {You're in! # people joined so far.}}"
    );
  });

  it("writes every plural category of the target language, agreeing with a sample count", async () => {
    const result = await translateMessage(
      REMAINING,
      "ru",
      dictionary({
        "1.5 seconds remaining": "Осталось 1,5 секунды",
        "2 seconds remaining": "Осталось 2 секунды",
        "5 seconds remaining": "Осталось 5 секунд",
        "21 second remaining": "Осталась 21 секунда",
      })
    );

    expect(result).toBe(
      "{seconds, plural, one {Осталась # секунда} few {Осталось # секунды} many {Осталось # секунд} other {Осталось # секунды}}"
    );
    expect(render("ru", result, { seconds: 22 })).toBe("Осталось 22 секунды");
  });

  it("skips categories the =N branches already cover", async () => {
    const { seen, translate } = echo();

    // French `one` is 0 and 1, both covered by =0 and =1.
    const result = await translateMessage(STEPS, "fr", translate);

    expect(seen).toEqual(["No steps", "1 step", "2 steps"]);
    expect(result).toBe(STEPS);
  });

  it("retries with a placeholder when the translator rewrites the sample count", async () => {
    const result = await translateMessage(
      STEPS,
      "es",
      dictionary({
        '<x i="0"/> steps': '<x i="0"/> pasos',
        "1 step": "1 paso",
        "2 steps": "dos pasos",
        "No steps": "Ningún paso",
      })
    );

    expect(result).toBe(
      "{count, plural, =0 {Ningún paso} =1 {1 paso} other {# pasos}}"
    );
  });

  it("keeps ICU syntax characters from the translation as text", async () => {
    const result = await translateMessage(
      "Edited {date}",
      "fr",
      dictionary({ 'Edited <x i="0"/>': 'Modifié l\'{<x i="0"/>} #1 &amp; co' })
    );

    expect(render("fr", result, { date: "3 mars" })).toBe(
      "Modifié l'{3 mars} #1 & co"
    );
  });

  it("leaves text without words untranslated", async () => {
    const { seen, translate } = echo();

    expect(await translateMessage("#{rank}", "de", translate)).toBe("#{rank}");
    expect(seen).toEqual([]);
  });

  it.each([
    ["drops a placeholder", "Schritt", MISSING_NUMBER],
    ["invents a placeholder", 'Schritt <x i="7"/>', UNKNOWN_PLACEHOLDER],
    ["breaks the nesting", 'Schritt </t><x i="0"/>', UNBALANCED],
  ])("throws when the translator %s", async (_, output, error) => {
    await expect(
      translateMessage(
        "Step {number}",
        "de",
        dictionary({ 'Step <x i="0"/>': output })
      )
    ).rejects.toThrow(error);
  });
});
