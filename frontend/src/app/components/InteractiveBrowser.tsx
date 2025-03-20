'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { navigateTo, performAction } from '@/app/actions/browser'
import Image from 'next/image'

export default function InteractiveBrowser() {
    const [url, setUrl] = useState<string>('https://example.com')
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [logs, setLogs] = useState<string[]>([])
    const [sessionId, setSessionId] = useState<string>('')
    const [screenshot, setScreenshot] = useState<string>('')
    const [pageTitle, setPageTitle] = useState<string>('')
    const [clickableElements, setClickableElements] = useState<any[]>([])
    const [formElements, setFormElements] = useState<any[]>([])
    const browserRef = useRef<HTMLDivElement>(null)


    // Initialize session and connect to SSE
    useEffect(() => {
        const newSessionId = Math.random().toString(36).substring(2, 15);
        setSessionId(newSessionId);

        // Initial navigation
        handleNavigation(url);

        // Set up SSE connection
        const eventSource = new EventSource(`/api/browser-events?sessionId=${newSessionId}`);
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'click') {
                    addLog(`Browser event: Click on ${data.target}`);
                }
            } catch (error) {
                console.error('Error parsing event:', error);
            }
        };

        eventSource.onerror = () => {
            addLog('Error in browser event stream');
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const handleNavigation = async (targetUrl: string) => {
        setIsLoading(true);
        setUrl(targetUrl);
        try {
            console.log("Navigating to ", targetUrl)
            const result = await navigateTo(targetUrl, sessionId);
            if (result.success) {
                setScreenshot(result.screenshot);
                setPageTitle(result.title);
                setClickableElements(result.clickableElements);
                setFormElements(result.formElements);
                addLog(`Loaded: ${result.url}`);
            } else {
                addLog(`Error: ${result.error}`);
            }
        } catch (error) {
            addLog(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }

    const handleAction = async (action: string, selector: string, value?: string) => {
        setIsLoading(true);
        try {
            const result = await performAction(action, selector, value, sessionId);
            if (result.success) {
                setScreenshot(result.screenshot);
                setPageTitle(result.title);
                setClickableElements(result.clickableElements);
                setFormElements(result.formElements);
                if (result.extractedText) {
                    addLog(`Extracted: ${result.extractedText}`);
                } else {
                    addLog(`Performed ${action} on ${selector}`);
                }
            } else {
                addLog(`Error: ${result.error}`);
            }
        } catch (error) {
            addLog(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }

    const handleScreenshotClick = (e: React.MouseEvent<HTMLImageElement>) => {
        console.log(browserRef.current, clickableElements.length === 0)
        if (!browserRef.current || clickableElements.length === 0) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top

        const imageElement = e.currentTarget as HTMLImageElement;
        const scaleX = imageElement.naturalWidth / imageElement.offsetWidth;
        const scaleY = imageElement.naturalHeight / imageElement.offsetHeight;
        
        // Convert to actual coordinates on the screenshot
        const actualX = x * scaleX;
        const actualY = y * scaleY;

        console.log(`Click at position: (${actualX}, ${actualY})`);
        console.log(`Available elements: ${clickableElements.length}`);
        
        const clickedElement = clickableElements.find(el => {
            const isMatch = (
                (actualX >= el.x && actualX <= el.x + el.width) &&
                (actualY >= el.y && actualY <= el.y + el.height)
            )
            if (isMatch) {
                console.log(`Match found: ${el.tagName} "${el.text}" with href (${el.href}) at (${el.x}, ${el.y})`);
            }
            return isMatch;
        })

         // Debug output for the first element (to check coordinates)
        if (clickableElements.length > 0) {
            const el = clickableElements[0];
            console.log(`First element: ${el.tagName} "${el.text}" at (${el.x}, ${el.y}) with size ${el.width} x ${el.height}`);
        }
    
        if (clickedElement) {
            addLog(`Clicked: ${clickedElement.text} (${clickedElement.href})`);

            if (clickedElement.href) {
                handleNavigation(clickedElement.href);
            } else {

                let selector;
                if (clickedElement.id) {
                    selector = `#${clickedElement.id}`;
                } else if (clickedElement.text) {
                    // Use text content for selection - this works in Playwright
                    selector = `//${clickedElement.tagName}[contains(text(), "${clickedElement.text}")]`;
                } else {
                    // Fallback to a position-based selector
                    selector = `${clickedElement.tagName}:nth-of-type(${clickedElement.index || 1})`;
                }

                handleAction("click", selector)
            }
        }
    }

    // Handle messages from iframe
    useEffect(() => {
        const handleIframeMessage = (event: MessageEvent) => {
            if (event.data.type === 'browserEvent') {
                const { event: eventType, text, href } = event.data;

                if (eventType === 'click') {
                    addLog(`Clicked: ${text || ''}${href ? ` (${href})` : ''}`);

                    if (href) {
                        handleNavigation(href);
                    }
                }
            }
        };

        window.addEventListener('message', handleIframeMessage);
        return () => window.removeEventListener('message', handleIframeMessage);
    }, [sessionId]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Trim the URL and validate
        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
            addLog('Please enter a URL');
            return;
        }

        // Navigate to the URL
        handleNavigation(trimmedUrl);
    };


    return (
        <div className="flex flex-col h-full border rounded-md overflow-hidden bg-white">
            {/* Browser Controls */}
            <div className="flex items-center gap-2 p-2 border-b bg-gray-100">
                <Button
                    onClick={() => handleAction('back', '')}
                    disabled={!sessionId}
                    size="sm"
                    variant="outline"
                >
                    ←
                </Button>
                <Button
                    onClick={() => handleAction('forward', '')}
                    disabled={!sessionId}
                    size="sm"
                    variant="outline"
                >
                    →
                </Button>
                <Button
                    onClick={() => handleAction('reload', '')}
                    disabled={!sessionId}
                    size="sm"
                    variant="outline"
                >
                    ↻
                </Button>
                <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
                    <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="flex-1"
                        placeholder="Enter URL..."
                    />
                    <Button type="submit" disabled={!sessionId || isLoading}>
                        Go
                    </Button>
                </form>
            </div>

            {/* Browser Content */}
            <div
                ref={browserRef}
                className="flex-1 relative bg-white overflow-auto"
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                )}

                {screenshot && (
                    <Image
                        src={screenshot}
                        alt="Browser content"
                        className="w-full cursor-pointer"
                        onClick={handleScreenshotClick}
                        width={1000}
                        height={1000}
                    />
                )}
            </div>

            {/* Action Panel */}
            <div className="border-t p-2 bg-gray-50">
                <div className="flex gap-2 mb-2">
                    <Input
                        placeholder="CSS Selector (e.g., #submit-button)"
                        id="selector"
                        className="flex-1"
                    />
                    <Input
                        placeholder="Value (for inputs)"
                        id="value"
                        className="flex-1"
                    />
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => {
                            const selector = (document.getElementById('selector') as HTMLInputElement).value
                            handleAction('click', selector)
                        }}
                        disabled={!sessionId}
                        size="sm"
                    >
                        Click
                    </Button>
                    <Button
                        onClick={() => {
                            const selector = (document.getElementById('selector') as HTMLInputElement).value
                            const value = (document.getElementById('value') as HTMLInputElement).value
                            handleAction('fill', selector, value)
                        }}
                        disabled={!sessionId}
                        size="sm"
                    >
                        Fill
                    </Button>
                    <Button
                        onClick={() => {
                            const selector = (document.getElementById('selector') as HTMLInputElement).value
                            handleAction('extract', selector)
                        }}
                        disabled={!sessionId}
                        size="sm"
                    >
                        Extract
                    </Button>
                </div>
            </div>

            {/* Logs */}
            <div className="border-t p-2 bg-gray-100 h-32 overflow-y-auto">
                <h3 className="text-sm font-semibold mb-1">Logs</h3>
                <div className="text-xs space-y-1">
                    {logs.map((log, i) => (
                        <div key={i} className="text-gray-700">{log}</div>
                    ))}
                </div>
            </div>
        </div>
    )
}