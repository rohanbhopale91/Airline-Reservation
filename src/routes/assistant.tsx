import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "Skyline Assistant — book flights by chat" },
      {
        name: "description",
        content:
          "Chat with the Skyline Air assistant to search flights, book seats, look up your trips and open a dispute.",
      },
      { property: "og:title", content: "Skyline Assistant — book flights by chat" },
      {
        property: "og:description",
        content:
          "Chat with the Skyline Air assistant to search flights, book seats, look up your trips and open a dispute.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

const SUGGESTIONS = [
  "Which flights go from Delhi to Dubai?",
  "Book me a window seat on SK301",
  "What flights do I have coming up?",
  "Open a refund dispute for my latest booking",
];

const TOOL_LABELS: Record<string, string> = {
  "tool-search_flights": "Searching flight availability",
  "tool-book_ticket": "Creating the booking",
  "tool-my_bookings": "Looking up your reservations",
  "tool-create_dispute": "Filing the dispute",
};

function AssistantPage() {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function submit(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    sendMessage({ text: value });
    setInput("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-61px)] max-w-3xl flex-col px-4 pb-6">
      <header className="flex items-center gap-3 py-6">
        <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Bot className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Skyline Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Search flights, book seats, check your trips, raise a dispute.
          </p>
        </div>
      </header>

      <div className="panel flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-sm text-muted-foreground">
                Ask in plain language — the assistant reads and writes the real reservation
                database.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "max-w-[90%] space-y-2 text-sm leading-relaxed"
                }
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <p key={index} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    const anyPart = part as unknown as {
                      state?: string;
                      input?: unknown;
                      output?: unknown;
                    };
                    const done = anyPart.state === "output-available";
                    return (
                      <Collapsible key={index}>
                        <CollapsibleTrigger className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                          {done ? (
                            <Wrench className="size-3.5 text-primary" />
                          ) : (
                            <Loader2 className="size-3.5 animate-spin text-primary" />
                          )}
                          {TOOL_LABELS[part.type] ?? part.type}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-border bg-background/60 p-3 text-[11px] text-muted-foreground">
                            {JSON.stringify(anyPart.output ?? anyPart.input ?? {}, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message || "The assistant could not answer right now."}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <Textarea
            ref={inputRef}
            value={input}
            rows={1}
            placeholder="Book me a seat from Mumbai to Goa tomorrow…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            className="max-h-40 min-h-11 flex-1 resize-none"
          />
          <Button type="submit" size="icon" className="size-11 shrink-0" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>
    </main>
  );
}
