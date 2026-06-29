/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as authFlows from "../authFlows.js";
import type * as crons from "../crons.js";
import type * as emailLists from "../emailLists.js";
import type * as emails from "../emails.js";
import type * as games from "../games.js";
import type * as http from "../http.js";
import type * as lib_inviteTokens from "../lib/inviteTokens.js";
import type * as lib_passwordAuthorize from "../lib/passwordAuthorize.js";
import type * as lib_turnstile from "../lib/turnstile.js";
import type * as sessions from "../sessions.js";
import type * as steps from "../steps.js";
import type * as turnstilePasses from "../turnstilePasses.js";
import type * as users from "../users.js";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  authFlows: typeof authFlows;
  crons: typeof crons;
  emailLists: typeof emailLists;
  emails: typeof emails;
  games: typeof games;
  http: typeof http;
  "lib/inviteTokens": typeof lib_inviteTokens;
  "lib/passwordAuthorize": typeof lib_passwordAuthorize;
  "lib/turnstile": typeof lib_turnstile;
  sessions: typeof sessions;
  steps: typeof steps;
  turnstilePasses: typeof turnstilePasses;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
