# azure-pipelines.yml - Azure DevOps CI/CD Pipeline
trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

variables:
  azureSubscription: 'your-azure-subscription'
  appName: 'utgifter-app'
  resourceGroup: 'utgifter-rg'
  location: 'North Europe'

stages:
- stage: Build
  jobs:
  - job: BuildApp
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '18.x'
      displayName: 'Install Node.js'

    - script: |
        npm ci
        npm run build
        npm test
      displayName: 'Install dependencies, build and test'

    - task: ArchiveFiles@2
      inputs:
        rootFolderOrFile: '.'
        includeRootFolder: false
        archiveType: 'zip'
        archiveFile: '$(Build.ArtifactStagingDirectory)/utgiftsspaarare.zip'
        replaceExistingArchive: true
      displayName: 'Archive application'

    - publish: '$(Build.ArtifactStagingDirectory)/utgiftsspaarare.zip'
      artifact: 'webapp'

- stage: Deploy
  dependsOn: Build
  jobs:
  - deployment: DeployToAzure
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: AzureRmWebAppDeployment@4
            inputs:
              ConnectionType: 'AzureRM'
              azureSubscription: '$(azureSubscription)'
              appType: 'webAppLinux'
              WebAppName: '$(appName)'
              packageForLinux: '$(Pipeline.Workspace)/webapp/utgiftsspaarare.zip'
              RuntimeStack: 'NODE|18-lts'
              StartupCommand: 'npm start'

---

# bicep/main.bicep - Infrastructure as Code för Azure
param appName string = 'utgifter-app'
param location string = resourceGroup().location
param sku string = 'F1' // Free tier, ändra till 'B1' för Basic

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    name: sku
    tier: sku == 'F1' ? 'Free' : 'Basic'
  }
  properties: {
    reserved: true
  }
  kind: 'linux'
}

// Web App
resource webApp 'Microsoft.Web/sites@2022-03-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '18.x'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
      ]
      nodeVersion: '18.x'
    }
    httpsOnly: true
  }
}

// Storage Account för större databaser (optional)
resource storageAccount 'Microsoft.Storage/storageAccounts@2022-05-01' = {
  name: '${replace(appName, '-', '')}storage'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
  }
}

output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output storageAccountName string = storageAccount.name

---

# deploy.sh - Deployment script
#!/bin/bash

# Konfigurera variabler
RESOURCE_GROUP="utgifter-rg"
APP_NAME="utgifter-app"
LOCATION="northeurope"
SUBSCRIPTION_ID="e4cd7498-dbf9-4a51-9a99-33643205d82d"

echo "🚀 Deploying Utgifter to Azure..."

# Logga in på Azure (om inte redan inloggad)
az login

# Sätt subscription
az account set --subscription $SUBSCRIPTION_ID

# Skapa resource group om den inte finns
echo "📦 Creating resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Deploy infrastructure
echo "🏗️ Deploying infrastructure..."
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file bicep/main.bicep \
  --parameters appName=$APP_NAME

# Bygg applikationen
echo "🔨 Building application..."
npm ci
npm run build

# Skapa deployment paket
echo "📦 Creating deployment package..."
zip -r deploy.zip . -x "node_modules/*" ".git/*" "*.log"

# Deploy applikationen
echo "🚢 Deploying application..."
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --src deploy.zip

# Hämta URL
APP_URL=$(az webapp show --resource-group $RESOURCE_GROUP --name $APP_NAME --query defaultHostName -o tsv)
echo "✅ Deployment complete!"
echo "🌐 Your app is available at: https://$APP_URL"

# Rensa
rm -f deploy.zip

echo "🎉 Done!"

---

# .env.example - Environment variables template
# Kopiera till .env och fyll i dina värden

# Server konfiguration
PORT=3001
NODE_ENV=development

# Databas
DATABASE_PATH=./transactions.db

# Azure konfiguration (för produktion)
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER_NAME=

# Säkerhet (för produktion)
SESSION_SECRET=your-secret-key-here
JWT_SECRET=your-jwt-secret-here

# Logging
LOG_LEVEL=info