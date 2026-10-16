/**
 * ICU message helpers shared by scripts/translate.ts and the catalog test.
 *
 * DeepL must never see ICU syntax: given `{count, plural, ...}` it translates
 * argument names and keywords and swaps braces for full-width ones. So
 * plurals and selects are hoisted until every branch is a whole sentence,
 * arguments and tags become XML placeholders DeepL keeps in place, and `#`
 * becomes a sample count from the target language's plural category, so the
 * noun and verb agree with it before the sample is turned back into `#`.
 */
import {
  type MessageFormatElement,
  type PluralElement,
  parse,
  type SelectElement,
  type TagElement,
  TYPE,
} from "@formatjs/icu-messageformat-parser";
import { doPrintAST } from "@formatjs/icu-messageformat-parser/printer.js";

export type TranslateBatch = (texts: string[]) => Promise<string[]>;

type Branching = PluralElement | SelectElement;
type Branch = [key: string, value: MessageFormatElement[], sample?: number];

interface Shape {
  args: Map<string, Set<TYPE>>;
  branchings: Branching[];
  tags: Set<string>;
}

interface Leaf {
  result?: MessageFormatElement[];
  sample?: number;
  seq: MessageFormatElement[];
}

type PlanNode =
  | { leaf: Leaf }
  | { branching: Branching; branches: [string, PlanNode][] };

const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];
const EXACT_KEY = /^=\d+$/;
const PLACEHOLDER = /<(x|t) i="(\d+)"\s*(\/?)>(?:<\/x>)?|<\/t>/g;
const LETTER = /\p{L}/u;
const XML_SPECIAL = /[&<>]/g;
const XML_ENTITY = /&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi;
const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};
// Stands in for a plural or select while the formatjs printer escapes the text around it.
const BRANCH_SLOT = "\u0000";

// CLDR integer rules look at n mod 10 and n mod 100, so counts up to 200 reach
// every category a realistic count can. Samples prefer 2+ so they don't
// collide with the =0 and =1 branches most messages have.
const MAX_SAMPLE = 200;
const SAMPLE_ORDER = [
  ...Array.from({ length: MAX_SAMPLE - 1 }, (_, index) => index + 2),
  0,
  1,
];
// Russian and Polish use `other` only for fractions, but every plural needs it.
const FRACTION_SAMPLE = 1.5;

function isBranching(el: MessageFormatElement): el is Branching {
  return el.type === TYPE.plural || el.type === TYPE.select;
}

function hasBranching(el: MessageFormatElement): boolean {
  return (
    isBranching(el) || (el.type === TYPE.tag && el.children.some(hasBranching))
  );
}

function mapOptions(
  el: Branching,
  map: (value: MessageFormatElement[]) => MessageFormatElement[]
): Branching {
  const options = Object.fromEntries(
    Object.entries(el.options).map(([key, option]) => [
      key,
      { value: map(option.value) },
    ])
  );
  return { ...el, options };
}

function shapeOf(
  ast: MessageFormatElement[],
  shape: Shape = { args: new Map(), branchings: [], tags: new Set() }
): Shape {
  for (const el of ast) {
    if (el.type === TYPE.tag) {
      shape.tags.add(el.value);
      shapeOf(el.children, shape);
    } else if (el.type !== TYPE.literal && el.type !== TYPE.pound) {
      const kinds = shape.args.get(el.value) ?? new Set<TYPE>();
      shape.args.set(el.value, kinds.add(el.type));
      if (isBranching(el)) {
        shape.branchings.push(el);
        for (const option of Object.values(el.options)) {
          shapeOf(option.value, shape);
        }
      }
    }
  }
  return shape;
}

function pluralRules(el: PluralElement, locale: string): Intl.PluralRules {
  // Without CLDR data for a locale, Intl falls back to the runtime default
  // locale, which is English for our servers and in practice for browsers.
  const supported = Intl.PluralRules.supportedLocalesOf(locale).length > 0;
  return new Intl.PluralRules(supported ? locale : "en", {
    type: el.pluralType,
  });
}

/** The first count in SAMPLE_ORDER for each category a count can reach without matching one of `el`'s =N branches. */
function categorySamples(
  el: PluralElement,
  locale: string
): Map<string, number> {
  const rules = pluralRules(el, locale);
  const samples = new Map<string, number>();
  for (const n of SAMPLE_ORDER) {
    const category = rules.select(n - el.offset);
    if (!(`=${n}` in el.options || samples.has(category))) {
      samples.set(category, n);
    }
  }
  if (
    !samples.has("other") &&
    rules.select(FRACTION_SAMPLE - el.offset) === "other"
  ) {
    samples.set("other", FRACTION_SAMPLE);
  }
  return samples;
}

