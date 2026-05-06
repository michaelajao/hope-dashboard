param name string
param location string
param environmentId string
param image string
param keyVaultName string
param commentApiUrl string
param dropoutApiUrl string
param facilitatorEmails string

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    environmentId: environmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'hope-api-secret'
          keyVaultUrl: 'https://${keyVaultName}.vault.azure.net/secrets/hope-api-secret'
          identity: 'System'
        }
        {
          name: 'auth-secret'
          keyVaultUrl: 'https://${keyVaultName}.vault.azure.net/secrets/auth-secret'
          identity: 'System'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'dashboard'
          image: image
          resources: { cpu: json('1.0'), memory: '2.0Gi' }
          env: [
            { name: 'HOPE_API_SECRET', secretRef: 'hope-api-secret' }
            { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
            { name: 'COMMENT_GEN_URL', value: commentApiUrl }
            { name: 'DROPOUT_API_URL', value: dropoutApiUrl }
            { name: 'FACILITATOR_EMAILS', value: facilitatorEmails }
            // AUTH_URL is set per environment via deployment overrides.
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/api/auth/session', port: 3000 }
              initialDelaySeconds: 20
              periodSeconds: 60
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
