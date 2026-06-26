import { useRef } from 'react';
import { AssistantEmbed } from './assistantEmbed';

const starterPrompts = [
  'Help me design an A/B test hypothesis.',
  'How do I launch an A/B test step-by-step?',
  'How do I interpret my A/B test results?',
];

function PromptPill({ isSending, onSelect, prompt }) {
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

export default function App() {
  const sendPromptRef = useRef(null);

  function handlePromptSelect(prompt) {
    if (!sendPromptRef.current) {
      return;
    }

    sendPromptRef.current(prompt);
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

        <section className="chat-section" aria-label="Assistant chat">
          <AssistantEmbed
            onReady={(sendFn) => {
              sendPromptRef.current = sendFn;
            }}
          />
        </section>
      </main>
    </div>
  );
}
