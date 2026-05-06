param name string
param location string
param environmentId string
param image string
param keyVaultName string

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    environmentId: environmentId
    configuration: {
      ingress: {
        external: false
        targetPort: 8000
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
      containers: [
        {
          name: 'dropout-api'
          image: image
          resources: { cpu: json('0.5'), memory: '1.0Gi' }
          env: [
            { name: 'HOPE_API_SECRET', secretRef: 'hope-api-secret' }
            { name: 'HOPE_API_AUTH', value: 'enabled' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 8000 }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output principalId string = app.identity.principalId
