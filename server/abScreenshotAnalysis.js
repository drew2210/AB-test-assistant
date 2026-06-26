import fs from 'node:fs';
import path from 'node:path';

const OUTPUTS_DIR = path.resolve(process.cwd(), 'outputs');
const DASHBOARD_GUIDE_PATH = path.join(
  OUTPUTS_DIR,
  'ab_results_dashboard_guide.md',
);
const PARSE_SCHEMA_PATH = path.join(
  OUTPUTS_DIR,
  'ab_results_parse_schema.json',
);
const PARSER_PROMPT_PATH = path.join(
  OUTPUTS_DIR,
  'ab_results_parser_prompt.txt',
);

const dashboardGuide = fs.readFileSync(DASHBOARD_GUIDE_PATH, 'utf8');
const parseSchemaTemplate = JSON.parse(fs.readFileSync(PARSE_SCHEMA_PATH, 'utf8'));
const parserPrompt = fs.readFileSync(PARSER_PROMPT_PATH, 'utf8');

const DEFAULT_FAILURE_MESSAGE =
  'The screenshot was parsed, but there was not enough visible detail to produce a confident summary. Please upload a tighter crop showing the control/variant cards and at least one metric table with confidence information.';

const OPENAI_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'screenshot_quality',
    'test_overview',
    'variant_summary',
    'visible_tabs',
    'metrics',
    'insights',
    'parser_summary',
  ],
  properties: {
    screenshot_quality: {
      type: 'object',
      additionalProperties: false,
      required: ['usable', 'reason', 'missing_detail'],
      properties: {
        usable: { type: 'boolean' },
        reason: { type: ['string', 'null'] },
        missing_detail: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    test_overview: {
      type: 'object',
      additionalProperties: false,
      required: ['test_name', 'date_range_or_duration', 'status'],
      properties: {
        test_name: { type: ['string', 'null'] },
        date_range_or_duration: { type: ['string', 'null'] },
        status: { type: 'string' },
      },
    },
    variant_summary: {
      type: 'object',
      additionalProperties: false,
      required: ['control', 'variant'],
      properties: {
        control: {
          type: 'object',
          additionalProperties: false,
          required: ['index_name', 'tracked_searches', 'summary_text'],
          properties: {
            index_name: { type: ['string', 'null'] },
            tracked_searches: { type: ['string', 'null'] },
            summary_text: { type: ['string', 'null'] },
          },
        },
        variant: {
          type: 'object',
          additionalProperties: false,
          required: ['index_name', 'tracked_searches', 'summary_text'],
          properties: {
            index_name: { type: ['string', 'null'] },
            tracked_searches: { type: ['string', 'null'] },
            summary_text: { type: ['string', 'null'] },
          },
        },
      },
    },
    visible_tabs: {
      type: 'array',
      items: { type: 'string' },
    },
    metrics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'tab',
          'metric_name',
          'control_value',
          'variant_value',
          'difference_vs_control',
          'confidence_label',
          'confidence_interval_crosses_zero',
          'notes',
        ],
        properties: {
          tab: { type: 'string' },
          metric_name: { type: 'string' },
          control_value: { type: ['string', 'null'] },
          variant_value: { type: ['string', 'null'] },
          difference_vs_control: { type: ['string', 'null'] },
          confidence_label: { type: 'string' },
          confidence_interval_crosses_zero: { type: 'boolean' },
          notes: { type: ['string', 'null'] },
        },
      },
    },
    insights: {
      type: 'object',
      additionalProperties: false,
      required: [
        'confidence_over_time_visible',
        'revenue_chart_visible',
        'declare_winner_visible',
        'view_analytics_visible',
      ],
      properties: {
        confidence_over_time_visible: { type: 'boolean' },
        revenue_chart_visible: { type: 'boolean' },
        declare_winner_visible: { type: 'boolean' },
        view_analytics_visible: { type: 'boolean' },
      },
    },
    parser_summary: {
      type: 'object',
      additionalProperties: false,
      required: [
        'primary_readable_takeaway',
        'confidence_of_summary',
        'recommended_follow_up',
      ],
      properties: {
        primary_readable_takeaway: { type: 'string' },
        confidence_of_summary: { type: 'string' },
        recommended_follow_up: { type: 'string' },
      },
    },
  },
};

function createError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function validateImageDataUrl(imageDataUrl) {
  if (
    !imageDataUrl ||
    typeof imageDataUrl !== 'string' ||
    !imageDataUrl.startsWith('data:image/')
  ) {
    throw createError('Please upload a PNG, JPG, or WebP image screenshot.', 400);
  }
}

function readOpenAiOutputText(responseJson) {
  if (
    typeof responseJson.output_text === 'string' &&
    responseJson.output_text.trim()
  ) {
    return responseJson.output_text;
  }

  const chunks =
    responseJson.output
      ?.flatMap((item) => item.content || [])
      ?.filter((item) => item.type === 'output_text')
      ?.map((item) => item.text) || [];

  return chunks.join('\n').trim();
}

