import { useState } from 'react';
import { AssistantEmbed } from './assistantEmbed';

const MAX_SCREENSHOT_SIZE_BYTES = 6 * 1024 * 1024;
const INTERPRET_RESULTS_PROMPT_ID = 'interpret-results';

const starterPrompts = [
  {
    id: 'design-experiment',
    title: 'Design an experiment',
    description:
      'Turn an idea into a sharp hypothesis with the right audience, metric, and test structure.',
    label: 'Planning',
    prompt: 'Help me design an A/B test hypothesis.',
  },
  {
    id: 'launch-test',
    title: 'Launch an A/B test',
    description:
      'Pressure-test setup, QA, rollout details, and the checklist that keeps launches clean.',
    label: 'Execution',
    prompt: 'How do I launch an A/B test step-by-step?',
  },
  {
    id: INTERPRET_RESULTS_PROMPT_ID,
    title: 'Interpret results',
    description:
      'Read the signals, understand confidence, and decide whether to ship, iterate, or stop.',
    label: 'Analysis',
    prompt: 'How do I interpret my A/B test results?',
  },
];

function isInterpretResultsIntent(value) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (normalized.includes('interpret')) {
    return true;
  }

  if (normalized.includes('analy') && normalized.includes('result')) {
    return true;
  }

  if (normalized.includes('read') && normalized.includes('result')) {
    return true;
  }

  if (
    normalized.includes('result') &&
    (normalized.includes('a/b') ||
      normalized.includes('ab test') ||
      normalized.includes('experiment') ||
      normalized.includes('screenshot'))
  ) {
    return true;
  }

  if (
    (normalized.includes('winner') ||
      normalized.includes('confidence') ||
      normalized.includes('significance')) &&
    (normalized.includes('variant') ||
      normalized.includes('test') ||
      normalized.includes('experiment'))
  ) {
    return true;
  }

  return false;
}

function PromptCard({ isActive, onSelect, prompt }) {
  return (
    <button
      className={`prompt-card${isActive ? ' prompt-card--active' : ''}`}
      type="button"
      onClick={() => onSelect(prompt)}
      aria-pressed={isActive}
    >
      <span className="prompt-card-label">{prompt.label}</span>
      <strong className="prompt-card-title">{prompt.title}</strong>
      <span className="prompt-card-description">{prompt.description}</span>
      <span className="prompt-card-cta">Use this workflow</span>
    </button>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error('The screenshot could not be read. Please try again.'));
    reader.readAsDataURL(file);
  });
}

