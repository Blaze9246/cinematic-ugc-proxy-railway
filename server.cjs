const express = require('express');
const cors = require('cors');
const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Deploy timestamp: 2026-02-23T05:10:00Z (Veo 3.1 Fast with comprehensive logging)

// Service Account Configuration - load from env var or file
let SERVICE_ACCOUNT = null;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  try {
    SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    console.log('✅ Service account loaded from environment variable');
    console.log('📧 Service account email:', SERVICE_ACCOUNT.client_email);
    console.log('📁 Project ID:', SERVICE_ACCOUNT.project_id);
  } catch (err) {
    console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err.message);
  }
} else {
  console.log('⚠️ GOOGLE_SERVICE_ACCOUNT_JSON not set, trying file...');
  try {
    SERVICE_ACCOUNT = require(path.join(__dirname, 'service-account-key.json'));
    console.log('✅ Service account loaded from file');
  } catch (err) {
    console.warn('⚠️ Service account not found, Veo generation will be disabled');
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test Gemini API key
app.get('/test-gemini-key', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  
  if (!geminiKey) {
    return res.status(400).json({
      error: 'No Gemini API key found in environment',
      envVars: Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('API_KEY'))
    });
  }

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say hello' }] }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        success: true,
        message: 'Gemini API key is working',
        keyPrefix: geminiKey.substring(0, 10) + '...',
        response: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No text response'
      });
    } else {
      const errorData = await response.json();
      res.status(400).json({
        success: false,
        error: errorData.error?.message || `HTTP ${response.status}`,
        keyPrefix: geminiKey.substring(0, 10) + '...',
        details: errorData
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      keyPrefix: geminiKey.substring(0, 10) + '...'
    });
  }
});

// Proxy endpoint for product analysis
app.post('/analyze-product', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  
  if (!geminiKey) {
    return res.status(400).json({ error: 'Gemini API key not configured' });
  }

  const { url, refImages } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const parts = [{ text: `Analyze this product from URL: ${url}.` }];
    
    if (refImages && refImages.length > 0) {
      refImages.forEach(img => {
        const base64Data = img.split(',')[1];
        parts.push({ 
          inlineData: { 
            data: base64Data, 
            mimeType: "image/jpeg" 
          } 
        });
      });
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: { parts },
        systemInstruction: {
          parts: [{
            text: `Identify the target audience's gender (strictly 'Men', 'Women', or 'Unisex').
Extract key physical features, emotional benefits, and brand tone.
Suggest the single best environment from [Outdoors, Indoors, Kitchen, Bathroom, Bedroom].
Return JSON with: title, description, features (array), benefits (array), targetAudience, brandTone, suggestedEnvironment`
          }]
        },
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: errorData.error?.message || `Gemini API error: ${response.status}`
      });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return res.status(500).json({ error: 'No response from Gemini' });
    }

    // Parse the JSON response
    try {
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (e) {
      // If not valid JSON, return as text
      res.json({ 
        title: 'Product Analysis',
        description: text,
        features: [],
        benefits: [],
        targetAudience: 'Unisex',
        brandTone: 'Professional',
        suggestedEnvironment: 'Indoors'
      });
    }
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for image generation
app.post('/generate-image', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  
  if (!geminiKey) {
    return res.status(400).json({ error: 'Gemini API key not configured' });
  }

  const { prompt, refImages } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const parts = [];
    if (refImages && refImages.length > 0) {
      parts.push({ text: "REQUIRED: The avatar in the image MUST be holding the exact product shown in these reference images." });
      refImages.forEach(img => {
        const base64Data = img.split(',')[1];
        parts.push({ 
          inlineData: { 
            data: base64Data, 
            mimeType: "image/jpeg" 
          } 
        });
      });
    }
    parts.push({ text: prompt });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=' + geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: { parts },
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: errorData.error?.message || `Gemini API error: ${response.status}`
      });
    }

    const data = await response.json();
    const part = data.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    
    if (!part?.inlineData) {
      return res.status(500).json({ error: 'No image generated' });
    }

    res.json({ 
      imageUrl: `data:image/png;base64,${part.inlineData.data}`
    });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to check if veo-3.1-fast-generate-001 is available