function readGeminiOutputText(responseJson) {
  const parts =
    responseJson.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      ?.filter(Boolean) || [];

  return parts.join('\n').trim();
}

function extractBase64Data(imageDataUrl) {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw createError('The uploaded screenshot format could not be read.', 400);
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function parseJsonText(outputText, providerName) {
  if (!outputText) {
    throw createError(
      `The ${providerName} screenshot parser returned an empty response.`,
      502,
    );
  }

  try {
    return JSON.parse(outputText);
  } catch {
    throw createError(
      `The ${providerName} screenshot parser returned a response that could not be read.`,
      502,
    );
  }
}

function ensureParsedShape(parsed) {
  const hasRootKeys =
    parsed &&
    typeof parsed === 'object' &&
    'screenshot_quality' in parsed &&
    'test_overview' in parsed &&
    'variant_summary' in parsed &&
    'visible_tabs' in parsed &&
    'metrics' in parsed &&
    'insights' in parsed &&
    'parser_summary' in parsed;

  if (!hasRootKeys) {
    throw createError(
      'The screenshot parser returned JSON, but it did not match the required parser schema.',
      502,
    );
  }
}

function buildFailureMessage(parsed) {
  const missingDetails = sanitizeStringArray(
    parsed?.screenshot_quality?.missing_detail,
  );
  const reason =
    sanitizeString(parsed?.screenshot_quality?.reason) ||
    DEFAULT_FAILURE_MESSAGE;
  const readableMissing = missingDetails.length
    ? missingDetails
    : [
        'control/variant cards not readable',
        'metric table not visible',
        'confidence label not readable',
        'text too small',
      ];

  return {
    success: false,
    userMessage: reason,
    summary: reason,
    fallbackUserMessage: `${reason} Please upload a tighter crop of the metric table and the control/variant cards instead of a full-screen dashboard screenshot.`,
    missingDetails: readableMissing,
    recommendedScreenshot:
      'Upload a tight crop that shows the control/variant cards, at least one metric table, and any visible confidence labels.',
  };
}

function buildVisibleMetrics(parsed) {
  if (!Array.isArray(parsed.metrics)) {
    return [];
  }

  return parsed.metrics
    .slice(0, 4)
    .map((metric) => {
      const metricName = sanitizeString(metric.metric_name);
      const controlValue = sanitizeString(metric.control_value);
      const variantValue = sanitizeString(metric.variant_value);
      const difference = sanitizeString(metric.difference_vs_control);
      const confidence = sanitizeString(metric.confidence_label);

      let value = '';

      if (controlValue || variantValue) {
        value = `Control: ${controlValue || 'n/a'} | Variant: ${variantValue || 'n/a'}`;
      }

      if (difference) {
        value = value ? `${value} | Diff: ${difference}` : `Diff: ${difference}`;
      }

      if (confidence && confidence !== 'unknown') {
        value = value ? `${value} | Confidence: ${confidence}` : `Confidence: ${confidence}`;
      }

      return {
        label: metricName || 'Metric',
        value: value || 'Visible but incomplete',
      };
    })
    .filter((item) => item.label && item.value);
}

function buildDraftPrompt(parsed) {
  const takeaway = sanitizeString(
    parsed?.parser_summary?.primary_readable_takeaway,
  );
  const followUp = sanitizeString(parsed?.parser_summary?.recommended_follow_up);
  const testName = sanitizeString(parsed?.test_overview?.test_name);

  if (takeaway && testName) {
    return `Please interpret this A/B test result for ${testName}: ${takeaway}${followUp ? ` Also address: ${followUp}` : ''}`;
  }

  if (takeaway) {
    return `Please interpret this A/B test result: ${takeaway}${followUp ? ` Also address: ${followUp}` : ''}`;
  }

  return 'Please interpret these A/B test results and recommend the next steps.';
}

function normalizeSuccessAnalysis(parsed) {
  const takeaway = sanitizeString(
    parsed?.parser_summary?.primary_readable_takeaway,
  );
  const confidenceOfSummary = sanitizeString(
    parsed?.parser_summary?.confidence_of_summary,
  );
  const followUp = sanitizeString(parsed?.parser_summary?.recommended_follow_up);
  const visibleMetrics = buildVisibleMetrics(parsed);
  const nextSteps = followUp ? [followUp] : [];
  const limitations = sanitizeStringArray(
    parsed?.screenshot_quality?.missing_detail,
  );

  return {
    success: true,
    summary: takeaway || 'The screenshot was parsed successfully.',
    interpretation: takeaway,
    visibleMetrics,
    nextSteps,
    followUpQuestions: [],
    limitations,
    draftPrompt: buildDraftPrompt(parsed),
    rawParsedJson: parsed,
    chatContext: {
      source: 'uploaded_ab_test_results_screenshot',
      testName: sanitizeString(parsed?.test_overview?.test_name),
      timeframe: sanitizeString(parsed?.test_overview?.date_range_or_duration),
      primaryMetric: visibleMetrics[0]?.label || '',
      winner: sanitizeString(parsed?.variant_summary?.variant?.summary_text),
      confidence: confidenceOfSummary,
      summary: takeaway,
      interpretation: takeaway,
      visibleMetrics,
      nextSteps,
      followUpQuestions: [],
      limitations,
      visibleTabs: Array.isArray(parsed?.visible_tabs) ? parsed.visible_tabs : [],
      parserSchemaReference: 'outputs/ab_results_parse_schema.json',
      dashboardGuideReference: 'outputs/ab_results_dashboard_guide.md',
      parserPromptReference: 'outputs/ab_results_parser_prompt.txt',
      parsedResult: parsed,
    },
  };
}

function normalizeAnalysis(parsed) {
  ensureParsedShape(parsed);

  if (!parsed?.screenshot_quality?.usable) {
    return buildFailureMessage(parsed);
  }

  return normalizeSuccessAnalysis(parsed);
}

function buildUserPrompt(filename, mimeType) {
  return [
    parserPrompt,
    '',
    'Hidden dashboard guide:',
    dashboardGuide,
    '',
    'Schema reference to follow exactly:',
    JSON.stringify(parseSchemaTemplate, null, 2),
    '',
    `Filename: ${filename || 'uploaded-screenshot'}.`,
    `Media type: ${mimeType || 'unknown'}.`,
    'If the screenshot is too zoomed out, fail cleanly and explain what tighter crop is needed.',
  ].join('\n');
}

async function analyzeWithOpenAi({
  apiKey,
  fetchImpl,
  filename,
  imageDataUrl,
  mimeType,
  model,
}) {
  if (!apiKey) {
    throw createError(
      'OpenAI screenshot parsing is not configured yet. Add OPENAI_API_KEY in your local .env file and in Netlify environment variables.',
      500,
    );
  }

  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'You are a strict screenshot parser. Return JSON only. Never guess missing values.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: buildUserPrompt(filename, mimeType),
            },
            {
              type: 'input_image',
              image_url: imageDataUrl,
              detail: 'high',
            },
          ],
        },
      ],
      max_output_tokens: 1600,
      text: {
        format: {
          type: 'json_schema',
          name: 'ab_test_screenshot_analysis',
          schema: OPENAI_RESPONSE_SCHEMA,
          strict: true,
        },
      },
    }),
  });

  const responseJson = await response.json();

  if (!response.ok) {
    const message =
      responseJson?.error?.message ||
      'The OpenAI screenshot parser could not analyze the image right now.';
    throw createError(message, 502);
  }

  return normalizeAnalysis(
    parseJsonText(readOpenAiOutputText(responseJson), 'OpenAI'),
  );
}