function argumentProblems(expected: Shape, actual: Shape): string[] {
  const problems: string[] = [];
  for (const [name, kinds] of expected.args) {
    const actualKinds = actual.args.get(name);
    if (actualKinds) {
      // A plain argument may become a plural where a noun has to agree with
      // it, but a plural or select has to stay one.
      for (const kind of [TYPE.plural, TYPE.select]) {
        if (kinds.has(kind) && !actualKinds.has(kind)) {
          problems.push(`{${name}} is no longer a ${TYPE[kind]}`);
        }
      }
    } else {
      problems.push(`missing {${name}}`);
    }
  }
  for (const name of actual.args.keys()) {
    if (!expected.args.has(name)) {
      problems.push(`unknown argument {${name}}`);
    }
  }
  return problems;
}

function tagProblems(expected: Shape, actual: Shape): string[] {
  return [
    ...[...expected.tags]
      .filter((tag) => !actual.tags.has(tag))
      .map((tag) => `missing <${tag}>`),
    ...[...actual.tags]
      .filter((tag) => !expected.tags.has(tag))
      .map((tag) => `unknown tag <${tag}>`),
  ];
}

// A missing category isn't checked: counts fall back to `other`, which is
// correct wherever the language uses the same form (Turkish "1 adım", "5 adım").
// The translator still writes every category the target language has.
function pluralKeyProblems(el: Branching): string[] {
  const invalid = Object.keys(el.options).filter(
    (key) => !(EXACT_KEY.test(key) || PLURAL_CATEGORIES.includes(key))
  );
  return invalid.length > 0
    ? [`{${el.value}} has invalid plural keys: ${invalid.join(", ")}`]
    : [];
}

/** Problems that would make `translation` render wrongly in place of `source`; empty when it is safe to ship. */
export function checkMessage(source: string, translation: string): string[] {
  let ast: MessageFormatElement[];
  try {
    ast = parse(translation);
  } catch (error) {
    return [`does not parse (${(error as Error).message})`];
  }
  const expected = shapeOf(parse(source));
  const actual = shapeOf(ast);
  return [
    ...argumentProblems(expected, actual),
    ...tagProblems(expected, actual),
    ...actual.branchings.flatMap((el) =>
      el.type === TYPE.plural ? pluralKeyProblems(el) : []
    ),
  ];
}

/** Spells out `#` as `{arg, number}`, for text that is about to move inside a different plural or a select. */
function replacePounds(
  seq: MessageFormatElement[],
  arg: string
): MessageFormatElement[] {
  return seq.map((el) => {
    if (el.type === TYPE.pound) {
      return { style: null, type: TYPE.number, value: arg };
    }
    if (el.type === TYPE.tag) {
      return { ...el, children: replacePounds(el.children, arg) };
    }
    return el;
  });
}

function liftFromTag(tag: TagElement, pluralArg?: string): Branching {
  const [branching] = hoist(tag.children, pluralArg) as [Branching];
  return mapOptions(branching, (value) => [{ ...tag, children: value }]);
}

/** Moves plurals and selects to the front until each branch holds a whole sentence. */
function hoist(
  seq: MessageFormatElement[],
  pluralArg?: string
): MessageFormatElement[] {
  const index = seq.findIndex(hasBranching);
  if (index === -1) {
    return seq;
  }
  const found = seq[index] as MessageFormatElement;
  const branching = isBranching(found)
    ? found
    : liftFromTag(found as TagElement, pluralArg);
  // `#` around the branching counts the enclosing plural, but inside a
  // nested plural it would count that one and inside a select it is plain text.
  const around = (part: MessageFormatElement[]) =>
    pluralArg ? replacePounds(part, pluralArg) : part;
  const before = around(seq.slice(0, index));
  const after = around(seq.slice(index + 1));
  const inner = branching.type === TYPE.plural ? branching.value : pluralArg;
  return [
    mapOptions(branching, (value) =>
      hoist([...before, ...value, ...after], inner)
    ),
  ];
}

/** The branches the target language needs, each with the English text to translate and the count `#` stands for. */
function targetBranches(el: Branching, locale: string): Branch[] {
  if (el.type === TYPE.select) {
    return Object.entries(el.options).map(([key, option]) => [
      key,
      option.value,
    ]);
  }
  const exact = Object.entries(el.options)
    .filter(([key]) => EXACT_KEY.test(key))
    .map(([key, option]): Branch => [key, option.value, Number(key.slice(1))]);
  const samples = categorySamples(el, locale);
  const categories = PLURAL_CATEGORIES.filter(
    (category) => category === "other" || samples.has(category)
  ).map((category): Branch => {
    const option = el.options[category] ?? el.options.other;
    return [category, option?.value ?? [], samples.get(category)];
  });
  return [...exact, ...categories];
}

