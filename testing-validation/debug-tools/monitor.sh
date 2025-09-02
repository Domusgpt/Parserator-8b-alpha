#!/bin/bash

# Simple monitoring script
echo "🔍 Parserator Health Check - $(date)"

# Check website
WEBSITE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://parserator-production.web.app)
echo "Website Status: $WEBSITE_STATUS"

# Check API (when ready)
# API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.parserator.com/health)
# echo "API Status: $API_STATUS"

# Check social mentions (placeholder)
echo "Social Mentions: Monitoring..."

# Log to file
echo "$(date): Website=$WEBSITE_STATUS" >> health.log
