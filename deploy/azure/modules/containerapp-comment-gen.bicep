param name string
param location string
param environmentId string
param image string
param keyVaultName string
param storageMountName string
param hopeGenModelId string
param dashboardOrigin string
param dropoutInternalUrl string

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    environmentId: environmentId
    configuration: {
      ingress: {
        external: false
        targetPort: 8001
        transport: 'http'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'hope-api-secret'
          keyVaultUrl: 'https://${keyVaultName}.vault.azure.net/secrets/hope-api-secret'
          identity: 'System'
        }
      ]
    }
    template: {
      // CPU profile suits qwen2.5-1.5b in float32. To switch to GPU, change
      // workloadProfileName to a Consumption-GPU profile and bump resources.
      containers: [
        {
          name: 'comment-api'
          image: image
          resources: { cpu: json('2.0'), memory: '4.0Gi' }
          env: [
            { name: 'HOPE_API_SECRET', secretRef: 'hope-api-secret' }
            { name: 'HOPE_API_AUTH', value: 'enabled' }
            { name: 'HOPE_GEN_MODEL_ID', value: hopeGenModelId }
            { name: 'HOPE_DROPOUT_URL', value: dropoutInternalUrl }
            { name: 'HOPE_DASHBOARD_ORIGIN', value: dashboardOrigin }
            { name: 'HOPE_DROPOUT_PANEL_PATH', value: '/data/dropout_artifacts/cumulative_features_panel.parquet' }
          ]
          volumeMounts: [
            { volumeName: 'lora', mountPath: '/app/models' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 8001 }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
          ]
        }
      ]
      volumes: [
        {
          name: 'lora'
          storageType: 'AzureFile'
          storageName: storageMountName
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output principalId string = app.identity.principalId
