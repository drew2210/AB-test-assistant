import { useEffect, useRef } from 'react';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { Chat, ChatInlineLayout, InstantSearch } from 'react-instantsearch';
import 'instantsearch.css/components/chat.css';

const searchClient = algoliasearch(
  '9W4KTRX803',
  'afccb717944ae0a07eaf094147a7170e',
);

export function AssistantEmbed({
  hiddenContext,
  mode = 'landing',
  onClearConversation,
  onInputChange,
  onSendHandled,
  sendMessageRequest = null,
  onSubmitInput,
}) {
  const chatRef = useRef(null);
  const lastSentRequestRef = useRef(null);
  const shellRef = useRef(null);

  useEffect(() => {
    if (!sendMessageRequest || sendMessageRequest.id === lastSentRequestRef.current) {
      return undefined;
    }

    function trySend() {
      if (!chatRef.current) {
        return false;
      }

      lastSentRequestRef.current = sendMessageRequest.id;
      chatRef.current.sendMessage({ text: sendMessageRequest.text });
      onInputChange?.('');
      onSendHandled?.();
      return true;
    }

    if (trySend()) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (trySend()) {
        window.clearInterval(intervalId);
      }
    }, 80);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [onInputChange, onSendHandled, sendMessageRequest]);

  useEffect(() => {
    const shell = shellRef.current;

    if (!shell) {
      return undefined;
    }

    function handleInput(event) {
      if (event.target instanceof HTMLTextAreaElement) {
        onInputChange?.(event.target.value);
      }
    }

    function handleSubmit() {
      const textarea = shell.querySelector('.ais-ChatPrompt-textarea');

      if (textarea instanceof HTMLTextAreaElement) {
        onSubmitInput?.(textarea.value);
      }
    }

    function handleClick(event) {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest('.ais-ChatHeader-clear')
      ) {
        onInputChange?.('');
        onClearConversation?.();
      }
    }

    shell.addEventListener('input', handleInput, true);
    shell.addEventListener('submit', handleSubmit, true);
    shell.addEventListener('click', handleClick, true);

    return () => {
      shell.removeEventListener('input', handleInput, true);
      shell.removeEventListener('submit', handleSubmit, true);
      shell.removeEventListener('click', handleClick, true);
    };
  }, [onClearConversation, onInputChange, onSubmitInput]);

  return (
    <div
      ref={shellRef}
      className={`assistant-live-shell assistant-live-shell--${mode}`}
    >
      <InstantSearch searchClient={searchClient}>
        <Chat
          ref={chatRef}
          agentId="b300bbed-c431-4aa6-97b9-28be0d4011dd"
          context={() =>
            hiddenContext
              ? {
                  screenshot_analysis: hiddenContext,
                }
              : {}
          }
          layoutComponent={ChatInlineLayout}
          open
          title="A/B Test Assistant"
          itemComponent={() => null}
        />
      </InstantSearch>
    </div>
  );
}