app.get('/test-veo-3.1', async (req, res) => {
  console.log('[TEST-VEO] Checking Veo 3.1 availability...');
  
  try {
    let accessToken;
    let projectId;
    
    if (SERVICE_ACCOUNT) {
      console.log('[TEST-VEO] Using service account...');
      const auth = new GoogleAuth({
        credentials: SERVICE_ACCOUNT,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      accessToken = token.token;
      projectId = SERVICE_ACCOUNT.project_id;
      console.log(`[TEST-VEO] Project ID: ${projectId}`);
    } else {
      console.error('[TEST-VEO] No service account configured');
      return res.status(500).json({ 
        success: false,
        error: 'No service account configured',
        hint: 'Set GOOGLE_SERVICE_ACCOUNT_JSON environment variable or add service-account-key.json'
      });
    }

    const modelName = 'veo-3.1-fast-generate-001';
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${modelName}:predictLongRunning`;

    // Simple test request
    const testBody = {
      instances: [{
        prompt: 'A simple test video of a blue ball bouncing'
      }],
      parameters: {
        aspectRatio: '16:9',
        sampleCount: 1,
        durationSeconds: 4,
        resolution: '720p'
      }
    };

    console.log(`[TEST-VEO] Calling endpoint: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testBody)
    });

    console.log(`[TEST-VEO] Response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`[TEST-VEO] Success! Operation: ${data.name}`);
      res.json({
        success: true,
        message: `${modelName} is available and working!`,
        operationName: data.name,
        projectId: projectId
      });
    } else {
      const errorText = await response.text();
      console.error(`[TEST-VEO] Error response: ${errorText.substring(0, 500)}`);
      
      // Try to parse as JSON, fallback to text
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { raw: errorText.substring(0, 500) };
      }
      
      res.status(400).json({
        success: false,
        message: `${modelName} is NOT available`,
        error: errorData,
        projectId: projectId,
        hint: 'You may need to enable this model in Vertex AI Model Garden or check your service account permissions'
      });
    }
  } catch (error) {
    console.error('[TEST-VEO] Exception:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error testing veo-3.1-fast-generate-001',
      error: error.message,
      stack: error.stack
    });
  }
});

// Veo 3.1 Fast video generation endpoint
app.post('/generate-video', async (req, res) => {
  const requestId = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`\n[${requestId}] ========== VIDEO GENERATION REQUEST ==========`);
  console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Support both old and new field names for backward compatibility
    const { 
      scriptText, direction, referenceImage, 
      prompt, imageUrl,  // Alternative field names from frontend
      country, provider, videoStyle, voiceAccent, styleParams 
    } = req.body;
    
    // Map frontend field names to backend field names
    const finalScriptText = scriptText || (prompt ? prompt.split('. Script: "')[1]?.split('". Style:')[0] : null) || prompt || '';
    const finalDirection = direction || (prompt ? prompt.split('. Script: "')[0] : null) || '';
    const finalReferenceImage = referenceImage || imageUrl;
    
    console.log(`[${requestId}] Provider: ${provider || 'veo'}`);
    console.log(`[${requestId}] Video Style: ${videoStyle || 'default'}`);
    console.log(`[${requestId}] Voice Accent: ${voiceAccent || 'default'}`);
    console.log(`[${requestId}] Country: ${country || 'United States'}`);
    console.log(`[${requestId}] Has referenceImage: ${!!finalReferenceImage}`);
    console.log(`[${requestId}] Script length: ${finalScriptText?.length || 0} chars`);
    console.log(`[${requestId}] Direction length: ${finalDirection?.length || 0} chars`);
    
    if (!finalScriptText) {
      console.error(`[${requestId}] ERROR: Missing scriptText/prompt`);
      return res.status(400).json({ error: 'Missing required fields: scriptText or prompt' });
    }
    
    if (!finalReferenceImage) {
      console.error(`[${requestId}] ERROR: Missing referenceImage/imageUrl`);
      return res.status(400).json({ error: 'Missing required fields: referenceImage or imageUrl' });
    }

    console.log(`[${requestId}] Starting ${provider || 'veo'} video generation...`);
    
    let videoResult;
    
    if (provider === 'hedra') {
      const model = req.body.model || 'character-3';
      videoResult = await generateHedraVideo(finalScriptText, finalDirection, finalReferenceImage, country, model, voiceAccent);
    } else if (provider === 'kling') {
      videoResult = await generateKlingVideo(finalScriptText, finalDirection, finalReferenceImage, country, videoStyle, voiceAccent, styleParams);
    } else {
      videoResult = await generateVeoVideo(finalScriptText, finalDirection, finalReferenceImage, country, videoStyle, voiceAccent, styleParams, requestId);
    }
    
    console.log(`[${requestId}] Video generation SUCCESS`);
    console.log(`[${requestId}] Result type: ${typeof videoResult}`);
    console.log(`[${requestId}] Result starts with: ${videoResult?.substring(0, 50)}...`);
    
    // Return in format expected by frontend
    res.json({ 
      success: true, 
      videoUrl: videoResult, 
      videoBase64: videoResult.startsWith('data:') ? videoResult.split(',')[1] : null,
      provider: provider || 'veo',
      requestId
    });
    
  } catch (error) {
    console.error(`[${requestId}] VIDEO GENERATION ERROR:`, error);
    console.error(`[${requestId}] Stack:`, error.stack);
    res.status(500).json({ 
      error: error.message,
      details: error.stack,
      requestId
    });
  }
  console.log(`[${requestId}] ========== END VIDEO REQUEST ==========\n`);
});

// Generate Veo 3.1 Fast video using Vertex AI
async function generateVeoVideo(scriptText, direction, referenceImage, country, videoStyle = 'UGC Talking', voiceAccent = 'american', styleParams = null, requestId = 'unknown') {
  console.log(`[${requestId}] === VEO VIDEO GENERATION START ===`);
  
  let accessToken;
  let projectId;
  
  // Try service account first
  if (SERVICE_ACCOUNT) {
    console.log(`[${requestId}] Using service account authentication`);
    const auth = new GoogleAuth({
      credentials: SERVICE_ACCOUNT,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    accessToken = token.token;
    projectId = SERVICE_ACCOUNT.project_id;
    console.log(`[${requestId}] Service account project: ${projectId}`);
  } else if (process.env.VEO_ACCESS_TOKEN) {
    // Fallback to manual access token
    accessToken = process.env.VEO_ACCESS_TOKEN;
    projectId = process.env.VEO_PROJECT_ID || 'gen-lang-client-0342836621';
    console.log(`[${requestId}] Using manual access token`);
  } else {
    console.error(`[${requestId}] ERROR: No authentication available`);
    throw new Error('Veo video generation requires service account or VEO_ACCESS_TOKEN');
  }

  // Use the correct endpoint from official Google Cloud documentation
  // Using veo-3.1-fast-generate-001 for better video quality
  const modelName = 'veo-3.1-fast-generate-001';
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${modelName}:predictLongRunning`;
  console.log(`[${requestId}] Model: ${modelName}`);
  console.log(`[${requestId}] Endpoint: ${endpoint}`);

  // Extract mime type and base64 data from the image
  const mimeMatch = referenceImage.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const base64Data = referenceImage.replace(/^data:image\/\w+;base64,/, '');
  console.log(`[${requestId}] Image mime type: ${mimeType}`);
  console.log(`[${requestId}] Image base64 length: ${base64Data?.length || 0} chars`);
  
  if (!base64Data || base64Data.length < 100) {
    console.error(`[${requestId}] ERROR: Invalid image data`);
    throw new Error('Invalid reference image data');
  }

  // Style-specific prompt modifiers
  const styleModifiers = {
    'UGC Talking': 'Authentic user-generated content style, selfie camera angle, natural lighting, casual setting, direct eye contact with camera. NO text overlays, NO titles, NO captions, NO subtitles on screen - clean visuals only',
    'Narrative Voiceover': 'Cinematic storytelling style, smooth camera movements, establishing shots, documentary aesthetic, ambient lighting. NO text overlays, NO titles, NO captions, NO subtitles on screen - clean visuals only',
    'Cinematic': 'High-end commercial production, dramatic cinematic lighting, professional cinematography, premium aesthetic, shallow depth of field. NO text overlays, NO titles, NO captions, NO subtitles on screen - clean visuals only'
  };

  const styleModifier = styleModifiers[videoStyle] || styleModifiers['UGC Talking'];

  // Generate a consistent seed based on voice accent for reproducibility
  // This ensures same voice characteristics across all segments
  const seedMap = {
    'american': 12345,
    'british': 23456,
    'australian': 34567,
    'indian': 45678,
    'south-african': 56789,
    'american-female': 67890,
    'british-female': 78901,
    'australian-female': 89012,
    'indian-female': 90123,
    'south-african-female': 11111
  };
  const voiceSeed = seedMap[voiceAccent] || 12345;

  // Voice accent descriptions for strict consistency
  const voiceDescriptions = {
    'american': 'American accent',
    'british': 'British accent',
    'australian': 'Australian accent',
    'indian': 'Indian accent',
    'south-african': 'South African accent',
    'american-female': 'American female accent',
    'british-female': 'British female accent',
    'australian-female': 'Australian female accent',
    'indian-female': 'Indian female accent',
    'south-african-female': 'South African female accent'
  };
  const voiceDescription = voiceDescriptions[voiceAccent] || 'American accent';

  // Negative prompts to prevent wrong accents
  const negativeVoiceMap = {
    'south-african': 'American accent, British accent, Australian accent, Indian accent',
    'american': 'British accent, Australian accent, Indian accent, South African accent',
    'british': 'American accent, Australian accent, Indian accent, South African accent',
    'australian': 'American accent, British accent, Indian accent, South African accent',
    'indian': 'American accent, British accent, Australian accent, South African accent'
  };
  const negativeVoice = negativeVoiceMap[voiceAccent.replace('-female', '')] || '';

  const requestBody = {
    instances: [{
      prompt: `The SAME character from the image speaks with a clear ${voiceDescription} in ALL segments. They say: "${scriptText}". ${direction}. ${styleModifier}. Setting: ${country || 'United States'}. 8 seconds duration. Vertical 9:16 aspect ratio video.`,
      image: {
        bytesBase64Encoded: base64Data,
        mimeType: mimeType
      }
    }],
    parameters: {
      aspectRatio: '9:16',
      resizeMode: 'crop',
      sampleCount: 1,
      durationSeconds: 8,
      resolution: '720p',
      personGeneration: 'allow_adult',
      seed: voiceSeed,
      negativePrompt: negativeVoice
    }
  };

  console.log(`[${requestId}] Request body summary:`);
  console.log(`[${requestId}]   - Style: ${videoStyle}`);
  console.log(`[${requestId}]   - Voice: ${voiceAccent}`);
  console.log(`[${requestId}]   - Voice Seed: ${voiceSeed}`);
  console.log(`[${requestId}]   - Aspect Ratio: ${requestBody.parameters.aspectRatio}`);
  console.log(`[${requestId}]   - Duration: ${requestBody.parameters.durationSeconds}s`);
  console.log(`[${requestId}]   - Resolution: ${requestBody.parameters.resolution}`);
  console.log(`[${requestId}]   - Prompt length: ${requestBody.instances[0].prompt.length} chars`);
  
  console.log(`[${requestId}] Calling Vertex AI Veo API (predictLongRunning)...`);
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  console.log(`[${requestId}] Initial response status: ${response.status}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[${requestId}] Veo API error response:`, errorText);
    throw new Error(`Veo API error: ${response.status} - ${errorText}`);
  }

  const operation = await response.json();
  console.log(`[${requestId}] Operation started: ${operation.name}`);
  console.log(`[${requestId}] Full operation response:`, JSON.stringify(operation, null, 2));
  
  if (operation.error) {
    console.error(`[${requestId}] Operation error:`, operation.error);
    throw new Error(`Veo API error: ${operation.error.message}`);
  }
  
  // Poll for operation completion
  const operationName = operation.name;
  if (!operationName) {
    console.error(`[${requestId}] ERROR: No operation name returned`);
    console.error(`[${requestId}] Full operation object:`, JSON.stringify(operation, null, 2));
    throw new Error('No operation name returned from Veo API');
  }
  
  console.log(`[${requestId}] Raw operation name: ${operationName}`);
  
  // According to Google Cloud documentation for Veo 3.1:
  // Polling is done via POST to :fetchPredictOperation with operationName in body
  const pollEndpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${modelName}:fetchPredictOperation`;
  console.log(`[${requestId}] Polling endpoint: ${pollEndpoint}`);
  
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes (5s * 60)
  
  console.log(`[${requestId}] Starting polling loop (max ${maxAttempts} attempts)...`);
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;
    
    console.log(`[${requestId}] Poll attempt ${attempts}/${maxAttempts}...`);
    
    // Use POST with operationName in body per official docs
    const pollResponse = await fetch(pollEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operationName: operationName
      })
    });
    
    if (!pollResponse.ok) {
      const pollError = await pollResponse.text();
      console.error(`[${requestId}] Poll error response:`, pollError);
      throw new Error(`Poll error: ${pollResponse.status} - ${pollError}`);
    }
    
    const pollData = await pollResponse.json();
    console.log(`[${requestId}] Poll response done: ${pollData.done}`);
    
    if (pollData.done) {
      console.log(`[${requestId}] Operation COMPLETE!`);
      
      if (pollData.error) {
        console.error(`[${requestId}] Operation failed:`, pollData.error);
        throw new Error(`Veo generation failed: ${pollData.error.message}`);
      }
      
      console.log(`[${requestId}] Response structure:`, Object.keys(pollData.response || {}));
      
      // Extract video from response - Veo 3 Preview format
      // Response has videos array with gcsUri field
      const videos = pollData.response?.videos;
      if (videos && videos.length > 0) {
        console.log(`[${requestId}] Found ${videos.length} video(s) in response.videos`);
        const videoResult = videos[0];
        console.log(`[${requestId}] Video result keys:`, Object.keys(videoResult));
        
        // Check for GCS URI (primary method for Veo 3)
        if (videoResult.gcsUri) {
          console.log(`[${requestId}] Fetching video from GCS: ${videoResult.gcsUri}`);
          try {
            const videoResponse = await fetch(videoResult.gcsUri);
            console.log(`[${requestId}] GCS fetch status: ${videoResponse.status}`);
            if (videoResponse.ok) {
              const videoBuffer = await videoResponse.buffer();
              console.log(`[${requestId}] Video buffer size: ${videoBuffer.length} bytes`);
              return `data:video/mp4;base64,${videoBuffer.toString('base64')}`;
            } else {
              console.error(`[${requestId}] GCS fetch failed: ${videoResponse.status}`);
            }
          } catch (gcsError) {
            console.error(`[${requestId}] GCS fetch error:`, gcsError.message);
          }
        }
        
        // Check for base64 encoded video
        if (videoResult.bytesBase64Encoded) {
          console.log(`[${requestId}] Using base64 encoded video`);
          return `data:video/mp4;base64,${videoResult.bytesBase64Encoded}`;
        }
      }
      
      // Fallback: check predictions array (older format)
      const predictions = pollData.response?.predictions;
      if (predictions && predictions.length > 0) {
        console.log(`[${requestId}] Found ${predictions.length} prediction(s)`);
        const videoResult = predictions[0];
        console.log(`[${requestId}] Prediction keys:`, Object.keys(videoResult));
        
        if (videoResult.bytesBase64Encoded) {
          console.log(`[${requestId}] Using base64 from predictions`);
          return `data:video/mp4;base64,${videoResult.bytesBase64Encoded}`;
        }
        
        if (videoResult.gcsUri) {
          console.log(`[${requestId}] Fetching from predictions GCS: ${videoResult.gcsUri}`);
          try {
            const videoResponse = await fetch(videoResult.gcsUri);
            if (videoResponse.ok) {
              const videoBuffer = await videoResponse.buffer();
              return `data:video/mp4;base64,${videoBuffer.toString('base64')}`;
            }
          } catch (gcsError) {
            console.error(`[${requestId}] Predictions GCS error:`, gcsError.message);
          }
        }
      }
      
      // Log the full response for debugging
      console.error(`[${requestId}] ERROR: No video data found in completed operation`);
      console.error(`[${requestId}] Full poll response:`, JSON.stringify(pollData, null, 2));
      throw new Error('No video data in completed operation');
    }
    
    console.log(`[${requestId}] Operation still in progress...`);
  }
  
  console.error(`[${requestId}] ERROR: Polling timed out after ${maxAttempts} attempts`);
  throw new Error('Veo video generation timed out');
}

// Generate Hedra video
async function generateHedraVideo(scriptText, direction, referenceImage, country, model = 'character-3', voiceAccent = 'american') {
  const hedraApiKey = 'sk_hedra_UDZSVtynJwIvC6K3kltBWTxA6XHP2f91yy1rjhMtu2WZaznceU0gd-HRuH2A5jog';
  
  console.log(`Generating Hedra video with model: ${model}, voice: ${voiceAccent}...`);
  
  try {
    // Step 1: Initialize character creation
    const initResponse = await fetch('https://api.hedra.com/v1/characters', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hedraApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: referenceImage.replace(/^data:image\/\w+;base64,/, ''),
        aspect_ratio: '9:16',
        model: model
      })
    });
    
    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(`Hedra init error: ${error.message || initResponse.status}`);
    }
    
    const initData = await initResponse.json();
    const characterId = initData.character_id;
    
    // Step 2: Generate audio from script (using TTS with voice accent)
    const audioUrl = await generateTTS(scriptText, hedraApiKey, voiceAccent);
    
    // Step 3: Generate video with character and audio
    const videoResponse = await fetch('https://api.hedra.com/v1/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hedraApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        character_id: characterId,
        audio_url: audioUrl,
        motion_description: direction,
        duration: 8
      })
    });
    
    if (!videoResponse.ok) {
      const error = await videoResponse.json();
      throw new Error(`Hedra video error: ${error.message || videoResponse.status}`);
    }
    
    const videoData = await videoResponse.json();
    
    // Step 4: Poll for video completion
    const videoUrl = await pollHedraVideo(videoData.video_id, hedraApiKey);
    
    return videoUrl;
    
  } catch (error) {
    console.error('Hedra generation error:', error);
    throw error;
  }
}

// Helper: Generate TTS audio (placeholder - integrate with ElevenLabs)
async function generateTTS(text, apiKey, voiceAccent = 'american') {
  // For now, return a placeholder
  // In production, integrate with ElevenLabs using the voiceAccent parameter
  console.log('TTS generation placeholder for:', text.substring(0, 50) + '...');
  console.log('Voice accent:', voiceAccent);
  return 'https://placeholder-audio-url.mp3';
}

// Helper: Poll for Hedra video completion
async function pollHedraVideo(videoId, apiKey, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://api.hedra.com/v1/videos/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Poll error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'completed' && data.video_url) {
      return data.video_url;
    }
    
    if (data.status === 'failed') {
      throw new Error('Hedra video generation failed');
    }
    
    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Hedra video generation timed out');
}

// Generate Kling video (placeholder - needs Kling API key)
async function generateKlingVideo(scriptText, direction, referenceImage, country, videoStyle = 'UGC Talking', voiceAccent = 'american', styleParams = null) {
  const klingApiKey = process.env.KLING_API_KEY;
  if (!klingApiKey) {
    throw new Error('KLING_API_KEY not configured');
  }
  
  console.log('Kling video generation:');
  console.log('  Style:', videoStyle);
  console.log('  Voice:', voiceAccent);
  
  // Implement Kling API call here
  throw new Error('Kling integration not yet implemented');
}

// Generate avatar prompts endpoint
app.post('/generate-avatar-prompts', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  
  if (!geminiKey) {
    return res.status(400).json({ error: 'Gemini API key not configured' });
  }

  const { intel, selections } = req.body;
  
  if (!intel || !selections) {
    return res.status(400).json({ error: 'intel and selections are required' });
  }

  try {
    const genderTerm = intel.targetAudience === 'Women' ? 'woman' : intel.targetAudience === 'Men' ? 'man' : 'person';
    const age = "late 20s to mid 30s";
    
    const HYPER_REALISM_PROMPT = `Mandatory Realism Directives:
- Cinematic hyper-realism: 8k resolution, raw photo quality.
- Skin Detail: Visible pores, natural moles, slight oily sheen on the T-zone, realistic skin texture.
- Anatomy: Realistic fingers and hands (natural knuckles, varied fingernail shapes), realistic posture holding the product.
- Clothing: Detailed fabric weave, natural wrinkles.
- Lighting: Volumetric natural light, soft shadows, 50mm f/1.2 lens bokeh.
- Character: A real-looking person, not a model.`;
    
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Generate 3 unique, hyper-realistic image prompts for a UGC avatar variation.` }] }],
        systemInstruction: {
          parts: [{ text: `CORE RULES:
          1. Gender: The avatar must be a ${genderTerm} (${age}) based on product intel.
          2. Scene: The environment MUST be a ${selections.scene} set specifically in ${selections.country}.
          3. Action: The avatar MUST be holding the product "${intel.title}" naturally.
          4. Quality: ${HYPER_REALISM_PROMPT}` }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: { type: "STRING" }
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const prompts = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '[]');
    res.json(prompts);
  } catch (error) {
    console.error('Avatar prompts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate consistent angle endpoint
app.post('/generate-consistent-angle', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  
  if (!geminiKey) {
    return res.status(400).json({ error: 'Gemini API key not configured' });
  }

  const { sourceImage, index, intel, selections, refImages } = req.body;
  
  if (!sourceImage || index === undefined || !intel || !selections) {
    return res.status(400).json({ error: 'sourceImage, index, intel, and selections are required' });
  }

  try {
    const variations = [
      "Angle 1: Close-up, direct-to-camera portrait. The character is looking straight at the lens, centered framing, showcasing the face and product clearly. Same hair, outfit, and lighting.",
      "Angle 2: 45-degree side profile view, medium shot. The character is turned slightly away from the camera, looking toward the product. Show a different part of the same room/scene background to create depth.",
      "Angle 3: Wider shot, different position. The character is now in a different area of the environment (e.g., sitting vs standing), showing more of the environment. Different posture.",
      "Angle 4: Over-the-shoulder or three-quarter view. The character is engaged with the product, showing the back/side of their head and shoulders while still being recognizable.",
      "Angle 5: Full body or wide shot showing the character in the full environment context, demonstrating the product in use within the space."
    ];

    const varPrompt = variations[index] || variations[0];

    const HYPER_REALISM_PROMPT = `Mandatory Realism Directives:
- Cinematic hyper-realism: 8k resolution, raw photo quality.
- Skin Detail: Visible pores, natural moles, slight oily sheen on the T-zone, realistic skin texture.
- Anatomy: Realistic fingers and hands (natural knuckles, varied fingernail shapes), realistic posture holding the product.
- Clothing: Detailed fabric weave, natural wrinkles.
- Lighting: Volumetric natural light, soft shadows, 50mm f/1.2 lens bokeh.
- Character: A real-looking person, not a model.`;

    // Build parts array with reference images first (if provided)
    const parts = [];
    
    // Add reference product images first so AI sees them clearly
    if (refImages && refImages.length > 0) {
      parts.push({ text: "STRICT PRODUCT REFERENCE: The EXACT product shown in these reference images MUST be used. Do NOT change, modify, or hallucinate a different product. The product design, color, shape, and features must match exactly:" });
      refImages.forEach(img => {
        const base64Data = img.split(',')[1];
        parts.push({ 
          inlineData: { 
            data: base64Data, 
            mimeType: "image/jpeg" 
          } 
        });
      });
    }
    
    // Add source character image
    parts.push({ inlineData: { data: sourceImage.split(',')[1], mimeType: "image/png" } });
    
    // Add the main prompt with strict product consistency
    parts.push({ text: `You are an expert at creating visual consistency. 
REQUIRED: Generate a new image of the EXACT SAME CHARACTER as seen in this reference image. 
Instruction: ${varPrompt}.
Character Consistency: Identical face, identical hair, identical clothing, identical skin texture.
The camera angle, framing, and area of the house MUST be different from the reference image, but the person MUST be identical.
Environment: ${selections.scene} in ${selections.country}.

ABSOLUTE PRODUCT CONSISTENCY RULE:
- The character MUST be holding or interacting with the EXACT SAME PRODUCT as shown in the reference product images above
- The product design, color, shape, packaging, and ALL visual features must match the reference EXACTLY
- Do NOT create a different version, color, or style of the product
- Do NOT hallucinate product details - use ONLY what is shown in the reference images
- The product MUST be clearly visible and identifiable in the generated image
- If the product has text/logos, they must be legible and correct

CRITICAL PRODUCT VISIBILITY: The product MUST be fully visible and clearly identifiable. Not obscured by hands or body positioning. The product is the focal point.
Quality: ${HYPER_REALISM_PROMPT}` });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=' + geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    const imageUrl = part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : "";
    
    res.json({ imageUrl });
  } catch (error) {
    console.error('Consistent angle error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate script endpoint
app.post('/generate-script', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  
  if (!geminiKey) {
    return res.status(400).json({ error: 'Gemini API key not configured' });
  }

  const { intel, selections, framework, videoStyle, voiceAccent } = req.body;
  
  if (!intel || !selections || !framework) {
    return res.status(400).json({ error: 'intel, selections, and framework are required' });
  }

  try {
    const duration = selections.duration || 32;
    const numSegments = duration / 8;
    
    const stylePrompts = {
      'UGC Talking': `Style: Authentic user-generated content. Direct-to-camera, conversational, energetic. Speaker talks TO the viewer like a friend.`,
      'Narrative Voiceover': `Style: Storytelling narrator. Third-person perspective describing a scene or journey. More cinematic and descriptive.`,
      'Cinematic': `Style: High-production commercial. Dramatic lighting references, emotional storytelling, premium feel. Less direct address, more visual storytelling.`
    };
    
    const voiceDescriptions = {
      'american': 'American English accent',
      'british': 'British English accent',
      'australian': 'Australian English accent',
      'indian': 'Indian English accent',
      'south-african': 'South African English accent',
      'american-female': 'American female voice',
      'british-female': 'British female voice',
      'australian-female': 'Australian female voice',
      'indian-female': 'Indian female voice',
      'south-african-female': 'South African female voice'
    };

    // Build segment descriptions based on number of segments
    let segmentDescriptions = '';
    if (numSegments === 1) {
      segmentDescriptions = `
- Total duration: 8 seconds (1 complete segment).
- Format: Complete story in one segment - Hook, product introduction, benefit, and CTA all together.`;
    } else if (numSegments === 2) {
      segmentDescriptions = `
- Total duration: 16 seconds (2 segments × 8 seconds each).
- Format: 
  * Segment 1 (The Hook): Grab attention, introduce the problem, hint at solution
  * Segment 2 (The CTA): Product reveal, key benefit, call to action`;
    } else if (numSegments === 3) {
      segmentDescriptions = `
- Total duration: 24 seconds (3 segments × 8 seconds each).
- Format: 
  * Segment 1 (The Hook): Grab attention, introduce the problem/curiosity
  * Segment 2 (The Demo): Product in action, key benefits
  * Segment 3 (The CTA): Call to action, final benefit, urgency`;
    } else if (numSegments === 4) {
      segmentDescriptions = `
- Total duration: 32 seconds (4 segments × 8 seconds each).
- Format: 
  * Segment 1 (The Hook): Grab attention, introduce the problem/curiosity
  * Segment 2 (The Setup): Build context, introduce the product naturally
  * Segment 3 (The Demonstration): Show the product in action, key benefits
  * Segment 4 (The CTA/Resolution): Call to action, final benefit, urgency`;
    } else if (numSegments === 5) {
      segmentDescriptions = `
- Total duration: 40 seconds (5 segments × 8 seconds each).
- Format: 
  * Segment 1 (The Hook): Grab attention, introduce the problem/curiosity
  * Segment 2 (The Context): Build context, set up the story
  * Segment 3 (The Setup): Introduce the product naturally
  * Segment 4 (The Demonstration): Show the product in action, key benefits
  * Segment 5 (The CTA/Resolution): Call to action, final benefit, urgency`;
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Write a high-converting UGC script for ${intel.title} in ${selections.country} following the ${framework} framework.` }] }],
        systemInstruction: {
          parts: [{ text: `CRITICAL: Split the campaign into ${numSegments} distinct segments that flow together as ONE continuous story. Each segment must be exactly 8 seconds long when spoken.
          ${segmentDescriptions}
  
STORY FLOW REQUIREMENTS:
- Each segment MUST end with a natural transition to the next
- The narrative should feel like one continuous ${duration}-second story
- Each segment should build on the previous one

- Tone: ${intel.brandTone}.
- ${stylePrompts[videoStyle || 'UGC Talking']}
- Voice: Native ${voiceDescriptions[voiceAccent || 'american']} speaker, ${intel.targetAudience === 'Women' ? 'female' : intel.targetAudience === 'Men' ? 'male' : 'gender-neutral'} voice.
- Use the SAME voice/accent consistently across all ${numSegments} segments.

STRICT TIMING RULE - READ CAREFULLY:
- Average speaking rate is 130-150 words per minute
- For 8 seconds: MAXIMUM 18-20 words per segment (ideally 15-18 words)
- Each segment text MUST be brief, punchy, and fit in exactly 8 seconds
- NO long sentences - use short, impactful phrases
- If the text is too long, the video will be cut off mid-sentence
- Example good 8s script: "This changed everything. One sip and I knew - this isn't just coffee. It's fuel." (15 words)`, }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                text: { type: "STRING" },
                direction: { type: "STRING" }
              },
              required: ["text", "direction"]
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    let segments = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '[]');
    
    // Validate and log word counts for each segment
    segments = segments.map((segment, idx) => {
      const wordCount = segment.text.split(/\s+/).filter(w => w.length > 0).length;
      console.log(`Segment ${idx + 1}: ${wordCount} words - "${segment.text.substring(0, 50)}..."`);
      
      // Warn if too long (over 20 words for 8 seconds)
      if (wordCount > 20) {
        console.warn(`WARNING: Segment ${idx + 1} has ${wordCount} words - may exceed 8 seconds`);
      }
      
      return segment;
    });
    
    res.json(segments);
  } catch (error) {
    console.error('Script generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get quota/status endpoint
app.get('/status', async (req, res) => {
  try {
    // Check if we can get an access token
    const auth = new GoogleAuth({
      keyFile: path.join(__dirname, 'service-account-key.json'),
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    const client = await auth.getClient();
    await client.getAccessToken();
    
    res.json({ 
      status: 'connected', 
      projectId: SERVICE_ACCOUNT.project_id,
      message: 'Google Cloud authentication working'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Seedream 4.0/4.5 image generation endpoint - $0.03-0.04 per image
app.post('/generate-image-seedream', async (req, res) => {
  const seedreamKey = process.env.SEEDREAM_API_KEY || process.env.BYTEPLUS_API_KEY;
  
  if (!seedreamKey) {
    return res.status(400).json({ 
      error: 'Seedream API key not configured. Add SEEDREAM_API_KEY to environment.',
      fallback: 'Use /generate-image for Gemini 3 Pro ($0.78/image)'
    });
  }

  const { prompt, refImages, width = 2048, height = 2048, version = '4.0' } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    // Map version to model ID
    const modelMap = {
      '4.0': 'seedream-4-0-250828',
      '4.5': 'seedream-4-5-251128',
      '5.0': 'seedream-5-0-lite',  // Placeholder - update when API released
      '5.0-lite': 'seedream-5-0-lite'
    };
    
    const modelVersion = modelMap[version] || 'seedream-4-5-251128';
    
    // Pricing (estimated for 5.0)
    const costMap = {
      '4.0': 0.03,
      '4.5': 0.04,
      '5.0': 0.05,  // Estimated - may change
      '5.0-lite': 0.03  // Estimated - may change
    };
    const cost = costMap[version] || 0.04;
    
    console.log(`[Seedream ${version}] Generating image...`);
    console.log(`[Seedream ${version}] Model: ${modelVersion}`);
    console.log(`[Seedream ${version}] Cost: $${cost} per image`);
    
    // Build request for Seedream
    const requestBody = {
      model: modelVersion,
      prompt: prompt,
      width: width,
      height: height,
      sequential_image_generation: 'disabled'
    };
    
    // Add reference images if provided
    if (refImages && refImages.length > 0) {
      requestBody.reference_images = refImages.map(img => ({
        data: img.replace(/^data:image\/\w+;base64,/, ''),
        mime_type: 'image/jpeg'
      }));
    }

    // Call BytePlus/Seedream API
    const response = await fetch('https://ark.ap-southeast.bytepluses.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${seedreamKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Seedream ${version}] Error:`, errorText);
      return res.status(response.status).json({
        error: `Seedream API error: ${response.status}`,
        details: errorText,
        fallback: 'Try /generate-image for Gemini 3 Pro'
      });
    }

    const data = await response.json();
    
    if (data.data && data.data.length > 0 && data.data[0].url) {
      // Fetch the image and convert to base64
      const imageResponse = await fetch(data.data[0].url);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.buffer();
        const base64Image = imageBuffer.toString('base64');
        
        console.log(`[Seedream ${version}] Image generated successfully`);
        console.log(`[Seedream ${version}] Charged: $${cost}`);
        
        res.json({ 
          imageUrl: `data:image/jpeg;base64,${base64Image}`,
          provider: `seedream-${version}`,
          cost: cost,
          resolution: `${width}x${height}`
        });
      } else {
        throw new Error('Failed to fetch generated image');
      }
    } else {
      throw new Error('No image in response');
    }
  } catch (error) {
    console.error(`[Seedream ${version}] Generation error:`, error);
    res.status(500).json({ 
      error: error.message,
      fallback: 'Use /generate-image for Gemini 3 Pro ($0.78/image)'
    });
  }
});

// Seedream 4.0/4.5 consistent angle generation endpoint
app.post('/generate-consistent-angle-seedream', async (req, res) => {
  const seedreamKey = process.env.SEEDREAM_API_KEY || process.env.BYTEPLUS_API_KEY;
  
  if (!seedreamKey) {
    return res.status(400).json({ 
      error: 'Seedream API key not configured',
      fallback: 'Use /generate-consistent-angle for Gemini 3 Pro'
    });
  }

  const { sourceImage, index, intel, selections, refImages, version = '4.5' } = req.body;
  
  if (!sourceImage || index === undefined || !intel || !selections) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const modelVersion = version === '4.5' ? 'seedream-4-5-251128' : 'seedream-4-0-250828';
    const cost = version === '4.5' ? 0.04 : 0.03;
    
    console.log(`[Seedream ${version}] Generating consistent angle ${index + 1}...`);
    
    // Build prompt for consistent angle
    const anglePrompts = [
      "Close-up, direct-to-camera portrait. Character looking straight at lens, centered framing, showcasing face and product clearly.",
      "45-degree side profile view, medium shot. Character turned slightly away from camera, looking toward product.",
      "Wider shot, different position. Character in different area of environment, showing more of the scene.",
      "Over-the-shoulder or three-quarter view. Character engaged with product, showing back/side of head and shoulders.",
      "Full body or wide shot. Character in full environment context, demonstrating product in use."
    ];
    
    const anglePrompt = anglePrompts[index] || anglePrompts[0];
    
    const prompt = `Generate a new camera angle of the EXACT SAME CHARACTER from the reference image. 
${anglePrompt}
Setting: ${selections.scene} in ${selections.country}.
Character must be holding or interacting with ${intel.title}.
Maintain identical face, hair, clothing, and skin texture.
Cinematic hyper-realism, 8k quality, natural lighting.`;

    // Build request
    const requestBody = {
      model: modelVersion,
      prompt: prompt,
      width: 2048,
      height: 2048,
      sequential_image_generation: 'disabled',
      reference_images: [
        {
          data: sourceImage.replace(/^data:image\/\w+;base64,/, ''),
          mime_type: 'image/png'
        }
      ]
    };
    
    // Add product reference images if provided
    if (refImages && refImages.length > 0) {
      refImages.forEach(img => {
        requestBody.reference_images.push({
          data: img.replace(/^data:image\/\w+;base64,/, ''),
          mime_type: 'image/jpeg'
        });
      });
    }

    // Call Seedream API
    const response = await fetch('https://ark.ap-southeast.bytepluses.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${seedreamKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Seedream ${version}] Angle ${index + 1} error:`, errorText);
      return res.status(response.status).json({
        error: `Seedream API error: ${response.status}`,
        fallback: 'Use /generate-consistent-angle for Gemini 3 Pro'
      });
    }

    const data = await response.json();
    
    if (data.data && data.data.length > 0 && data.data[0].url) {
      const imageResponse = await fetch(data.data[0].url);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.buffer();
        const base64Image = imageBuffer.toString('base64');
        
        console.log(`[Seedream ${version}] Angle ${index + 1} generated - Cost: $${cost}`);
        
        res.json({ 
          imageUrl: `data:image/jpeg;base64,${base64Image}`,
          provider: `seedream-${version}`,
          cost: cost,
          angle: index + 1
        });
      } else {
        throw new Error('Failed to fetch generated image');
      }
    } else {
      throw new Error('No image in response');
    }
  } catch (error) {
    console.error(`[Seedream] Angle generation error:`, error);
    res.status(500).json({ 
      error: error.message,
      fallback: 'Use /generate-consistent-angle for Gemini 3 Pro'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎬 Cinematic UGC Proxy Server v2.0 running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Status check: http://localhost:${PORT}/status`);
  console.log(`🔑 Using Gemini API for Veo generation`);
  console.log(`🚀 Seedream 4.0 ready for image generation ($0.03/image)`);
});
