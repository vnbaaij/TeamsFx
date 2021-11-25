// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

"use strict";

import fs from "fs-extra";
import os from "os";
import path from "path";
import { Argv } from "yargs";

import { Colors, FxError, Json, LogLevel, ok, Question, Result } from "@microsoft/teamsfx-api";

import { YargsCommand } from "../yargsCommand";
import AppStudioTokenProvider from "../commonlib/appStudioLogin";
import AzureTokenProvider from "../commonlib/azureLogin";
import GraphTokenProvider from "../commonlib/graphLogin";
import { signedIn } from "../commonlib/common/constant";
import CLILogProvider from "../commonlib/log";
import * as constants from "../constants";
import { getColorizedString, setSubscriptionId, toLocaleLowerCase, toYargsOptions } from "../utils";

/// TODO: temp lines, need to remove.
const fakeAccountFilePath = path.join(os.homedir(), ".fx", "account", "fakeAccount.json");
const fakeAccount: Json = {};

async function outputM365Info(commandType: "login" | "show"): Promise<boolean> {
  {
    /// TODO: temp lines, need to remove.
    const result = await AppStudioTokenProvider.getStatus();
    fakeAccount.AppStudioAccessToken = result.token;
    fakeAccount.AppStudioTokenJsonString = JSON.stringify(result.accountInfo);
  }
  const result = await AppStudioTokenProvider.getJsonObject();
  if (result) {
    if (commandType === "login") {
      const message = [
        {
          content: `[${constants.cliSource}] Successfully signed in to M365.`,
          color: Colors.BRIGHT_GREEN,
        },
        { content: " Your username is ", color: Colors.BRIGHT_WHITE },
        { content: (result as any).upn, color: Colors.BRIGHT_MAGENTA },
      ];
      CLILogProvider.necessaryLog(LogLevel.Info, getColorizedString(message));
    } else {
      const message = [
        { content: `[${constants.cliSource}] Your M365 Account is: `, color: Colors.BRIGHT_WHITE },
        { content: (result as any).upn, color: Colors.BRIGHT_MAGENTA },
      ];
      CLILogProvider.necessaryLog(LogLevel.Info, getColorizedString(message));
    }
  } else {
    if (commandType === "login") {
      CLILogProvider.necessaryLog(
        LogLevel.Error,
        `[${constants.cliSource}] Failed to sign in to M365.`
      );
    }
  }
  {
    /// TODO: temp lines, need to remove.
    const token = await GraphTokenProvider.getAccessToken();
    const accountInfo = await GraphTokenProvider.getJsonObject();
    fakeAccount.GraphAccessToken = token;
    fakeAccount.GraphTokenJsonString = JSON.stringify(accountInfo);
  }
  return Promise.resolve(result !== undefined);
}

async function outputAzureInfo(commandType: "login" | "show", tenantId = ""): Promise<boolean> {
  const result = await AzureTokenProvider.getAccountCredentialAsync(true, tenantId);
  if (result) {
    const subscriptions = await AzureTokenProvider.listSubscriptions();
    if (commandType === "login") {
      const message = [
        {
          content: `[${constants.cliSource}] Successfully signed in to Azure.`,
          color: Colors.BRIGHT_GREEN,
        },
        { content: " Your username is ", color: Colors.BRIGHT_WHITE },
        { content: (result as any).username, color: Colors.BRIGHT_MAGENTA },
      ];
      CLILogProvider.necessaryLog(LogLevel.Info, getColorizedString(message));
      CLILogProvider.necessaryLog(
        LogLevel.Info,
        `[${constants.cliSource}] Your subscriptions are:`
      );
      CLILogProvider.necessaryLog(LogLevel.Info, JSON.stringify(subscriptions, null, 2), true);
    } else {
      try {
        AzureTokenProvider.setRootPath("./");
        const subscriptionInfo = await AzureTokenProvider.readSubscription();
        if (subscriptionInfo) {
          CLILogProvider.necessaryLog(
            LogLevel.Info,
            `[${constants.cliSource}] Your Azure Account is: ${CLILogProvider.white(
              (result as any).username
            )}` +
              ` and current active subscription id is: ${CLILogProvider.white(
                subscriptionInfo.subscriptionId
              )}.`
          );
        } else {
          CLILogProvider.necessaryLog(
            LogLevel.Info,
            `[${constants.cliSource}] Your Azure Account is: ${CLILogProvider.white(
              (result as any).username
            )}.`
          );
          CLILogProvider.necessaryLog(
            LogLevel.Info,
            `[${constants.cliSource}] Below is a list of all subscriptions we found,` +
              ` use \`teamsfx account set\` to set an active subscription.`
          );
          CLILogProvider.necessaryLog(LogLevel.Info, JSON.stringify(subscriptions, null, 2), true);
        }
      } catch (e) {
        if (e.name === "ConfigNotFound") {
          CLILogProvider.necessaryLog(
            LogLevel.Info,
            `[${constants.cliSource}] Your Azure Account is: ${CLILogProvider.white(
              (result as any).username
            )}.`
          );
          CLILogProvider.necessaryLog(
            LogLevel.Warning,
            "WARN：Azure subscription is set on project level. Run `teamsfx account show` command in a TeamsFx project folder to check active subscription information."
          );
        } else {
          throw e;
        }
      }
    }
  } else {
    if (commandType === "login") {
      CLILogProvider.necessaryLog(
        LogLevel.Error,
        `[${constants.cliSource}] Failed to sign in to Azure.`
      );
    }
  }
  return Promise.resolve(result !== undefined);
}

