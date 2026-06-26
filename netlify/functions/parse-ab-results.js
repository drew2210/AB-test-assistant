import { analyzeAbResultsScreenshot } from '../../server/abScreenshotAnalysis.js';

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const payload = JSON.parse(event.body || '{}');

    const result = await analyzeAbResultsScreenshot({
      ...payload,
      provider: process.env.SCREENSHOT_AI_PROVIDER || 'openai',
      openAiApiKey: process.env.OPENAI_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
      openAiModel: process.env.OPENAI_MODEL || undefined,
      geminiModel: process.env.GEMINI_MODEL || undefined,
    });

    return json(result);
  } catch (error) {
    return json(
      {
        error:
          error?.message ||
          'The screenshot parser could not analyze the upload right now.',
      },
      error?.statusCode || 500,
    );
  }
}
