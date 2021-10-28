// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { NameValuePair, Site } from "@azure/arm-appservice/esm/models/mappers";
import { WebSiteManagementClient, WebSiteManagementModels } from "@azure/arm-appservice";

import {
  AzureInfo,
  CommonConstants,
  DefaultProvisionConfigs,
  FunctionAppSettingKeys,
  RegularExpr,
} from "../constants";
import { AzureLib } from "../utils/azure-client";
import { FunctionLanguage } from "../enums";
import { LanguageStrategyFactory } from "../language-strategy";
import { getAllowedAppIds } from "../../../../common/tools";

type Site = WebSiteManagementModels.Site;
type NameValuePair = WebSiteManagementModels.NameValuePair;
type SiteAuthSettings = WebSiteManagementModels.SiteAuthSettings;

export class FunctionNaming {
  private static normalize(raw: string): string {
    return raw
      .replace(RegularExpr.allCharToBeSkippedInName, CommonConstants.emptyString)
      .toLowerCase();
  }

  private static concatName(appName: string, mergedSuffix: string): string {
    const suffix = this.normalize(mergedSuffix).substr(0, AzureInfo.suffixLenMax);
    const paddingLength = AzureInfo.resourceNameLenMax - suffix.length;
    const normalizedAppName = this.normalize(appName).substr(0, paddingLength);
    return normalizedAppName + suffix;
  }

  public static generateStorageAccountName(
    appName: string,
    classSuffix: string,
    identSuffix: string
  ): string {
    const mergedSuffix: string = classSuffix + identSuffix;
    return this.concatName(appName, mergedSuffix);
  }

  public static generateFunctionAppName(
    appName: string,
    classSuffix: string,
    identSuffix: string
  ): string {
    const mergedSuffix: string = classSuffix + identSuffix;
    return this.concatName(appName, mergedSuffix);
  }
}

export class FunctionProvision {
  public static async ensureFunctionApp(
    client: WebSiteManagementClient,
    resourceGroupName: string,
    location: string,
    functionAppName: string,
    language: FunctionLanguage,
    appServiceId: string,
    storageConnectionString: string,
    version: string
  ): Promise<Site> {
    const settings: NameValuePair[] = Object.entries({
      ...DefaultProvisionConfigs.functionAppStaticSettings,
      ...this.getFunctionAppRuntimeSettings(language, version),
      ...this.getFunctionAppStorageSettings(storageConnectionString),
    }).map((kv) => ({
      name: kv[0],
      value: kv[1],
    }));

    const siteEnvelope: Site = {
      ...DefaultProvisionConfigs.functionAppConfig(location),
      serverFarmId: appServiceId,
      siteConfig: {
        appSettings: settings,
      },
    };

    const site = await AzureLib.ensureFunctionApp(
      client,
      resourceGroupName,
      functionAppName,
      siteEnvelope
    );

    // The ensureFunctionApp may return a site found on Azure,
    // we need to return a site with updated settings for post provision.
    settings.forEach((pair) => {
      pair.name && pair.value && this.pushAppSettings(site, pair.name, pair.value);
    });

    return site;
  }

  // TODO: Extend to support multiple language and versions.
  private static getFunctionAppRuntimeSettings(
    language: FunctionLanguage,
    version: string
  ): { [key: string]: string } {
    return LanguageStrategyFactory.getStrategy(language).functionAppRuntimeSettings(version);
  }

  private static getFunctionAppStorageSettings(storageConnectionString: string): {
    [key: string]: string;
  } {
    return {
      WEBSITE_CONTENTAZUREFILECONNECTIONSTRING: storageConnectionString,
      AzureWebJobsDashboard: storageConnectionString,
      AzureWebJobsStorage: storageConnectionString,
    };
  }