function buildChatRequest(analysis) {
  const chatContext = analysis?.chatContext || {};
  const testName = chatContext.testName;
  const timeframe = chatContext.timeframe;
  const summary = chatContext.summary;
  const confidence = chatContext.confidence;
  const visibleMetrics = Array.isArray(chatContext.visibleMetrics)
    ? chatContext.visibleMetrics
    : [];
  const limitations = Array.isArray(chatContext.limitations)
    ? chatContext.limitations
    : [];
  const nextSteps = Array.isArray(chatContext.nextSteps) ? chatContext.nextSteps : [];

  const intro = testName
    ? `Please interpret the uploaded A/B test results for ${testName}.`
    : 'Please interpret the uploaded A/B test results.';
  const responseStyle =
    'Use the extracted screenshot details below as the source of truth. Do not ask me to paste the dashboard text again unless the extracted details are clearly insufficient. Do not include a "Stakeholder summary" section. Keep the reply concise and chunked into short sections: Verdict, Key signals, Confidence, and Recommended next step.';

  const extractedDetails = [
    timeframe ? `Timeframe: ${timeframe}` : '',
    summary ? `Parsed summary: ${summary}` : '',
    confidence ? `Parser confidence read: ${confidence}` : '',
    visibleMetrics.length
      ? `Visible metrics:\n${visibleMetrics
          .map((metric) => `- ${metric.label}: ${metric.value}`)
          .join('\n')}`
      : '',
    nextSteps.length
      ? `Recommended follow-up from parser:\n${nextSteps
          .map((step) => `- ${step}`)
          .join('\n')}`
      : '',
    limitations.length
      ? `Screenshot limitations:\n${limitations
          .map((item) => `- ${item}`)
          .join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return [intro, responseStyle, extractedDetails].filter(Boolean).join('\n\n');
}

export default function App() {
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisRequested, setAnalysisRequested] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [activePromptId, setActivePromptId] = useState('');
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const [chatDraft, setChatDraft] = useState('');
  const [currentPage, setCurrentPage] = useState('landing');
  const [pendingChatSend, setPendingChatSend] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  function handlePromptSelect(promptCard) {
    setActivePromptId(promptCard.id);
    setAnalysisRequested(promptCard.id === INTERPRET_RESULTS_PROMPT_ID);
    setPendingChatSend({
      id: `landing-${promptCard.id}-${Date.now()}`,
      text: promptCard.prompt,
    });
    setChatSessionKey((value) => value + 1);
    setCurrentPage('chat');
  }

  function handleChatPromptSelect(promptCard) {
    setActivePromptId(promptCard.id);
    setAnalysisRequested(promptCard.id === INTERPRET_RESULTS_PROMPT_ID);
    setPendingChatSend({
      id: `${promptCard.id}-${Date.now()}`,
      text: promptCard.prompt,
    });
  }

  function handleChatInputChange(value) {
    setChatDraft(value);
  }

  function handleChatSubmit(value) {
    setActivePromptId('');

    if (isInterpretResultsIntent(value)) {
      setAnalysisRequested(true);
      return;
    }

    if (!analysis && !selectedFile && analysisStatus === 'idle') {
      setAnalysisRequested(false);
    }
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setAnalysis(null);
    setAnalysisStatus('idle');
    setAnalysisError('');
  }

  async function handleAnalyzeScreenshot() {
    if (!selectedFile) {
      setAnalysisError('Choose a screenshot first.');
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      setAnalysisError('Please upload a PNG, JPG, or WebP screenshot.');
      return;
    }

    if (selectedFile.size > MAX_SCREENSHOT_SIZE_BYTES) {
      setAnalysisError('Please keep the screenshot under 6 MB.');
      return;
    }

    setAnalysisStatus('loading');
    setAnalysisError('');

    try {
      const imageDataUrl = await readFileAsDataUrl(selectedFile);
      const response = await fetch('/api/parse-ab-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: selectedFile.name,
          imageDataUrl,
          mimeType: selectedFile.type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            'The screenshot could not be analyzed right now. Please try again.',
        );
      }

      if (data.success === false) {
        setAnalysis(null);
        setAnalysisStatus('error');
        setAnalysisError(data.fallbackUserMessage || data.userMessage);
        return;
      }

      const analysisPrompt = buildChatRequest(data);
      setAnalysis(data);
      setAnalysisStatus('ready');
      setPendingChatSend({
        id: `analysis-${Date.now()}`,
        text: analysisPrompt,
      });
    } catch (error) {
      setAnalysisStatus('error');
      setAnalysisError(
        error.message ||
          'The screenshot could not be analyzed right now. Please try again.',
      );
    }
  }

  function clearAnalysis() {
    setAnalysis(null);
    setAnalysisError('');
    setAnalysisStatus('idle');
    setSelectedFile(null);
  }

  function resetChatState() {
    clearAnalysis();
    setActivePromptId('');
    setAnalysisRequested(false);
    setChatDraft('');
    setPendingChatSend(null);
  }

  function openBlankChat() {
    resetChatState();
    setChatSessionKey((value) => value + 1);
    setCurrentPage('chat');
  }

  function returnToHome() {
    resetChatState();
    setChatSessionKey((value) => value + 1);
    setCurrentPage('landing');
  }

  const showInterpretResultsSection =
    analysisRequested ||
    isInterpretResultsIntent(chatDraft) ||
    Boolean(analysis) ||
    Boolean(selectedFile) ||
    analysisStatus === 'loading' ||
    analysisStatus === 'error';
  const isChatPage = currentPage === 'chat';

  return (
    <div className={`page-shell${isChatPage ? ' page-shell--focused' : ''}`}>
      <main className={`app-layout${isChatPage ? ' app-layout--focused' : ''}`}>
        {!isChatPage ? (
          <>
            <header className="hero-section">
              <div className="hero-brand">
                <p className="eyebrow">Algolia Academy</p>
                <p className="hero-brand-title">A/B Test Assistant</p>
              </div>
              <div className="hero-copy">
                <h1>How can I help you today?</h1>
                <h2>Ask anything, or start from a suggested prompt.</h2>
              </div>
            </header>

            <section className="prompt-section prompt-section--landing" aria-labelledby="starter-prompts">
              <div className="section-heading">
                <h3 id="starter-prompts">Suggested prompts</h3>
                <p>
                  Pick the workflow that matches where you are in the testing process.
                </p>
              </div>

              <div className="prompt-card-grid">
                {starterPrompts.map((prompt) => (
                  <PromptCard
                    key={prompt.id}
                    isActive={activePromptId === prompt.id}
                    onSelect={handlePromptSelect}
                    prompt={prompt}
                  />
                ))}
              </div>
            </section>

            <div className="landing-actions">
              <button className="landing-chat-button" type="button" onClick={openBlankChat}>
                Start a blank chat
              </button>
            </div>
          </>
        ) : (
          <header className="focus-header">
            <div>
              <p className="eyebrow">Algolia Academy</p>
              <h1>A/B Test Assistant</h1>
            </div>
          </header>
        )}

        {isChatPage && showInterpretResultsSection ? (
          <section className="analysis-section" aria-labelledby="results-screenshot">
            <div className="analysis-section-header">
              <div>
                <p className="analysis-kicker">Result interpretation</p>
                <h2 id="results-screenshot">Add a screenshot for deeper analysis</h2>
                <p>
                  Upload a results screenshot to extract visible metrics and attach
                  that context to your next interpretation request.
                </p>
              </div>
              {analysis ? (
                <button
                  className="analysis-reset-button"
                  type="button"
                  onClick={clearAnalysis}
                >
                  Remove analysis
                </button>
              ) : null}
            </div>

            <div className="analysis-actions">
              <label className="analysis-upload-button" htmlFor="results-upload">
                {selectedFile ? 'Change screenshot' : 'Choose screenshot'}
              </label>
              <input
                id="results-upload"
                className="analysis-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileSelect}
              />
              <button
                className="analysis-run-button"
                type="button"
                disabled={!selectedFile || analysisStatus === 'loading'}
                onClick={handleAnalyzeScreenshot}
              >
                {analysisStatus === 'loading'
                  ? 'Analyzing...'
                  : analysis
                    ? 'Re-analyze screenshot'
                    : 'Analyze screenshot'}
              </button>
            </div>

            {selectedFile ? (
              <p className="analysis-file-name">{selectedFile.name}</p>
            ) : null}

            {analysisError ? (
              <p className="analysis-error">{analysisError}</p>
            ) : null}

            {analysis ? (
              <div className="analysis-result-card">
                <p className="analysis-result-label">Screenshot ready</p>
                <p className="analysis-result-summary">
                  The screenshot was parsed and attached to the assistant context.
                  The interpretation request has been sent to chat.
                </p>

                <div className="analysis-result-actions">
                  <button
                    className="analysis-use-button"
                    type="button"
                    onClick={() => {
                      const analysisPrompt = buildChatRequest(analysis);
                      setPendingChatSend({
                        id: `analysis-resend-${Date.now()}`,
                        text: analysisPrompt,
                      });
                    }}
                  >
                    Re-send to chat
                  </button>
                </div>

                <p className="analysis-result-note">
                  Remove analysis when you want the assistant to stop using this
                  screenshot context.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {isChatPage ? (
          <div className="chat-toolbar">
            <button className="chat-back-button" type="button" onClick={returnToHome}>
              Back
            </button>
            <div className="chat-toolbar-actions">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  className={`chat-prompt-chip${activePromptId === prompt.id ? ' chat-prompt-chip--active' : ''}`}
                  type="button"
                  onClick={() => handleChatPromptSelect(prompt)}
                >
                  {prompt.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {isChatPage ? (
          <section className="chat-section chat-section--focused" aria-label="Assistant chat">
            <AssistantEmbed
              key={chatSessionKey}
              hiddenContext={analysis?.chatContext || null}
              mode="focused"
              onClearConversation={resetChatState}
              onInputChange={handleChatInputChange}
              onSendHandled={() => setPendingChatSend(null)}
              sendMessageRequest={pendingChatSend}
              onSubmitInput={handleChatSubmit}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
