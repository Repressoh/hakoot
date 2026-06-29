import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import type { PasswordConfig } from "@convex-dev/auth/providers/Password";
import type { GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import {
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from "@convex-dev/auth/server";
import type { GenericDataModel } from "convex/server";
import type { Value } from "convex/values";
import { Scrypt } from "lucia";
import { verifyTurnstileToken } from "./turnstile";

type TurnstilePasswordConfig<DataModel extends GenericDataModel> =
  PasswordConfig<DataModel> & {
    provider?: string;
  };

function validatePassword<DataModel extends GenericDataModel>(
  password: string | null,
  config: TurnstilePasswordConfig<DataModel>
) {
  if (password === null) {
    return;
  }
  if (config.validatePasswordRequirements) {
    config.validatePasswordRequirements(password);
    return;
  }
  validateDefaultPasswordRequirements(password);
}

function validateDefaultPasswordRequirements(password: string) {
  if (!password || password.length < 8) {
    throw new Error("Invalid password");
  }
}

function defaultProfile(params: Record<string, unknown>) {
  return {
    email: params.email as string,
  };
}

function getPasswordToValidate(
  flow: string,
  params: Partial<Record<string, Value | undefined>>
): string | null {
  if (flow === "signUp") {
    return params.password as string;
  }
  if (flow === "reset-verification") {
    return params.newPassword as string;
  }
  return null;
}

export async function authorizePasswordWithTurnstile<
  DataModel extends GenericDataModel,
>(
  params: Partial<Record<string, Value | undefined>>,
  ctx: GenericActionCtxWithAuthConfig<DataModel>,
  config: TurnstilePasswordConfig<DataModel>
) {
  const flow = params.flow as string;
  if (flow === "signUp" || flow === "signIn") {
    await verifyTurnstileToken(params.turnstileToken as string | undefined);
  }

  const provider = config.provider ?? "password";
  validatePassword(getPasswordToValidate(flow, params), config);

  const profile = config.profile?.(params, ctx) ?? defaultProfile(params);
  const { email } = profile;

  if (flow === "signUp") {
    return signUpFlow(ctx, params, profile, provider);
  }
  if (flow === "signIn") {
    return signInFlow(ctx, params, email, provider);
  }
  if (flow === "reset") {
    return resetFlow(ctx, params, email, provider, config);
  }
  if (flow === "reset-verification") {
    return resetVerificationFlow(ctx, params, email, provider, config);
  }

  throw new Error(
    'Missing `flow` param, it must be one of "signUp", "signIn", "reset", or "reset-verification"!'
  );
}

async function signUpFlow<DataModel extends GenericDataModel>(
  ctx: GenericActionCtxWithAuthConfig<DataModel>,
  params: Partial<Record<string, Value | undefined>>,
  profile: { email: string; name?: string },
  provider: string
) {
  const secret = params.password as string | undefined;
  if (secret === undefined) {
    throw new Error("Missing `password` param for `signUp` flow");
  }
  const created = await createAccount(ctx, {
    provider,
    account: { id: profile.email, secret },
    profile: profile as never,
    shouldLinkViaEmail: false,
    shouldLinkViaPhone: false,
  });
  return { userId: created.user._id };
}

async function signInFlow<DataModel extends GenericDataModel>(
  ctx: GenericActionCtxWithAuthConfig<DataModel>,
  params: Partial<Record<string, Value | undefined>>,
  email: string,
  provider: string
) {
  const secret = params.password as string | undefined;
  if (secret === undefined) {
    throw new Error("Missing `password` param for `signIn` flow");
  }
  const retrieved = await retrieveAccount(ctx, {
    provider,
    account: { id: email, secret },
  });
  if (retrieved === null) {
    throw new Error("Invalid credentials");
  }
  return { userId: retrieved.user._id };
}

async function resetFlow<DataModel extends GenericDataModel>(
  ctx: GenericActionCtxWithAuthConfig<DataModel>,
  params: Partial<Record<string, Value | undefined>>,
  email: string,
  provider: string,
  config: TurnstilePasswordConfig<DataModel>
) {
  if (!config.reset) {
    throw new Error(`Password reset is not enabled for ${provider}`);
  }
  const { account } = await retrieveAccount(ctx, {
    provider,
    account: { id: email },
  });
  return await signInViaProvider(ctx, config.reset, {
    accountId: account._id,
    params,
  });
}

async function resetVerificationFlow<DataModel extends GenericDataModel>(
  ctx: GenericActionCtxWithAuthConfig<DataModel>,
  params: Partial<Record<string, Value | undefined>>,
  email: string,
  provider: string,
  config: TurnstilePasswordConfig<DataModel>
) {
  if (!config.reset) {
    throw new Error(`Password reset is not enabled for ${provider}`);
  }
  if (params.newPassword === undefined) {
    throw new Error(
      "Missing `newPassword` param for `reset-verification` flow"
    );
  }
  const { account: resetAccount } = await retrieveAccount(ctx, {
    provider,
    account: { id: email },
  });
  const result = await signInViaProvider(ctx, config.reset, { params });
  if (result === null) {
    throw new Error("Invalid code");
  }
  const { userId, sessionId } = result;
  if (resetAccount.userId !== userId) {
    throw new Error("Invalid code");
  }
  await modifyAccountCredentials(ctx, {
    provider,
    account: { id: email, secret: params.newPassword as string },
  });
  await invalidateSessions(ctx, { userId, except: [sessionId] });
  return { userId, sessionId };
}

export const passwordCrypto = {
  async hashSecret(password: string) {
    return await new Scrypt().hash(password);
  },
  async verifySecret(password: string, hash: string) {
    return await new Scrypt().verify(hash, password);
  },
};

export function PasswordWithTurnstile<DataModel extends GenericDataModel>(
  config: PasswordConfig<DataModel> = {}
) {
  const provider = config.id ?? "password";
  return ConvexCredentials<DataModel>({
    id: "password",
    authorize: (params, ctx) =>
      authorizePasswordWithTurnstile(params, ctx, {
        ...config,
        provider,
      }),
    crypto: config.crypto ?? passwordCrypto,
    extraProviders: [config.reset, config.verify],
  });
}
