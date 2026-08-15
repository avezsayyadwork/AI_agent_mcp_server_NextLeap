# Railway Deployment Plan for the MCP Server

## 1. Goal
Deploy the project on Railway as a reliable service that can run the weekly feedback pipeline, generate a weekly pulse report, and optionally send that output to downstream MCP-backed tools such as Google Docs and Gmail.

## 2. Current Repository Assessment
The repository is now a Node.js/TypeScript service with:
- Build command: `npm run build`
- Start command: `npm run start`
- Entry point: `src/index.ts`
- Runtime behavior: the app starts an HTTP service, exposes health endpoints, and can optionally run the orchestration pipeline automatically when `RUN_PIPELINE_ON_START=true`.

This means Railway deployment can be handled as a standard web service without needing a separate worker process for the current flow.

## 3. Recommended Deployment Shape
### Preferred approach: Web service
Use Railway as a Web service because the app already exposes:
- `/health`
- `/`

This is sufficient for deployment and basic health verification.

### Optional behavior
If the goal is to automatically generate and push the weekly pulse report on startup, set:
- `RUN_PIPELINE_ON_START=true`

## 4. Current Deployment Requirements
Before deployment, ensure that:
- the app listens on the Railway-provided `PORT` environment variable
- the service starts successfully with `npm run start`
- the MCP endpoint configuration is supplied through environment variables
- any downstream API keys or auth secrets are present in Railway Variables

## 5. Railway Configuration
### Service type
- Use a Web service

### Build settings
- Build command: `npm ci && npm run build`
- Start command: `npm run start`

### Node version
Use Node 20.x for compatibility with the TypeScript and MCP SDK dependencies.

### Environment variables
Set these in Railway Variables:
- `NODE_ENV=production`
- `PORT=3000`
- `MCP_DOCS_SERVER_PATH=https://mcpserverreviewgrowapp-production.up.railway.app`
- `MCP_GMAIL_SERVER_PATH=https://mcpserverreviewgrowapp-production.up.railway.app`
- `RECIPIENT_EMAIL=your_email@example.com`
- `RUN_PIPELINE_ON_START=false` (set to `true` if you want the pipeline to run automatically on startup)
- Any API keys or secrets required by downstream integrations

## 6. Current Project Behavior
The app now supports:
- review import and validation
- PII scrubbing
- weekly pulse analysis
- local output persistence to `pulse_draft.json`
- MCP-based document creation and email draft creation
- graceful fallback when the MCP server is unavailable

The MCP client is already capable of using either:
- a local stdio-style MCP server command, or
- a remote HTTP URL such as the Railway-hosted MCP domain

## 7. Deployment Steps
1. Create a new Railway project.
2. Connect the repository to Railway.
3. Select the service type as a Web service.
4. Set the build command to `npm ci && npm run build`.
5. Set the start command to `npm run start`.
6. Add the required environment variables in Railway.
7. Deploy the service.
8. Verify the `/health` endpoint and the service logs.
9. If `RUN_PIPELINE_ON_START=true`, confirm that the pipeline runs and creates the expected output.

## 8. Verification Checklist
After deployment, confirm that:
- the service starts successfully
- the health endpoint returns 200
- the root endpoint returns a JSON payload
- the app logs show startup and pipeline status without fatal errors
- the pipeline can reach the configured MCP server URL if enabled
- the generated report is written locally to `pulse_draft.json`

## 9. Rollback Plan
If deployment fails:
1. Revert to the previous commit or image.
2. Remove or correct any misconfigured environment variables.
3. Re-run the deployment after fixing the issue.
4. Review Railway logs for the root cause before reattempting.

## 10. Recommended Next Step
The current codebase is already aligned with a Railway Web service deployment. The main next step is to set the MCP URL environment variables and decide whether the pipeline should run automatically on startup.
