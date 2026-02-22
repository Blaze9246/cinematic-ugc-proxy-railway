# Cinematic UGC Proxy Server

Proxy server for Google Vertex AI Veo 3.1 Fast video generation.

## Environment Variables

```bash
GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDlV0cJGt8LmUuu...\n-----END PRIVATE KEY-----"
PORT=3000
```

## API Endpoints

### POST /generate-video
Generate a video using Veo 3.1 Fast.

**Request:**
```json
{
  "scriptText": "I've been struggling with this problem...",
  "direction": "Close-up, subtle head shake",
  "referenceImage": "data:image/jpeg;base64,/9j/4AAQ...",
  "country": "United States",
  "provider": "veo"
}
```

**Response:**
```json
{
  "success": true,
  "videoUrl": "data:video/mp4;base64,...",
  "provider": "veo"
}
```

### GET /health
Health check endpoint.

### GET /status
Check Google Cloud connection status.

## Deployment

### Railway
```bash
railway login
railway init
railway up
```

### Vercel
```bash
vercel --prod
```

### Local
```bash
npm install
npm start
```
# Deploy trigger Mon Feb 23 04:45:12 AM CST 2026
# Render deploy trigger Mon Feb 23 04:48:15 AM CST 2026
