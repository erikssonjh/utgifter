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