/** Writes `{arg}` as `#` inside arg's own plural, so it gets a sample count rather than a placeholder. */
function argAsPound(
  seq: MessageFormatElement[],
  arg: string
): MessageFormatElement[] {
  return seq.map((el) => {
    if (el.type === TYPE.argument && el.value === arg) {
      return { type: TYPE.pound };
    }
    if (el.type === TYPE.tag) {
      return { ...el, children: argAsPound(el.children, arg) };
    }
    return el;
  });
}

function plan(
  seq: MessageFormatElement[],
  locale: string,
  leaves: Leaf[],
  plural?: { arg: string; sample?: number }
): PlanNode {
  const [first] = seq;
  if (seq.length === 1 && first && isBranching(first)) {
    const arg = first.type === TYPE.plural ? first.value : undefined;
    const branches = targetBranches(first, locale).map(
      ([key, value, sample]): [string, PlanNode] => [
        key,
        plan(value, locale, leaves, arg ? { arg, sample } : undefined),
      ]
    );
    return { branches, branching: first };
  }
  const leaf: Leaf = plural
    ? { sample: plural.sample, seq: argAsPound(seq, plural.arg) }
    : { seq };
  leaves.push(leaf);
  return { leaf };
}

function assemble(node: PlanNode): MessageFormatElement[] {
  if ("leaf" in node) {
    return node.leaf.result ?? node.leaf.seq;
  }
  const options = Object.fromEntries(
    node.branches.map(([key, child]) => [key, { value: assemble(child) }])
  );
  return [{ ...node.branching, options }];
}

function countPounds(seq: MessageFormatElement[]): number {
  return seq.reduce((count, el) => {
    if (el.type === TYPE.pound) {
      return count + 1;
    }
    return el.type === TYPE.tag ? count + countPounds(el.children) : count;
  }, 0);
}

function literalText(seq: MessageFormatElement[]): string {
  return seq
    .map((el) => {
      if (el.type === TYPE.literal) {
        return el.value;
      }
      return el.type === TYPE.tag ? literalText(el.children) : " ";
    })
    .join("");
}

/** Matches the sample count as a whole number, with either decimal separator since DeepL writes 1.5 as "1,5" where that is local style. */
function standalone(n: number): RegExp {
  const digits = String(n).replace(".", "[.,]");
  return new RegExp(`(?<!\\d|\\d[.,])${digits}(?!\\d|[.,]\\d)`, "g");
}

function escapeXml(text: string): string {
  return text.replace(XML_SPECIAL, (char) => XML_ESCAPES[char] ?? char);
}

function unescapeXml(text: string): string {
  return text.replace(XML_ENTITY, (_, entity: string) => {
    const name = entity.toLowerCase();
    if (name in NAMED_ENTITIES) {
      return NAMED_ENTITIES[name] ?? "";
    }
    const isHex = name.startsWith("#x");
    return String.fromCodePoint(
      Number.parseInt(name.slice(isHex ? 2 : 1), isHex ? 16 : 10)
    );
  });
}

function toXml(
  seq: MessageFormatElement[],
  slots: MessageFormatElement[],
  sample?: number
): string {
  return seq
    .map((el) => {
      if (el.type === TYPE.literal) {
        return escapeXml(el.value);
      }
      if (el.type === TYPE.pound && sample !== undefined) {
        return String(sample);
      }
      const index = slots.push(el) - 1;
      if (el.type === TYPE.tag) {
        return `<t i="${index}">${toXml(el.children, slots, sample)}</t>`;
      }
      return `<x i="${index}"/>`;
    })
    .join("");
}

function pushLiteral(seq: MessageFormatElement[], text: string): void {
  if (text === "") {
    return;
  }
  const value = unescapeXml(text);
  const last = seq.at(-1);
  if (last?.type === TYPE.literal) {
    last.value += value;
  } else {
    seq.push({ type: TYPE.literal, value });
  }
}

