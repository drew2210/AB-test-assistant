import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { analyzeAbResultsScreenshot } from './server/abScreenshotAnalysis.js';

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      resolve(body);
    });

    req.on('error', reject);
  });
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function screenshotParserPlugin() {
  return {
    name: 'local-screenshot-parser',
    configureServer(server) {
      server.middlewares.use('/api/parse-ab-results', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed.' });
          return;
        }

        try {
          const rawBody = await readRequestBody(req);
          const payload = JSON.parse(rawBody || '{}');

          const result = await analyzeAbResultsScreenshot({
            ...payload,
            provider: process.env.SCREENSHOT_AI_PROVIDER || 'openai',
            openAiApiKey: process.env.OPENAI_API_KEY,
            geminiApiKey: process.env.GEMINI_API_KEY,
            openAiModel: process.env.OPENAI_MODEL || undefined,
            geminiModel: process.env.GEMINI_MODEL || undefined,
          });

          sendJson(res, 200, result);
        } catch (error) {
          sendJson(res, error?.statusCode || 500, {
            error:
              error?.message ||
              'The screenshot parser could not analyze the upload right now.',
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), screenshotParserPlugin()],
  };
});
