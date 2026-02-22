# Veo 3.1 Video Generation - Deployment Guide

## Summary of Changes

### Bugs Fixed

1. **Frontend-Backend Field Name Mismatch**
   - **Problem**: Frontend sends `prompt`, `imageUrl` but backend expected `scriptText`, `direction`, `referenceImage`
   - **Fix**: Added field mapping logic in `/generate-video` endpoint to accept both naming conventions
   - **Code**:
     ```javascript
     const finalScriptText = scriptText || (prompt ? prompt.split('. Script: "')[1]?.split('". Style:')[0] : null) || prompt || '';
     const finalDirection = direction || (prompt ? prompt.split('. Script: "')[0] : null) || '';
     const finalReferenceImage = referenceImage || imageUrl;
     ```

2. **Response Format Mismatch**
   - **Problem**: Backend returned `{ success, videoUrl, provider }` but frontend expected `data.videoBase64` or `data.videoUrl`
   - **Fix**: Updated response to include both formats:
     ```javascript
     res.json({ 
       success: true, 
       videoUrl: videoResult, 
       videoBase64: videoResult.startsWith('data:') ? videoResult.split(',')[1] : null,
       provider: provider || 'veo',
       requestId
     });
     ```

3. **Missing Comprehensive Logging**
   - **Problem**: No visibility into where failures occur in the video generation pipeline
   - **Fix**: Added request-scoped logging with unique request IDs throughout the flow
   - **Logs now include**:
     - Request start/end with timestamps
     - Field mapping results
     - Image validation (mime type, base64 length)
     - API call status codes
     - Polling progress (attempt X/Y)
     - Video extraction attempts (GCS vs base64)
     - Error details with stack traces

### Files Modified

1. **`server.cjs`** - Main proxy server
   - Updated `/generate-video` endpoint with field mapping
   - Updated `generateVeoVideo()` function with comprehensive logging
   - Updated `/test-veo-3.1` endpoint with better error handling
   - Added request ID tracking for debugging

2. **`test-video.js`** (NEW) - Test suite for local validation
   - Tests health check endpoint
   - Tests Veo 3.1 model availability
   - Validates payload structure
   - Tests field name mapping
   - Validates response format

## Deployment Instructions

### Step 1: Verify Local Proxy is Working

```bash
cd /root/.openclaw/workspace/cinematic-ugc-proxy
npm install  # if needed
node server.cjs
```

In another terminal:
```bash
cd /root/.openclaw/workspace/cinematic-ugc-proxy
node test-video.js
```

Expected output:
```
✓ Health check passed
✓ Payload validation passed
✓ Field mapping works correctly
✓ Response format is valid
```

### Step 2: Deploy to Render

The proxy is hosted at: `https://cinematic-ugc-proxy-render.onrender.com`

**Option A: Manual Deploy via Render Dashboard**
1. Go to https://dashboard.render.com/
2. Find "cinematic-ugc-proxy-render" service
3. Click "Manual Deploy" → "Deploy latest commit"

**Option B: Git-based Auto-deploy**
1. Commit changes:
   ```bash
   cd /root/.openclaw/workspace/cinematic-ugc-proxy
   git add server.cjs test-video.js
   git commit -m "Fix Veo 3.1 video generation: field mapping, response format, logging"
   git push origin main
   ```
2. Render will auto-deploy if connected to GitHub

### Step 3: Verify Deployed Proxy

After deployment, test the live proxy:

```bash
curl https://cinematic-ugc-proxy-render.onrender.com/health
```

Expected:
```json
{"status":"ok","timestamp":"2026-02-23T..."}
```

### Step 4: Test Veo 3.1 Availability

```bash
curl https://cinematic-ugc-proxy-render.onrender.com/test-veo-3.1
```

Expected (if service account is configured):
```json
{
  "success": true,
  "message": "veo-3.1-fast-generate-001 is available and working!",
  "operationName": "projects/.../locations/us-central1/publishers/google/models/veo-3.1-fast-generate-001/operations/...",
  "projectId": "your-project-id"
}
```

### Step 5: Test Full Video Generation

Use the frontend at: https://cinematic-ugc-frontend-v3.onrender.com

1. Go through the campaign creation flow
2. Select "Veo" as the video provider
3. Generate a video
4. Check Render logs for the request ID to debug any issues

## Environment Variables Required

The proxy requires these environment variables on Render:

| Variable | Description | Required For |
|----------|-------------|--------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON of Google Cloud service account | Veo video generation |
| `GEMINI_API_KEY` | Google AI Studio API key | Image generation, product analysis |
| `SEEDREAM_API_KEY` | BytePlus/Seedream API key | Seedream image generation (optional) |

## Monitoring

After deployment, monitor these endpoints:

1. **Health**: `GET /health` - Should return `{"status":"ok"}`
2. **Veo Status**: `GET /test-veo-3.1` - Should return `{"success":true}`
3. **Render Logs**: Check https://dashboard.render.com/ for real-time logs

## Troubleshooting

### "No service account configured" error
- Set `GOOGLE_SERVICE_ACCOUNT_JSON` in Render dashboard
- Get service account JSON from Google Cloud Console → IAM → Service Accounts

### "Veo API error: 403" or "Permission denied"
- Ensure service account has "Vertex AI User" role
- Enable Vertex AI API in Google Cloud Console
- Enable Veo 3.1 model in Vertex AI Model Garden

### "No video data in completed operation"
- Check Render logs for the full poll response
- May indicate model is still warming up or quota exceeded
- Try again in a few minutes

### Frontend shows "Video generation failed"
1. Open browser DevTools → Network tab
2. Find the `/generate-video` request
3. Check the response for error details
4. Match the `requestId` in Render logs for full trace

## Rollback Plan

If issues occur after deployment:

1. Go to Render Dashboard → cinematic-ugc-proxy-render
2. Click "Manual Deploy" → select previous working commit
3. Or revert Git commit and push:
   ```bash
   git revert HEAD
   git push origin main
   ```

## Verification Checklist

- [ ] Local proxy passes all tests (`node test-video.js`)
- [ ] Deployed proxy health check returns OK
- [ ] Veo 3.1 test endpoint returns success
- [ ] Frontend can connect to proxy (no CORS errors)
- [ ] Full video generation flow works end-to-end
- [ ] Logs show request IDs for debugging
- [ ] Response includes both `videoUrl` and `videoBase64`

## Contact

For issues, check:
1. Render logs: https://dashboard.render.com/
2. Request IDs in logs for tracing specific failures
3. Google Cloud Console for quota/API status