/** Turns DeepL's output back into ICU elements, restoring the arguments and tags each placeholder stands for. */
function fromXml(
  xml: string,
  slots: MessageFormatElement[]
): MessageFormatElement[] {
  const root: MessageFormatElement[] = [];
  const open: { parent: MessageFormatElement[]; tag: TagElement }[] = [];
  let current = root;
  let cursor = 0;
  for (const match of xml.matchAll(PLACEHOLDER)) {
    pushLiteral(current, xml.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const [token, kind, index] = match;
    const slot = slots[Number(index)];
    if (token === "</t>") {
      const frame = open.pop();
      if (!frame) {
        throw new Error(`Unbalanced placeholders in "${xml}"`);
      }
      frame.parent.push({ ...frame.tag, children: current });
      current = frame.parent;
    } else if (kind === "t" && slot?.type === TYPE.tag) {
      open.push({ parent: current, tag: slot });
      current = [];
    } else if (kind === "x" && slot && slot.type !== TYPE.tag) {
      current.push(slot);
    } else {
      throw new Error(`Unknown placeholder ${token} in "${xml}"`);
    }
  }
  if (open.length > 0) {
    throw new Error(`Unbalanced placeholders in "${xml}"`);
  }
  pushLiteral(current, xml.slice(cursor));
  return root;
}

/** Turns the sample count back into `#`, or returns undefined when DeepL didn't keep it exactly once per `#`. */
function restorePounds(
  seq: MessageFormatElement[],
  sample: number,
  expected: number
): MessageFormatElement[] | undefined {
  const pattern = standalone(sample);
  let found = 0;
  const walk = (elements: MessageFormatElement[]): MessageFormatElement[] =>
    elements.flatMap((el): MessageFormatElement[] => {
      if (el.type === TYPE.tag) {
        return [{ ...el, children: walk(el.children) }];
      }
      if (el.type !== TYPE.literal) {
        return [el];
      }
      return el.value.split(pattern).flatMap((text, index) => {
        const parts: MessageFormatElement[] = [];
        if (index > 0) {
          found += 1;
          parts.push({ type: TYPE.pound });
        }
        if (text !== "") {
          parts.push({ type: TYPE.literal, value: text });
        }
        return parts;
      });
    });
  const result = walk(seq);
  return found === expected ? result : undefined;
}

async function translateLeaves(
  leaves: Leaf[],
  translate: TranslateBatch
): Promise<void> {
  // DeepL rejects an empty batch.
  if (leaves.length === 0) {
    return;
  }
  const requests = leaves.map((leaf) => {
    const slots: MessageFormatElement[] = [];
    return { leaf, slots, xml: toXml(leaf.seq, slots, leaf.sample) };
  });
  const texts = await translate(requests.map((request) => request.xml));
  requests.forEach(({ leaf, slots }, index) => {
    const seq = fromXml(texts[index] ?? "", slots);
    leaf.result =
      leaf.sample === undefined
        ? seq
        : restorePounds(seq, leaf.sample, countPounds(leaf.seq));
  });
}

/** Translates one ICU message without letting the translator touch its syntax. Throws if the result fails `checkMessage`. */
export async function translateMessage(
  source: string,
  locale: string,
  translate: TranslateBatch
): Promise<string> {
  const leaves: Leaf[] = [];
  const tree = plan(hoist(parse(source)), locale, leaves);
  const pending = leaves.filter((leaf) => {
    const text = literalText(leaf.seq);
    // Nothing to translate in text like "{answered}/{total}".
    if (!LETTER.test(text)) {
      leaf.result = leaf.seq;
      return false;
    }
    if (
      leaf.sample !== undefined &&
      (countPounds(leaf.seq) === 0 || standalone(leaf.sample).test(text))
    ) {
      leaf.sample = undefined;
    }
    return true;
  });
  await translateLeaves(pending, translate);
  // Where the translator rewrote the sample count (say "1" as "one"), translate again with `#` as a placeholder.
  const retry = pending.filter((leaf) => !leaf.result);
  for (const leaf of retry) {
    leaf.sample = undefined;
  }
  await translateLeaves(retry, translate);
  const translation = printMessage(assemble(tree));
  const problems = checkMessage(source, translation);
  if (problems.length > 0) {
    throw new Error(`${problems.join("; ")} in "${translation}"`);
  }
  return translation;
}

function printBranching(el: Branching): string {
  const isPlural = el.type === TYPE.plural;
  let header = "select";
  if (isPlural) {
    header = el.pluralType === "ordinal" ? "selectordinal" : "plural";
    if (el.offset) {
      header += `, offset:${el.offset}`;
    }
  }
  const options = Object.entries(el.options)
    .map(([key, option]) => `${key} {${printMessage(option.value, isPlural)}}`)
    .join(" ");
  return `{${el.value}, ${header}, ${options}}`;
}

/** Prints like the formatjs printer, with the `{count, plural, one {...}}` spacing our catalogs use. */
function printMessage(ast: MessageFormatElement[], inPlural = false): string {
  const branchings = ast.filter(isBranching);
  const flat = ast.map(
    (el): MessageFormatElement =>
      isBranching(el) ? { type: TYPE.literal, value: BRANCH_SLOT } : el
  );
  return doPrintAST(flat, inPlural)
    .split(BRANCH_SLOT)
    .reduce((out, part, index) => {
      const branching = branchings[index - 1];
      return `${out}${branching ? printBranching(branching) : ""}${part}`;
    });
}
