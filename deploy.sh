#!/bin/bash

# 🎯 Azure Deployment Script för Utgifter
# Din specifika konfiguration

RESOURCE_GROUP="utgifter-rg"
APP_NAME="utgifter-app"
LOCATION="swedencentral"
SUBSCRIPTION_ID="e4cd7498-dbf9-4a51-9a99-33643205d82d"

echo "🚀 Deploying Utgifter to Azure..."
echo "📍 Subscription: $SUBSCRIPTION_ID"
echo "📍 Resource Group: $RESOURCE_GROUP"
echo "📍 App Name: $APP_NAME"
echo "📍 Location: $LOCATION"

# Kontrollera att vi är i rätt mapp
if [ ! -f "package.json" ]; then
    echo "❌ Fel: package.json hittades inte. Kör detta script från projektmappen 'utgifter'"
    exit 1
fi

# Logga in på Azure (om inte redan inloggad)
echo "🔐 Kontrollerar Azure-inloggning..."
az account show > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "🔐 Loggar in på Azure..."
    az login
else
    echo "✅ Redan inloggad på Azure"
fi

# Sätt subscription
echo "🎯 Sätter subscription..."
az account set --subscription $SUBSCRIPTION_ID
if [ $? -ne 0 ]; then
    echo "❌ Fel: Kunde inte sätta subscription. Kontrollera ditt Subscription ID"
    exit 1
fi

echo "✅ Subscription satt: $SUBSCRIPTION_ID"

# Skapa resource group om den inte finns
echo "📦 Skapar resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION
if [ $? -ne 0 ]; then
    echo "❌ Fel: Kunde inte skapa resource group"
    exit 1
fi

echo "✅ Resource group skapad/verifierad: $RESOURCE_GROUP"

# Deploy infrastructure
echo "🏗️ Deploying infrastructure..."
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file bicep/main.bicep \
  --parameters appName=$APP_NAME

if [ $? -ne 0 ]; then
    echo "❌ Fel: Infrastructure deployment misslyckades"
    exit 1
fi

echo "✅ Infrastructure deployment slutförd"

# Bygg applikationen
echo "🔨 Bygger applikation..."
npm ci
if [ $? -ne 0 ]; then
    echo "❌ Fel: npm ci misslyckades"
    exit 1
fi

echo "✅ Dependencies installerade"

# Skapa deployment paket
echo "📦 Skapar deployment paket..."
zip -r deploy.zip . -x "node_modules/*" ".git/*" "*.log" "transactions.db"
if [ $? -ne 0 ]; then
    echo "❌ Fel: Kunde inte skapa deployment paket"
    exit 1
fi

echo "✅ Deployment paket skapat"

# Deploy applikationen
echo "🚢 Deploying applikation till Azure..."
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --src deploy.zip

if [ $? -ne 0 ]; then
    echo "❌ Fel: App deployment misslyckades"
    exit 1
fi

echo "✅ Applikation deployment slutförd"

# Hämta URL
echo "🌐 Hämtar applikations-URL..."
APP_URL=$(az webapp show --resource-group $RESOURCE_GROUP --name $APP_NAME --query defaultHostName -o tsv)

# Rensa
echo "🧹 Rensar temporära filer..."
rm -f deploy.zip

echo ""
echo "🎉 DEPLOYMENT SLUTFÖRD! 🎉"
echo "=================================="
echo "🌐 Din app finns på: https://$APP_URL"
echo "📊 Azure Portal: https://portal.azure.com"
echo "📁 Resource Group: $RESOURCE_GROUP"
echo ""
echo "⏳ Applikationen kan ta 2-3 minuter att starta första gången"
echo "🔄 Testa URL:en om några minuter om den inte fungerar direkt"
echo ""