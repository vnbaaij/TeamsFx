// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Json, SolutionSettings } from "../types";

export enum RuntimeStacks {
  DoNet_6_EA = ".NET 6(Early Access)",
  DoNet_5 = ".NET 5",
  DoNet_Core_3_1 = ".NET Core 3.1(LTS)",
  ASP_DoNET_V48 = "ASP.NET V4.8",
  ASP_DoNET_V35 = "ASP.NET V3.5",
  Node12LTS = "Node 12 LTS",
  Node14LTS = "Node 14 LTS",
}

export interface Module extends Json {
  runtimeStack: RuntimeStacks;
  language: string;
  resources: string[];
  /**
   * subfolder name
   */
  subFolderName?: string;
}

export interface Resource extends Json {
  /**
   * unique name
   */
  name: string;
  /**
   * plugin name
   */
  provider?: string;
  /**
   * runtime stack
   */
  runtimeStack?: RuntimeStacks;
  /**
   * sub folder for code generated by resource provider
   */
  subFolderName?: string;
  /**
   * build folder for deploy
   */
  buildFolder?: string;

  language?: string;

  /**
   * resource ids that current resource depends on
   */
  resources?: string[];
}

export interface TeamsFxSolutionSettings extends SolutionSettings {
  tab?: Module;
  bot?: Module;
  resources?: Resource[];
}

/**
 * case1: nodejs tab + nodejs bot + function + sql + simpleauth + aad
 */
const settings1: TeamsFxSolutionSettings = {
  name: "TeamsFxSolutionPlugin",
  tab: {
    runtimeStack: RuntimeStacks.Node12LTS,
    language: "javascript",
    subFolderName: "tabs",
    resources: ["AzureStorageAccount_1"],
  },
  bot: {
    runtimeStack: RuntimeStacks.Node12LTS,
    language: "javascript",
    subFolderName: "bot",
    resources: ["AzureBot_1", "AzureWebApp_1"],
  },
  resources: [
    {
      name: "AzureStorageAccount_1",
      provider: "AzureStorageAccountPlugin",
    },
    {
      name: "AzureBot_1",
      provider: "AzureBotPlugin",
    },
    {
      name: "AzureWebApp_1",
      provider: "AzureWebAppPlugin",
    },
    {
      name: "AzureFunction_1",
      runtimeStack: RuntimeStacks.Node12LTS,
      language: "javascript",
      subFolderName: "api",
      provider: "AzureFunctionPlugin",
    },
    {
      name: "SimpleAuth",
      provider: "SimpleAuthPlugin",
      resources: ["AzureWebApp_1"],
    },
    {
      name: "AAD",
      provider: "AADPlugin",
    },
    {
      name: "AzureSQL_1",
      provider: "AzureSQLPlugin",
    },
    {
      name: "AzureSQL_2",
      provider: "AzureSQLPlugin",
    },
    {
      name: "ManagedIdentity_1",
      provider: "ManagedIdentityPlugin",
    },
  ],
};

/**
 * csharp tab + csharp bot (share the same web app)
 */
const settings2: TeamsFxSolutionSettings = {
  name: "TeamsFxSolutionPlugin",
  tab: {
    runtimeStack: RuntimeStacks.DoNet_5,
    language: "csharp",
    subFolderName: "tabs",
    resources: ["AzureWebApp_1"],
  },
  bot: {
    runtimeStack: RuntimeStacks.DoNet_5,
    language: "csharp",
    subFolderName: "bot",
    resources: ["AzureBot_1", "AzureWebApp_1"],
  },
  resources: [
    {
      name: "AzureBot_1",
      type: "AzureBot",
      bicepFile: "templates/${name}/default.bicep",
      // outputFile: "templates/${name}/output.${env}.bicep",   specification
    },
    {
      name: "AzureWebApp_1",
      type: "AzureWebApp",
      bicepFile: "xxx",
    },
  ],
};

/**
 * csharp tab + csharp bot (don't share the same web app)
 */
const settings3: TeamsFxSolutionSettings = {
  name: "TeamsFxSolutionPlugin",
  tab: {
    runtimeStack: RuntimeStacks.DoNet_5,
    language: "csharp",
    subFolderName: "tabs",
    resources: ["AzureWebApp_1"],
  },
  bot: {
    runtimeStack: RuntimeStacks.DoNet_5,
    language: "csharp",
    subFolderName: "bot",
    resources: ["AzureBot_1", "AzureWebApp_2"],
  },
  resources: [
    {
      name: "AzureBot_1",
      provider: "AzureBotPlugin",
    },
    {
      name: "AzureWebApp_1",
      provider: "AzureWebAppPlugin",
    },
    {
      name: "AzureWebApp_2",
      provider: "AzureWebAppPlugin",
    },
  ],
};
