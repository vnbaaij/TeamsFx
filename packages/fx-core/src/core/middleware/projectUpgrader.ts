import { Middleware, NextFunction } from "@feathersjs/hooks";
import { ConfigFolderName, err, Inputs, Json, ProjectSettings } from "@microsoft/teamsfx-api";
import {
  ContextUpgradeError,
  CoreHookContext,
  FxCore,
  NoProjectOpenedError,
  PathNotExistError,
} from "..";
import * as fs from "fs-extra";
import * as path from "path";
import * as uuid from "uuid";
import { dataNeedEncryption, deserializeDict, serializeDict } from "../..";
import { LocalCrypto } from "../crypto";

const resourceContext = [
  {
    plugin: "fx-resource-aad-app-for-teams",
    secret: "local_clientSecret",
    relatedKeys: [
      "local_clientId",
      "local_objectId",
      "local_oauth2PermissionScopeId",
      "local_tenantId",
      "local_applicationIdUris",
    ],
  },
  {
    plugin: "fx-resource-bot",
    secret: "localBotPassword",
    relatedKeys: ["localBotId", "localObjectId", "local_redirectUri", "bots", "composeExtensions"],
  },
];

const solutionContext = {
  plugin: "solution",
  relatedKeys: ["localDebugTeamsAppId", "teamsAppTenantId"],
};

export const ProjectUpgraderMW: Middleware = async (ctx: CoreHookContext, next: NextFunction) => {
  await upgradeContext(ctx);
  await next();
};

// This part is for update context and userdata file to support better local debug experience.
export async function upgradeContext(ctx: CoreHookContext): Promise<void> {
  try {
    const inputs = ctx.arguments[ctx.arguments.length - 1] as Inputs;
    if (!inputs.projectPath) {
      ctx.result = err(NoProjectOpenedError());
      return;
    }
    const projectPathExist = await fs.pathExists(inputs.projectPath);
    if (!projectPathExist) {
      ctx.result = err(PathNotExistError(inputs.projectPath));
      return;
    }
    const confFolderPath = path.resolve(inputs.projectPath!, `.${ConfigFolderName}`);
    const settingsFile = path.resolve(confFolderPath, "settings.json");
    const projectSettings: ProjectSettings = await fs.readJson(settingsFile);
    if (!projectSettings.currentEnv) {
      projectSettings.currentEnv = "default";
    }

    // Read context file.
    const contextPath = path.resolve(confFolderPath, `env.${projectSettings.currentEnv}.json`);
    const context = await readContext(contextPath);

    // Update value of specific key in context file to secret pattern.
    // Return: map of updated values.
    const updatedKeys = updateContextValue(context);
    if (!updatedKeys || updatedKeys.size == 0) {
      // No keys need to be updated, which means the file is up-to-date.
      // Can quit directly.
      return;
    }

    // Some keys updated.
    // Read UserData file.
    const userDataPath = path.resolve(confFolderPath, `${projectSettings.currentEnv}.userdata`);
    const userData = await readUserData(userDataPath, projectSettings.projectId);

    // Merge updatedKeys into UserData.
    mergeKeysToUserDate(userData, updatedKeys);

    // Save the updated context and UserData.
    await saveContext(contextPath, context);
    await saveUserData(userDataPath, userData, projectSettings.projectId);

    // Send log.
    const core = ctx.self as FxCore;
    core?.tools?.logProvider?.info(
      "[core]: template version is too low. Updated context and moved some configs from env to userdata."
    );
  } catch (error) {
    ctx.result = err(ContextUpgradeError(error));
  }
}