class AccountShow extends YargsCommand {
  public readonly commandHead = `show`;
  public readonly command = `${this.commandHead}`;
  public readonly description = "Display all connected cloud accounts information.";

  public builder(yargs: Argv): Argv<any> {
    return yargs;
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    const m365Status = await AppStudioTokenProvider.getStatus();
    if (m365Status.status === signedIn) {
      await outputM365Info("show");
    }

    const azureStatus = await AzureTokenProvider.getStatus();
    /// TODO: temp lines, need to remove.
    fakeAccount.AzureAccessToken = azureStatus.token;
    fakeAccount.AzureTokenJsonString = JSON.stringify(azureStatus.accountInfo);
    const subscriptions = await AzureTokenProvider.listSubscriptions();
    /// TODO: if this is not the usually used subscription, you can write hard code here.
    fakeAccount.AzureSubscriptionInfo = subscriptions[0];
    await fs.ensureDir(path.dirname(fakeAccountFilePath));
    await fs.writeJson(fakeAccountFilePath, fakeAccount, { spaces: 4, encoding: "utf-8" });

    if (azureStatus.status === signedIn) {
      await outputAzureInfo("show");
    }

    if (m365Status.status !== signedIn && azureStatus.status !== signedIn) {
      CLILogProvider.necessaryLog(
        LogLevel.Info,
        "Use `teamsfx account login azure` or `teamsfx account login m365` to log in to Azure or M365 account."
      );
    }

    return ok(null);
  }
}

class AccountLogin extends YargsCommand {
  public readonly commandHead = `login`;
  public readonly command = `${this.commandHead} <service>`;
  public readonly description = "Log in to the selected cloud service.";

  public builder(yargs: Argv): Argv<any> {
    return yargs
      .positional("service", {
        description: "Azure or M365",
        type: "string",
        choices: ["azure", "m365"],
        coerce: toLocaleLowerCase,
      })
      .options("tenant", {
        description: "Authenticate with a specific Azure Active Directory tenant.",
        type: "string",
        default: "",
      });
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    switch (args.service) {
      case "azure": {
        await AzureTokenProvider.signout();
        await outputAzureInfo("login", args.tenant);
        break;
      }
      case "m365": {
        await AppStudioTokenProvider.signout();
        await outputM365Info("login");
        break;
      }
    }
    return ok(null);
  }
}

class AccountLogout extends YargsCommand {
  public readonly commandHead = `logout`;
  public readonly command = `${this.commandHead} <service>`;
  public readonly description = "Log out of the selected cloud service.";

  public builder(yargs: Argv): Argv<any> {
    return yargs.positional("service", {
      description: "Azure or M365",
      type: "string",
      choices: ["azure", "m365"],
      coerce: toLocaleLowerCase,
    });
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    switch (args.service) {
      case "azure": {
        const result = await AzureTokenProvider.signout();
        if (result) {
          CLILogProvider.necessaryLog(
            LogLevel.Info,
            `[${constants.cliSource}] Successfully signed out of Azure.`
          );
        } else {
          CLILogProvider.necessaryLog(
            LogLevel.Error,
            `[${constants.cliSource}] Failed to sign out of Azure.`
          );
        }
        break;
      }
      case "m365": {
        const result = await AppStudioTokenProvider.signout();
        if (result) {
          CLILogProvider.necessaryLog(
            LogLevel.Info,
            `[${constants.cliSource}] Successfully signed out of M365.`
          );
        } else {
          CLILogProvider.necessaryLog(
            LogLevel.Error,
            `[${constants.cliSource}] Failed to sign out of M365.`
          );
        }
        break;
      }
    }
    return ok(null);
  }
}

class AccountSet extends YargsCommand {
  public readonly commandHead = `set`;
  public readonly command = `${this.commandHead}`;
  public readonly description = "Update account settings.";

  public builder(yargs: Argv): Argv<any> {
    const folderOption = toYargsOptions(constants.RootFolderNode.data as Question);
    const subsOption = toYargsOptions(constants.SubscriptionNode.data as Question);
    return yargs
      .options("folder", folderOption)
      .options("subscription", subsOption)
      .demandOption("subscription");
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    const result = await setSubscriptionId(args.subscription, args.folder);
    if (result.isErr()) {
      return result;
    }
    await outputAzureInfo("show");
    return ok(null);
  }
}

export default class Account extends YargsCommand {
  public readonly commandHead = `account`;
  public readonly command = `${this.commandHead} <action>`;
  public readonly description =
    "Manage cloud service accounts. The supported cloud services are 'Azure' and 'M365'.";

  public readonly subCommands: YargsCommand[] = [
    new AccountShow(),
    new AccountLogin(),
    new AccountLogout(),
    new AccountSet(),
  ];

  public builder(yargs: Argv): Argv<any> {
    yargs.options("action", {
      description: `${this.subCommands.map((cmd) => cmd.commandHead).join("|")}`,
      type: "string",
      choices: this.subCommands.map((cmd) => cmd.commandHead),
    });
    this.subCommands.forEach((cmd) => {
      yargs.command(cmd.command, cmd.description, cmd.builder.bind(cmd), cmd.handler.bind(cmd));
    });
    return yargs.version(false);
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    return ok(null);
  }
}
