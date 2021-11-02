param functionAppName string
param functionStorageName string
param m365ClientId string
@secure()
param m365ClientSecret string
param m365TenantId string
param m365ApplicationIdUri string
param m365OauthAuthorityHost string

{{#contains 'fx-resource-frontend-hosting' Plugins}}
param frontendHostingStorageEndpoint string
{{/contains}}
{{#contains 'fx-resource-azure-sql' Plugins}}
param sqlDatabaseName string
param sqlEndpoint string
{{/contains}}
{{#contains 'fx-resource-identity' Plugins}}
param identityClientId string
{{/contains}}

var teamsMobileOrDesktopAppClientId = '1fec8e78-bce4-4aaf-ab1b-5451cc387264'
var teamsWebAppClientId = '5e3ce6c0-2b1f-4285-8d4b-75ee78787346'
var officeWebAppClientId1 = '4345a7b9-9a63-4910-a426-35363201d503'
var officeWebAppClientId2 = '4765445b-32c6-49b0-83e6-1d93765276ca'
var outlookDesktopAppClientId = 'd3590ed6-52b3-4102-aeff-aad2292ab01c'
var outlookWebAppClientId = '00000002-0000-0ff1-ce00-000000000000'
var authorizedClientApplicationIds = '${teamsMobileOrDesktopAppClientId};${teamsWebAppClientId};${officeWebAppClientId1};${officeWebAppClientId2};${outlookDesktopAppClientId};${outlookWebAppClientId}'

resource functionApp 'Microsoft.Web/sites@2021-01-15' existing = {
  name: functionAppName
}

resource functionStorage 'Microsoft.Storage/storageAccounts@2021-04-01' existing = {
  name: functionStorageName
}

var oauthAuthority = uri(m365OauthAuthorityHost, m365TenantId)

{{#contains 'fx-resource-frontend-hosting' Plugins}}
resource functionAppConfig 'Microsoft.Web/sites/config@2021-01-15' = {
  parent: functionApp
  name: 'web'
  kind: 'functionapp'
  properties: {
    cors: {
      allowedOrigins: [
        frontendHostingStorageEndpoint
      ]
    }
  }
}
{{/contains}}

resource functionAppAppSettings 'Microsoft.Web/sites/config@2021-01-15' = {
  parent: functionApp
  name: 'appsettings'
  dependsOn: [
    functionAppConfig
    functionAppAuthSettings
  ]
  properties: {
    API_ENDPOINT: 'https://${functionApp.properties.hostNames[0]}'
    ALLOWED_APP_IDS: authorizedClientApplicationIds
    AzureWebJobsDashboard: 'DefaultEndpointsProtocol=https;AccountName=${functionStorage.name};AccountKey=${listKeys(functionStorage.id, functionStorage.apiVersion).keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
    AzureWebJobsStorage: 'DefaultEndpointsProtocol=https;AccountName=${functionStorage.name};AccountKey=${listKeys(functionStorage.id, functionStorage.apiVersion).keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
    FUNCTIONS_EXTENSION_VERSION: '~3'
    FUNCTIONS_WORKER_RUNTIME: 'node'
    M365_APPLICATION_ID_URI: m365ApplicationIdUri
    M365_CLIENT_ID: m365ClientId
    M365_CLIENT_SECRET: m365ClientSecret
    M365_TENANT_ID: m365TenantId
    M365_AUTHORITY_HOST: m365OauthAuthorityHost
    WEBSITE_CONTENTAZUREFILECONNECTIONSTRING: 'DefaultEndpointsProtocol=https;AccountName=${functionStorage.name};AccountKey=${listKeys(functionStorage.id, functionStorage.apiVersion).keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
    WEBSITE_RUN_FROM_PACKAGE: '1'
    WEBSITE_CONTENTSHARE: toLower(functionAppName)
    {{#contains 'fx-resource-identity' Plugins}}
    IDENTITY_ID: identityClientId
    {{/contains}}
    {{#contains 'fx-resource-azure-sql' Plugins}}
    SQL_DATABASE_NAME: sqlDatabaseName
    SQL_ENDPOINT: sqlEndpoint
    {{/contains}}
  }
}

resource functionAppAuthSettings 'Microsoft.Web/sites/config@2021-01-15' = {
  parent: functionApp
  name: 'authsettings'
  properties: {
    enabled: true
    defaultProvider: 'AzureActiveDirectory'
    clientId: m365ClientId
    issuer: '${oauthAuthority}/v2.0'
    allowedAudiences: [
      m365ClientId
      m365ApplicationIdUri
    ]
  }
}
