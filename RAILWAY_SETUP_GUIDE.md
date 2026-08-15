# Railway Deployment Guide

This guide walks through the exact steps to deploy this project on Railway using the Railway dashboard.

## 1. Prerequisites
Before starting, make sure you have:
- a Railway account
- access to this GitHub repository
- the repository connected to Railway
- the required environment variables ready

## 2. Create a new Railway project
1. Open Railway and click New Project.
2. Choose Deploy from GitHub repo.
3. Select this repository.
4. Railway will detect the Node.js app and use the configuration from `railway.json`.

## 3. Configure the service
Railway will create a service for the repository. Use these settings:
- Service type: Web Service
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health check path: `/health`

These defaults are already defined in `railway.json`.

## 4. Add environment variables
In the Railway project dashboard, open Variables and add the following:

Required:
- `NODE_ENV=production`
- `PORT=3000`

Recommended for MCP integration:
- `MCP_DOCS_SERVER_PATH=https://mcpserverreviewgrowapp-production.up.railway.app`
- `MCP_GMAIL_SERVER_PATH=https://mcpserverreviewgrowapp-production.up.railway.app`
- `RECIPIENT_EMAIL=your_email@example.com`
- `RUN_PIPELINE_ON_START=false`

If you want the pipeline to run automatically at startup, set:
- `RUN_PIPELINE_ON_START=true`

If you use downstream integrations, add their API keys or secrets as needed.

## 5. Deploy the service
1. Click Deploy.
2. Wait for Railway to finish building and starting the app.
3. Open the generated domain to confirm the service is live.
4. Verify the health endpoint at `/health`.

## 6. Verify deployment
After deployment, confirm:
- the service shows a green status
- the health endpoint responds successfully at `/health`
- the root endpoint returns a JSON payload
- the logs show the app started without fatal errors
- if `RUN_PIPELINE_ON_START=true`, the pipeline starts and writes a local draft to `pulse_draft.json`

## 7. Common troubleshooting
If deployment fails:
- check the build logs for missing dependencies
- verify that the start command is `npm run start`
- confirm that the `PORT` variable is being used by the app
- ensure the MCP server URL variables are valid and reachable
- ensure any required secrets are present in Railway Variables

## 8. Recommended production settings
For production use:
- keep `RUN_PIPELINE_ON_START=false` unless you want the pipeline to run automatically on each boot
- set the MCP URLs explicitly to your deployed MCP endpoint
- use a persistent environment variable store for secrets
- enable automatic redeploys from the main branch
