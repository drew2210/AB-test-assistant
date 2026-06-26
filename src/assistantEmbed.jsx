import { useEffect, useRef } from 'react';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { Chat, ChatInlineLayout, InstantSearch } from 'react-instantsearch';
import 'instantsearch.css/components/chat.css';

const searchClient = algoliasearch(
  '9W4KTRX803',
  'afccb717944ae0a07eaf094147a7170e',
);

export function AssistantEmbed({ onReady }) {
  const chatRef = useRef(null);

  useEffect(() => {
    if (!onReady) {
      return undefined;
    }

    const sendPrompt = async (prompt) => {
      if (!chatRef.current) {
        return;
      }

      chatRef.current.setInput(prompt);
    };

    onReady(sendPrompt);

    return () => {
      onReady(null);
    };
  }, [onReady]);

  return (
    <div className="assistant-live-shell">
      <InstantSearch searchClient={searchClient}>
        <Chat
          ref={chatRef}
          agentId="b300bbed-c431-4aa6-97b9-28be0d4011dd"
          layoutComponent={ChatInlineLayout}
          open
          title="A/B Test Assistant"
          itemComponent={() => null}
        />
      </InstantSearch>
    </div>
  );
}
