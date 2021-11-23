// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Json } from "../types";

/////////////common part////////////////////////////

export interface CloudResource extends Json {
  type: string;
  name: string;
  resourceId: string; //resourceId
  resourceName: string;
  endpoint?: string;
  skuName?: string;
  secretFields?: string[];
}

export interface ResourceProfile {
  solution: Json;
  app: Json;
  resources?: CloudResource[];
}

////////////Azure Solution/////////////////////
export interface AzureResource extends CloudResource {
  resourceGroupName?: string;
  subscriptionId?: string;
  tenantId?: string;
  location?: string;
}

export interface AzureSolutionConfig extends Json {
  resourceNameSuffix: string;
  resourceGroupName: string;
  tenantId: string;
  subscriptionId: string;
  subscriptionName: string;
  location: string;
  provisionSucceeded: boolean;
}

export interface TeamsAppResource extends Json {
  teamsAppId: string;
  tenantId: string;
}

export interface TeamsFxAzureResourceProfile extends ResourceProfile {
  solution: AzureSolutionConfig;
  app: TeamsAppResource;
  resources?: AzureResource[];
}

////////////////////AzureManagedIdentity.ts////////////////
export interface AzureManagedIdentity extends AzureResource {
  type: "AzureManagedIdentity";
  clientId: string;
}

////////////////////AzureStorageAccount.ts////////////////
export interface AzureStorageAccount extends AzureResource {
  type: "AzureStorageAccount";
  endpoint: string;
}

////////////////////AzureSQL.ts////////////////
export interface AzureSQL extends AzureResource {
  type: "AzureSQL";
  endpoint: string;
  adminUserName: string;
  databaseName: string;
}

////////////////////AzureBot.ts////////////////
export interface AzureBot extends AzureResource {
  type: "AzureBot";
  endpoint: string;
  botId: string;
  botPassword: string;
  aadObjectId: string; //bot AAD App Id
  appServicePlan: string; // use for deploy
  botChannelReg: string; // Azure Bot
  botRedirectUri?: string; // ???
}

////////////////////AzureWebApp.ts////////////////
export interface AzureWebApp extends AzureResource {
  type: "AzureWebApp";
  endpoint: string;
}

////////////////////AzureWebApp.ts////////////////
export interface AzureActiveDirectoryApp extends AzureResource {
  type: "AAD";
  clientId: string;
  clientSecret: string;
  objectId: string;
  oauth2PermissionScopeId: string;
  tenantId: string;
  oauthHost: string;
  oauthAuthority: string;
  applicationIdUris: string;
}

///////////////example/////////////////////////
/**
 * example of TeamsAppResourceProfile
 */
const profile1: TeamsFxAzureResourceProfile = {
  solution: {
    resourceNameSuffix: "595516",
    resourceGroupName: "fullcap-dev-rg",
    tenantId: "9f3429dc-50f4-44df-af81-f1078d49a57a",
    subscriptionId: "63f43cd3-ab63-429d-80ad-950ec8359724",
    subscriptionName: "Visual Studio Enterprise Subscription",
    location: "Central US",
    provisionSucceeded: true,
  },
  app: {
    teamsAppId: "3949bacf-b098-4b03-9bb1-ca94196c90f8",
    tenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
  },
  resources: [
    {
      name: "AzureStorageAccount_1",
      type: "AzureStorageAccount",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.Storage/storageAccounts/frontendstgwtdxzjx6olulg",
      resourceName: "frontendstgwtdxzjx6olulg",
      endpoint: "https://frontendstgwtdxzjx6olulg.z19.web.core.windows.net",
    },
    {
      type: "AzureBot",
      name: "AzureBot_1",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.BotService/botServices/huajietestbot1",
      resourceName: "huajietestbot1",
      botId: "baaec4f5-8c99-4ba5-b896-376ab8d519fa",
      botPassword: "xxxx",
      aadObjectId: "3067c7a1-8584-4cd4-8093-febf0ae378ab", //bot AAD App Id
      appServicePlan: "fullcapdev230e29-bot-serverfarms", // use for deploy
      botChannelReg: "fullcapdev230e29-bot-service", // Azure Bot
    },
    {
      name: "AzureWebApp_1",
      type: "AzureWebApp",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.Web/sites/fullcapdev230e29-bot-sites", //resourceId
      resourceName: "fullcapdev230e29-bot-sites",
      endpoint: "https://fullcapdev230e29-bot-sites.azurewebsites.net",
    },
    {
      name: "AzureFunction_1",
      type: "AzureFunction",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.Web/sites/fullcap102dev517e3f-function-webapp",
      resourceName: "fullcapdev230e29-simpleauth-webapp",
      endpoint: "https://fullcapdev230e29-simpleauth-webapp.azurewebsites.net",
    },
    {
      name: "SimpleAuth",
      type: "AzureWebApp",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.Web/serverfarms/fullcapdev230e29-simpleAuth-serverfarms",
      resourceName: "fullcapdev230e29-simpleauth-webapp",
      endpoint: "https://fullcapdev230e29-simpleauth-webapp.azurewebsites.net",
    },
    {
      name: "AAD",
      type: "AAD",
      resourceId: "3154034a-4ce1-48f7-809f-e8dd91ac5b4c",
      resourceName: "xxxaad",
      clientId: "0a9f0107-a78a-40a9-9740-812b1f13bf37",
      clientSecret: "{{fx-resource-aad-app-for-teams.clientSecret}}",
      objectId: "1d4be2b5-ee59-4ca6-a03e-c84bd49c6075",
      oauth2PermissionScopeId: "c883327a-4435-4bc8-bced-f57542f2c94e",
      tenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
      oauthHost: "https://login.microsoftonline.com",
      oauthAuthority: "https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47",
      applicationIdUris:
        "api://frontendstgwtdxzjx6olulg.z19.web.core.windows.net/botid-baaec4f5-8c99-4ba5-b896-376ab8d519fa",
    },
    {
      name: "AzureSQL_1",
      type: "AzureSQL",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.Sql/servers/fullcapdev230e29-sql-server",
      resourceName: "fullcapdev230e29-sql-server",
      endpoint: "fullcapdev230e29-sql-server.database.windows.net",
      adminUserName: "huajiez",
      databaseName: "fullcapdev230e29-database",
    },
    {
      name: "ManagedIdentity_1",
      type: "ManagedIdentity",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/fullcap102dev517e3f-managedIdentity",
      resourceName: "fullcap102dev517e3f-managedIdentity",
      clientId: "bab9c110-d477-4cd4-9903-a01e426ec68a",
    },
  ],
};