async function analyzeWithGemini({
  apiKey,
  fetchImpl,
  filename,
  imageDataUrl,
  mimeType,
  model,
}) {
  if (!apiKey) {
    throw createError(
      'Gemini screenshot parsing is not configured yet. Add GEMINI_API_KEY in your local .env file and in Netlify environment variables.',
      500,
    );
  }

  const { data, mimeType: extractedMimeType } = extractBase64Data(imageDataUrl);
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: 'You are a strict screenshot parser. Return JSON only. Never guess missing values.',
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: buildUserPrompt(
                  filename,
                  mimeType || extractedMimeType,
                ),
              },
              {
                inlineData: {
                  mimeType: extractedMimeType,
                  data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  const responseJson = await response.json();

  if (!response.ok) {
    const message =
      responseJson?.error?.message ||
      'The Gemini screenshot parser could not analyze the image right now.';
    throw createError(message, 502);
  }

  return normalizeAnalysis(
    parseJsonText(readGeminiOutputText(responseJson), 'Gemini'),
  );
}

export async function analyzeAbResultsScreenshot({
  provider = 'openai',
  openAiApiKey,
  geminiApiKey,
  fetchImpl = fetch,
  filename = '',
  imageDataUrl,
  mimeType = '',
  openAiModel = 'gpt-5.5',
  geminiModel = 'gemini-2.5-flash',
}) {
  validateImageDataUrl(imageDataUrl);

  if (provider === 'gemini') {
    return analyzeWithGemini({
      apiKey: geminiApiKey,
      fetchImpl,
      filename,
      imageDataUrl,
      mimeType,
      model: geminiModel,
    });
  }

  return analyzeWithOpenAi({
    apiKey: openAiApiKey,
    fetchImpl,
    filename,
    imageDataUrl,
    mimeType,
    model: openAiModel,
  });
}

export const parserReferences = {
  dashboardGuidePath: DASHBOARD_GUIDE_PATH,
  schemaPath: PARSE_SCHEMA_PATH,
  promptPath: PARSER_PROMPT_PATH,
};
