'use client'

import { useState, useEffect } from "react";
import ChatBox from "./components/ChatBox";
import { Message } from "../types/messages";
import InteractiveBrowser from "./components/InteractiveBrowser";

// Use a consistent session ID across renders
const sessionId = typeof window !== 'undefined' ? 
  window.localStorage.getItem('browserSessionId') || createAndStoreSessionId() : 
  crypto.randomUUID();

function createAndStoreSessionId() {
  const newSessionId = crypto.randomUUID();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('browserSessionId', newSessionId);
  }
  return newSessionId;
}

export default function Home() {
  const [initialMessages, setInitialMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello, I'm the AutonoM3 Agent Building Assistant. How can I help you today?" }
  ])

  const [screenshot, setScreenshot] = useState<string>('')
  const [pageTitle, setPageTitle] = useState<string>('')

  const [formElements, setFormElements] = useState<{
    tagName: string;
    id: string;
    name: string;
    type: string;
    value: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[]>([])

  const [historyState, setHistoryState] = useState<{
    canGoBack?: boolean;
    canGoForward?: boolean;
  }>({})
  const [url, setUrl] = useState<string>('https://google.com')
  const [isLoginPage, setIsLoginPage] = useState<boolean>(false)

  // Add this function to update browser state from API responses
  const updateBrowserState = (result: any) => {
    if (result.screenshot) {
      setScreenshot(result.screenshot);
    }
    if (result.title) {
      setPageTitle(result.title);
    }
    if (result.formElements) {
      setFormElements(result.formElements || []);
    }
    if (result.historyState) {
      setHistoryState(result.historyState);
    }
    if (result.url) {
      setUrl(result.url)
    }
    if (result.isLoginPage !== undefined) {
      setIsLoginPage(result.isLoginPage);
    }
  }

  // Add an effect to handle browser session cleanup on unmount
  useEffect(() => {
    // Store the URL in localStorage to survive page refreshes
    if (typeof window !== 'undefined' && url) {
      window.localStorage.setItem('lastBrowserUrl', url);
    }
    
    // On component mount, restore the last URL if it exists
    const restoreLastUrl = () => {
      const lastUrl = window.localStorage.getItem('lastBrowserUrl');
      if (lastUrl) {
        setUrl(lastUrl);
      }
    };
    
    restoreLastUrl();
    
    // Clean up function runs on component unmount
    return () => {
      // We're keeping the sessionId persistent, so don't clean it up here
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <h1 className="text-3xl text-center my-2 font-bold">AutonoM3 Agent Building</h1>
      <div className="flex-1 grid md:grid-cols-5 gap-4 px-4 pb-4">
        <div className="md:col-span-2 bg-gray-100 border border-1 p-4">
          <ChatBox 
            sessionId={sessionId} 
            initialMessages={initialMessages} 
            updateBrowserState={updateBrowserState}
          />

        </div>
        <div className="md:col-span-3 bg-gray-100 flex flex-col border border-1">
          <InteractiveBrowser 
            url={url}
            setUrl={setUrl}
            screenshot={screenshot}
            pageTitle={pageTitle}
            formElements={formElements}
            historyState={historyState}
            isLoginPage={isLoginPage}
            sessionId={sessionId} 
            updateBrowserState={updateBrowserState} />
        </div>
      </div>
    </div>
  );
}