const profile2: ResourceProfile = {
  solution: {
    resourceNameSuffix: "595516",
    resourceGroupName: "fullcap-dev-rg",
    tenantId: "9f3429dc-50f4-44df-af81-f1078d49a57a",
    subscriptionId: "63f43cd3-ab63-429d-80ad-950ec8359724",
    subscriptionName: "Visual Studio Enterprise Subscription",
    location: "Central US",
    provisionSucceeded: true,
  },
  app: {
    teamsAppId: "3949bacf-b098-4b03-9bb1-ca94196c90f8",
    tenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
  },
  resources: [
    {
      name: "AzureBot_1",
      type: "AzureBot",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.BotService/botServices/huajietestbot1",
      resourceName: "huajietestbot1",
      botId: "baaec4f5-8c99-4ba5-b896-376ab8d519fa",
      botPassword: "xxxx",
      aadObjectId: "3067c7a1-8584-4cd4-8093-febf0ae378ab", //bot AAD App Id
      appServicePlan: "fullcapdev230e29-bot-serverfarms", // use for deploy
      botChannelReg: "fullcapdev230e29-bot-service", // Azure Bot
    },
    {
      name: "AzureWebApp_1",
      type: "AzureWebApp",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.Web/sites/fullcapdev230e29-bot-sites", //resourceId
      resourceName: "fullcapdev230e29-bot-sites",
      endpoint: "https://fullcapdev230e29-bot-sites.azurewebsites.net",
    },
  ],
};

const profile3: ResourceProfile = {
  solution: {
    resourceNameSuffix: "595516",
    resourceGroupName: "fullcap-dev-rg",
    tenantId: "9f3429dc-50f4-44df-af81-f1078d49a57a",
    subscriptionId: "63f43cd3-ab63-429d-80ad-950ec8359724",
    subscriptionName: "Visual Studio Enterprise Subscription",
    location: "Central US",
    provisionSucceeded: true,
    armOutput: {},
  },
  app: {
    teamsAppId: "3949bacf-b098-4b03-9bb1-ca94196c90f8",
    tenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
  },
  resources: [
    {
      name: "AzureBot_1",
      type: "AzureBot",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.BotService/botServices/huajietestbot1",
      resourceName: "huajietestbot1",
      botId: "baaec4f5-8c99-4ba5-b896-376ab8d519fa",
      botPassword: "xxxx",
      aadObjectId: "3067c7a1-8584-4cd4-8093-febf0ae378ab", //bot AAD App Id
      appServicePlan: "fullcapdev230e29-bot-serverfarms", // use for deploy
      botChannelReg: "fullcapdev230e29-bot-service", // Azure Bot
    },
    {
      name: "AzureWebApp_1",
      type: "AzureWebApp",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.Web/sites/fullcapdev230e29-bot-sites",
      resourceName: "fullcapdev230e29-bot-sites",
      endpoint: "https://fullcapdev230e29-bot-sites.azurewebsites.net",
    },
    {
      name: "AzureWebApp_2",
      type: "AzureWebApp",
      resourceId:
        "/subscriptions/63f43cd3-ab63-429d-80ad-950ec8359724/resourceGroups/fullcap-dev-rg/providers/Microsoft.Web/sites/fullcapdev230e29-bot-sites22",
      resourceName: "fullcapdev230e29-bot-sites22",
      endpoint: "https://fullcapdev230e2922-bot-sites.azurewebsites.net",
    },
  ],
};