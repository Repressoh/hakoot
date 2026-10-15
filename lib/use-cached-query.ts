"use client";

import { type OptionalRestArgsOrSkip, useConvex, useQuery } from "convex/react";
import {
  type FunctionReference,
  type FunctionReturnType,
  getFunctionName,
  makeFunctionReference,
} from "convex/server";
import {
  convexToJson,
  type JSONValue,
  jsonToConvex,
  type Value,
} from "convex/values";
import { useEffect } from "react";

/** How long a screen's data stays subscribed after the screen closes. */
const KEEP_ALIVE_MS = 5 * 60 * 1000;

interface HeldQuery {
  release: () => void;
  /** Set once closed: a later cleanup of a component that used it must not touch it again. */
  released: boolean;
  timer?: ReturnType<typeof setTimeout>;
  users: number;
}

const heldQueries = new Map<string, HeldQuery>();

function releaseHeldQuery(key: string, held: HeldQuery) {
  clearTimeout(held.timer);
  held.released = true;
  held.release();
  if (heldQueries.get(key) === held) {
    heldQueries.delete(key);
  }
}

/**
 * Close every subscription kept open by `useCachedQuery`. Call it on sign-out: they would otherwise
 * keep re-running, signed out, for up to KEEP_ALIVE_MS.
 */
export function releaseCachedQueries(): void {
  for (const [key, held] of heldQueries) {
    releaseHeldQuery(key, held);
  }
}

/**
 * Subscribe to query `name` with `argsJson` (its arguments, JSON-encoded) until no component uses
 * it for KEEP_ALIVE_MS.
 */
function holdQuery(
  convex: ReturnType<typeof useConvex>,
  name: string,
  argsJson: string
): () => void {
  const key = `${name}:${argsJson}`;
  let held = heldQueries.get(key);
  if (held === undefined) {
    const args = jsonToConvex(JSON.parse(argsJson) as JSONValue);
    const watch = convex.watchQuery(
      makeFunctionReference<"query">(name),
      args as Record<string, Value>
    );
    held = {
      release: watch.onUpdate(() => undefined),
      released: false,
      users: 0,
    };
    heldQueries.set(key, held);
  }
  const current = held;
  clearTimeout(current.timer);
  current.users += 1;
  return () => {
    if (current.released) {
      return;
    }
    current.users -= 1;
    if (current.users === 0) {
      current.timer = setTimeout(
        () => releaseHeldQuery(key, current),
        KEEP_ALIVE_MS
      );
    }
  };
}

/**
 * `useQuery` whose subscription stays open for a few minutes after the component unmounts, so
 * going back to a screen renders its data at once from the client's cache instead of showing a
 * skeleton while it is fetched again. Like `useQuery`, pass `"skip"` as the arguments to not
 * subscribe.
 */
export function useCachedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): FunctionReturnType<Query> | undefined {
  const convex = useConvex();
  const skip = args[0] === "skip";
  const queryArgs = (skip ? {} : (args[0] ?? {})) as Record<string, Value>;
  const name = getFunctionName(query);
  const argsJson = JSON.stringify(convexToJson(queryArgs));

  useEffect(
    () => (skip ? undefined : holdQuery(convex, name, argsJson)),
    [convex, name, argsJson, skip]
  );

  // Arguments passed as one value: the React Compiler can't optimize a hook
  // called with spread arguments.
  return useQuery(
    query as FunctionReference<"query">,
    skip ? "skip" : queryArgs
  ) as FunctionReturnType<Query> | undefined;
}