// TODO: add readUserData as basic API in core since used in multiple places.
async function readUserData(
  userDataPath: string,
  projectId?: string
): Promise<Record<string, string>> {
  let dict: Record<string, string> = {};
  if (await fs.pathExists(userDataPath)) {
    const dictContent = await fs.readFile(userDataPath, "UTF-8");
    dict = deserializeDict(dictContent);
  }

  if (projectId) {
    const cryptoProvider = new LocalCrypto(projectId);
    for (const secretKey of Object.keys(dict)) {
      if (!dataNeedEncryption(secretKey)) {
        continue;
      }
      const secretValue = dict[secretKey];
      const plaintext = cryptoProvider.decrypt(secretValue);
      if (plaintext.isErr()) {
        throw plaintext.error;
      }
      dict[secretKey] = plaintext.value;
    }
  }

  return dict;
}

// TODO: add saveUserData as basic API in core since used in multiple places.
async function saveUserData(
  userDataPath: string,
  userData: Record<string, string>,
  projectId?: string
): Promise<void> {
  if (projectId) {
    const cryptoProvider = new LocalCrypto(projectId);
    for (const secretKey of Object.keys(userData)) {
      if (!dataNeedEncryption(secretKey)) {
        continue;
      }

      const encryptedSecret = cryptoProvider.encrypt(userData[secretKey]);
      if (encryptedSecret.isOk()) {
        userData[secretKey] = encryptedSecret.value;
      }
    }
  }
  await fs.writeFile(userDataPath, serializeDict(userData));
}

async function readContext(contextPath: string): Promise<Json> {
  const configJson: Json = await fs.readJson(contextPath);
  return configJson;
}

async function saveContext(contextPath: string, context: Json): Promise<void> {
  await fs.writeFile(contextPath, JSON.stringify(context, null, 4));
}

function updateContextValue(context: Json): Map<string, any> {
  const res: Map<string, any> = new Map();

  // Update resource context.
  for (const item of resourceContext) {
    const pluginContext: any = context[item.plugin];
    if (!pluginContext) {
      continue;
    }

    for (const key of item.relatedKeys) {
      // Save value to res and update value to secret pattern if value is not in secret pattern.
      if (pluginContext[key] && !isSecretPattern(pluginContext[key])) {
        res.set(getUserDataKey(item.plugin, key), pluginContext[key]);
        pluginContext[key] = getSecretPattern(item.plugin, key);
      }
    }
  }

  // Update solution context.
  const pluginContext: any = context[solutionContext.plugin];
  for (const key of solutionContext.relatedKeys) {
    if (pluginContext[key] && !isSecretPattern(pluginContext[key])) {
      res.set(getUserDataKey(solutionContext.plugin, key), pluginContext[key]);
      pluginContext[key] = getSecretPattern(solutionContext.plugin, key);
    }
  }

  return res;
}

function mergeKeysToUserDate(
  userData: Record<string, string>,
  updatedKeys: Map<string, any>
): void {
  // Move resource context first to userdata
  let moved = false;
  for (const item of resourceContext) {
    // Check whether corresponding secret exists.
    if (!userData[getUserDataKey(item.plugin, item.secret)]) {
      continue;
    }

    for (const key of item.relatedKeys) {
      const userDataKey = getUserDataKey(item.plugin, key);
      // Merge will only happen when userData does not contain certain key.
      // Otherwise, value in userData will be regarded as source of truth.
      if (!userData[userDataKey] && updatedKeys.has(userDataKey)) {
        moved = true;
        userData[userDataKey] = updatedKeys.get(userDataKey);
      }
    }
  }

  // If any key moved, means at least one secret exists.
  // Move solution context.
  if (moved) {
    for (const key of solutionContext.relatedKeys) {
      const userDataKey = getUserDataKey(solutionContext.plugin, key);
      if (!userData[userDataKey] && updatedKeys.has(userDataKey)) {
        userData[userDataKey] = updatedKeys.get(userDataKey);
      }
    }
  }
}

function getUserDataKey(plugin: string, key: string) {
  return `${plugin}.${key}`;
}

function isSecretPattern(value: string) {
  return value.startsWith("{{") && value.endsWith("}}");
}

function getSecretPattern(plugin: string, key: string) {
  return `{{${getUserDataKey(plugin, key)}}}`;
}