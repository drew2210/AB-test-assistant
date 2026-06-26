import { useEffect, useRef, useState } from 'react';
import { AssistantEmbed } from './assistantEmbed';

const MAX_SCREENSHOT_SIZE_BYTES = 6 * 1024 * 1024;
const starterPrompts = [
  'Help me design an A/B test hypothesis.',
  'How do I launch an A/B test step-by-step?',
  'How do I interpret my A/B test results?',
];

function PromptPill({ onSelect, prompt }) {
  return (
    <button
      className="prompt-pill"
      type="button"
      onClick={() => onSelect(prompt)}
    >
      {prompt}
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
  const testName = analysis?.chatContext?.testName;
  const responseStyle =
    'Do not include a "Stakeholder summary" section. Keep the reply concise and chunked into short sections: Verdict, Key signals, Confidence, and Recommended next step.';

  if (testName) {
    return `Please interpret the uploaded A/B test results for ${testName} and recommend the next steps. ${responseStyle}`;
  }

  return `Please interpret the uploaded A/B test results and recommend the next steps. ${responseStyle}`;
}

export default function App() {
  const sendPromptRef = useRef(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [pendingChatPrompt, setPendingChatPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  function handlePromptSelect(prompt, options = {}) {
    if (!sendPromptRef.current) {
      return;
    }

    sendPromptRef.current(prompt, options);
  }

  useEffect(() => {
    if (!analysis || !pendingChatPrompt || !sendPromptRef.current) {
      return;
    }

    handlePromptSelect(pendingChatPrompt, { submit: true });
    setPendingChatPrompt('');
  }, [analysis, pendingChatPrompt]);

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
        setPendingChatPrompt('');
        return;
      }

      setAnalysis(data);
      setAnalysisStatus('ready');
      setPendingChatPrompt(buildChatRequest(data));
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
    setPendingChatPrompt('');
    setSelectedFile(null);
  }

  return (
    <div className="page-shell">
      <main className="simple-layout">
        <header className="page-header">
          <p className="eyebrow">Algolia Academy</p>
          <h1>A/B Test Assistant</h1>
          <p className="page-intro">
            Ask for help planning experiments, choosing the right setup,
            validating launch readiness, interpreting results, and deciding what
            to do next.
          </p>
        </header>

        <section className="prompt-section" aria-labelledby="starter-prompts">
          <h2 id="starter-prompts">Suggested prompts</h2>
          <div className="prompt-pill-row">
            {starterPrompts.map((prompt) => (
              <PromptPill
                key={prompt}
                onSelect={handlePromptSelect}
                prompt={prompt}
              />
            ))}
          </div>
        </section>

        <section className="analysis-section" aria-labelledby="results-screenshot">
          <div className="analysis-section-header">
            <div>
              <h2 id="results-screenshot">Results screenshot</h2>
              <p>
                Upload an A/B test results screenshot and the site will extract
                the visible metrics, then attach that summary to your next chat
                question.
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
                  onClick={() => handlePromptSelect(buildChatRequest(analysis), { submit: true })}
                >
                  Re-send to chat
                </button>
              </div>

              <p className="analysis-result-note">
                Use Remove analysis when you want the chat to stop using this
                screenshot context.
              </p>
            </div>
          ) : null}
        </section>

        <section className="chat-section" aria-label="Assistant chat">
          <AssistantEmbed
            hiddenContext={analysis?.chatContext || null}
            onReady={(sendFn) => {
              sendPromptRef.current = sendFn;
            }}
          />
        </section>
      </main>
    </div>
  );
}
