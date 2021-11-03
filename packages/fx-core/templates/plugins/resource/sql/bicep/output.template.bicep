output azureSqlOutput object = {
  teamsFxPluginId: 'fx-resource-azure-sql'
  sqlResourceId: azureSqlProvision.outputs.resourceId
  sqlEndpoint: azureSqlProvision.outputs.sqlEndpoint
  databaseName: azureSqlProvision.outputs.databaseName
}
