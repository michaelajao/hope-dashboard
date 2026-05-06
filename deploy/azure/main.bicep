// Top-level Bicep that composes the three Container Apps + Storage + Key Vault
// + a shared Log Analytics workspace.
//
// Validate locally:
//   az bicep build hope-dashboard/deploy/azure/main.bicep
//
// Deploy with `azd up` once you fill in `azure.yaml` and authenticate.

@description('Environment name (e.g. dev, pilot, prod). Lowercase, no spaces.')
param environmentName string = 'dev'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Container image tag for the comment-api image (in ACR).')
param commentImageTag string = 'latest'

@description('Container image tag for the dropout-api image (in ACR).')
param dropoutImageTag string = 'latest'

@description('Container image tag for the dashboard image (in ACR).')
param dashboardImageTag string = 'latest'

@description('Adapter id served by comment-api at startup. Must match a key in service/generation_service.py:MODEL_ID_TO_DIR.')
param hopeGenModelId string = 'qwen2.5-1.5b-hope-only'

@description('Public origin of the deployed dashboard, used for CORS on comment-api.')
param dashboardOrigin string = 'https://dashboard.${environmentName}.example.org'

@description('Comma-separated allowlist of facilitator emails for NextAuth signIn.')
param facilitatorEmails string = ''

@description('Existing Azure Container Registry name (without .azurecr.io).')
param acrName string

@description('Resource group of the existing ACR (defaults to current).')
param acrResourceGroup string = resourceGroup().name

var prefix = 'hope-${environmentName}'
var storageName = toLower(replace('${prefix}-st', '-', ''))
var kvName = '${prefix}-kv'
var lawName = '${prefix}-law'
var envName = '${prefix}-cae'
var fileShareName = 'lora-adapters'

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: lawName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource adapterShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  parent: fileService
  name: fileShareName
  properties: {
    shareQuota: 50
    enabledProtocols: 'SMB'
  }
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
  }
}

resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

resource caeStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: cae
  name: 'lora-share'
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: fileShareName
      accessMode: 'ReadOnly'
    }
  }
}

module dropoutApi 'modules/containerapp-dropout.bicep' = {
  name: 'dropout-api'
  params: {
    name: '${prefix}-dropout-api'
    location: location
    environmentId: cae.id
    image: '${acrName}.azurecr.io/hope-dropout-api:${dropoutImageTag}'
    keyVaultName: kvName
  }
}

module commentApi 'modules/containerapp-comment-gen.bicep' = {
  name: 'comment-api'
  params: {
    name: '${prefix}-comment-api'
    location: location
    environmentId: cae.id
    image: '${acrName}.azurecr.io/hope-comment-api:${commentImageTag}'
    keyVaultName: kvName
    storageMountName: 'lora-share'
    hopeGenModelId: hopeGenModelId
    dashboardOrigin: dashboardOrigin
    dropoutInternalUrl: 'http://${prefix}-dropout-api/health'
  }
}

module dashboard 'modules/containerapp-dashboard.bicep' = {
  name: 'dashboard'
  params: {
    name: '${prefix}-dashboard'
    location: location
    environmentId: cae.id
    image: '${acrName}.azurecr.io/hope-dashboard:${dashboardImageTag}'
    keyVaultName: kvName
    commentApiUrl: 'http://${prefix}-comment-api'
    dropoutApiUrl: 'http://${prefix}-dropout-api'
    facilitatorEmails: facilitatorEmails
  }
}

output dashboardFqdn string = dashboard.outputs.fqdn
output commentApiFqdn string = commentApi.outputs.fqdn
output dropoutApiFqdn string = dropoutApi.outputs.fqdn
output keyVaultName string = kv.name
output storageAccountName string = storage.name
output adapterShareName string = fileShareName
