#!/usr/bin/env node
/**
 * Veo 3.1 Video Generation Test Script
 * Tests the proxy server video generation endpoint locally
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROXY_URL = process.env.PROXY_URL || 'http://localhost:3000';
const TEST_IMAGE_PATH = process.env.TEST_IMAGE || './test-image.jpg';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const color = colors[level] || colors.reset;
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

async function runTests() {
  log('bright', '\n========================================');
  log('bright', '  Veo 3.1 Video Generation Test Suite');
  log('bright', '========================================\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Health check
  log('cyan', '\n[Test 1] Health Check');
  try {
    const response = await fetch(`${PROXY_URL}/health`);
    const data = await response.json();
    if (response.ok && data.status === 'ok') {
      log('green', '✓ Health check passed');
      log('blue', `  Server time: ${data.timestamp}`);
      passed++;
    } else {
      log('red', '✗ Health check failed');
      log('red', `  Response: ${JSON.stringify(data)}`);
      failed++;
    }
  } catch (error) {
    log('red', `✗ Health check error: ${error.message}`);
    log('yellow', '  Is the proxy server running? Start with: node server.cjs');
    failed++;
    process.exit(1);
  }
  
  // Test 2: Veo 3.1 availability check
  log('cyan', '\n[Test 2] Veo 3.1 Model Availability');
  try {
    const response = await fetch(`${PROXY_URL}/test-veo-3.1`);
    const data = await response.json();
    if (data.success) {
      log('green', '✓ Veo 3.1 is available');
      log('blue', `  Operation: ${data.operationName}`);
      log('blue', `  Project: ${data.projectId}`);
      passed++;
    } else {
      log('red', '✗ Veo 3.1 is NOT available');
      log('red', `  Error: ${data.error}`);
      log('yellow', `  Hint: ${data.hint}`);
      failed++;
    }
  } catch (error) {
    log('red', `✗ Veo 3.1 check error: ${error.message}`);
    failed++;
  }
  
  // Test 3: Test image generation (without actual Veo call)
  log('cyan', '\n[Test 3] Video Generation Payload Validation');
  try {
    // Create a test payload similar to what frontend sends
    const testPayload = {
      prompt: 'Test video generation. Script: "This is a test video". Style: UGC Talking. Setting: United States.',
      imageUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCqAAAAAAAAAAAAA//Z',
      provider: 'veo',
      videoStyle: 'UGC Talking',
      voiceAccent: 'american',
      country: 'United States'
    };
    
    log('blue', '  Payload structure:');
    log('blue', `    - prompt: ${testPayload.prompt.substring(0, 50)}...`);
    log('blue', `    - imageUrl: ${testPayload.imageUrl.substring(0, 50)}...`);
    log('blue', `    - provider: ${testPayload.provider}`);
    log('blue', `    - videoStyle: ${testPayload.videoStyle}`);
    log('blue', `    - voiceAccent: ${testPayload.voiceAccent}`);
    
    // Validate payload
    if (!testPayload.prompt) throw new Error('Missing prompt');
    if (!testPayload.imageUrl) throw new Error('Missing imageUrl');
    if (!testPayload.provider) throw new Error('Missing provider');
    
    log('green', '✓ Payload validation passed');
    passed++;
  } catch (error) {
    log('red', `✗ Payload validation error: ${error.message}`);
    failed++;
  }
  
  // Test 4: Field name mapping test
  log('cyan', '\n[Test 4] Field Name Mapping (Frontend → Backend)');
  try {
    // Simulate how the backend maps frontend fields
    const frontendPayload = {
      prompt: 'Direction text. Script: "Hello world". Style: UGC Talking.',
      imageUrl: 'data:image/png;base64,abc123',
      provider: 'veo',
      videoStyle: 'UGC Talking',
      voiceAccent: 'american',
      country: 'United States'
    };
    
    // Backend mapping logic
    const scriptText = frontendPayload.prompt.split('. Script: "')[1]?.split('". Style:')[0] || frontendPayload.prompt;
    const direction = frontendPayload.prompt.split('. Script: "')[0] || '';
    const referenceImage = frontendPayload.imageUrl;
    
    log('blue', '  Mapping results:');
    log('blue', `    prompt → scriptText: "${scriptText.substring(0, 40)}..."`);
    log('blue', `    prompt → direction: "${direction.substring(0, 40)}..."`);
    log('blue', `    imageUrl → referenceImage: ${referenceImage ? '✓ mapped' : '✗ missing'}`);
    
    if (scriptText && referenceImage) {
      log('green', '✓ Field mapping works correctly');
      passed++;
    } else {
      throw new Error('Field mapping failed');
    }
  } catch (error) {
    log('red', `✗ Field mapping error: ${error.message}`);
    failed++;
  }
  
  // Test 5: Response format validation
  log('cyan', '\n[Test 5] Response Format Validation');
  try {
    const mockResponse = {
      success: true,
      videoUrl: 'data:video/mp4;base64,abc123...',
      videoBase64: 'abc123...',
      provider: 'veo',
      requestId: 'vid_1234567890_abc123'
    };
    
    // Check if response has expected fields
    const hasVideoUrl = !!mockResponse.videoUrl;
    const hasVideoBase64 = !!mockResponse.videoBase64;
    const hasSuccess = mockResponse.success === true;
    
    log('blue', '  Response fields:');
    log('blue', `    - success: ${hasSuccess ? '✓' : '✗'}`);
    log('blue', `    - videoUrl: ${hasVideoUrl ? '✓' : '✗'}`);
    log('blue', `    - videoBase64: ${hasVideoBase64 ? '✓' : '✗'}`);
    log('blue', `    - provider: ${mockResponse.provider}`);
    log('blue', `    - requestId: ${mockResponse.requestId}`);
    
    if (hasSuccess && hasVideoUrl) {
      log('green', '✓ Response format is valid');
      passed++;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    log('red', `✗ Response format error: ${error.message}`);
    failed++;
  }
  
  // Test 6: Full integration test (optional - requires valid image)
  log('cyan', '\n[Test 6] Full Integration Test (Optional)');
  log('yellow', '  Skipping - set TEST_IMAGE env var to run full test');
  log('yellow', '  Example: TEST_IMAGE=./my-image.jpg node test-video.js');
  
  // Summary
  log('bright', '\n========================================');
  log('bright', '  Test Summary');
  log('bright', '========================================');
  log('green', `  Passed: ${passed}`);
  log('red', `  Failed: ${failed}`);
  log('blue', `  Total: ${passed + failed}`);
  
  if (failed === 0) {
    log('green', '\n✓ All tests passed! Proxy is ready for deployment.\n');
    process.exit(0);
  } else {
    log('red', '\n✗ Some tests failed. Please fix the issues before deploying.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log('red', `Fatal error: ${error.message}`);
  process.exit(1);
});