  // Push AppSettings when it is not included.
  public static pushAppSettings(
    site: Site,
    newName: string,
    newValue: string,
    replace = true
  ): void {
    if (!site.siteConfig) {
      site.siteConfig = {};
    }

    if (!site.siteConfig.appSettings) {
      site.siteConfig.appSettings = [];
    }

    const kv: NameValuePair | undefined = site.siteConfig.appSettings.find(
      (kv) => kv.name === newName
    );
    if (!kv) {
      site.siteConfig.appSettings.push({
        name: newName,
        value: newValue,
      });
    } else if (replace) {
      kv.value = newValue;
    }
  }

  public static updateFunctionSettingsSelf(site: Site, endpoint: string): void {
    this.pushAppSettings(site, FunctionAppSettingKeys.functionEndpoint, endpoint);
  }

  // The following APIs are prepared for post-provision.
  public static updateFunctionSettingsForAAD(
    site: Site,
    clientId: string,
    clientSecret: string,
    oauthHost: string,
    tenantId: string,
    applicationIdUris: string
  ): void {
    // Remove tailing "/"
    const normalizedOauthHost = oauthHost.replace(/\/+$/g, "");

    this.pushAppSettings(site, FunctionAppSettingKeys.clientId, clientId);
    this.pushAppSettings(site, FunctionAppSettingKeys.clientSecret, clientSecret);
    this.pushAppSettings(site, FunctionAppSettingKeys.oauthHost, normalizedOauthHost);
    this.pushAppSettings(site, FunctionAppSettingKeys.tenantId, tenantId);
    this.pushAppSettings(site, FunctionAppSettingKeys.applicationIdUris, applicationIdUris);
  }

  public static updateFunctionSettingsForSQL(
    site: Site,
    identityId: string,
    databaseName: string,
    sqlEndpoint: string,
    identityResourceId: string
  ): void {
    this.pushAppSettings(site, FunctionAppSettingKeys.identityId, identityId);
    this.pushAppSettings(site, FunctionAppSettingKeys.databaseName, databaseName);
    this.pushAppSettings(site, FunctionAppSettingKeys.sqlEndpoint, sqlEndpoint);

    site.identity = {
      type: DefaultProvisionConfigs.siteIdentityTypeUserAssigned,
      userAssignedIdentities: {
        [identityResourceId]: {},
      },
    };
  }

  public static updateFunctionSettingsForFrontend(site: Site, frontendEndpoint: string): void {
    if (!site.siteConfig) {
      site.siteConfig = {};
    }

    site.siteConfig.cors = {
      allowedOrigins: [frontendEndpoint],
      supportCredentials: false,
    };
  }

  public static constructFunctionAuthSettings(
    clientId: string,
    applicationIdUri: string,
    oauthHost: string,
    tenantId: string
  ): SiteAuthSettings {
    // Remove tailing "/"
    const normalizedOauthHost = oauthHost.replace(/\/+$/g, "");
    return {
      enabled: true,
      defaultProvider: "AzureActiveDirectory",
      clientId: clientId,
      issuer: `${normalizedOauthHost}/${tenantId}/v2.0`,
      allowedAudiences: [clientId, applicationIdUri],
    };
  }

  public static ensureFunctionAllowAppIds(site: Site, extClientIds: string[]): void {
    if (!site.siteConfig) {
      site.siteConfig = {};
    }

    const clientIds: string[] = extClientIds.concat(getAllowedAppIds());
    const rawOldClientIds: string | undefined = site.siteConfig.appSettings?.find(
      (kv: NameValuePair) => kv.name === FunctionAppSettingKeys.allowedAppIds
    )?.value;
    const oldClientIds: string[] = rawOldClientIds
      ? rawOldClientIds.split(DefaultProvisionConfigs.allowAppIdSep).filter((e) => e)
      : [];

    for (const id of oldClientIds) {
      if (!clientIds.includes(id)) {
        clientIds.push(id);
      }
    }

    this.pushAppSettings(
      site,
      FunctionAppSettingKeys.allowedAppIds,
      clientIds.join(DefaultProvisionConfigs.allowAppIdSep),
      true
    );
  }
}
