'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { navigateTo, performAction } from '@/app/actions/browser'
import Image from 'next/image'
import { useDebounce } from 'use-debounce'
import LoginPrompt from './LoginPrompt'

export type P = {
    sessionId: string;
    url: string;
    screenshot: string;
    pageTitle: string;
    formElements: {
        tagName: string;
        id: string;
        name: string;
        type: string;
        value: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }[]
    historyState: {
        canGoBack?: boolean;
        canGoForward?: boolean;
    }
    isLoginPage?: boolean;
    setUrl: (url: string) => void;
    updateBrowserState: (result: any) => void
}

export default function InteractiveBrowser({ sessionId, url, screenshot, formElements, historyState, isLoginPage, setUrl, updateBrowserState }: P) {
    
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [logs, setLogs] = useState<string[]>([])
    
    const [text, setText] = useState<string>('')
    const [directInputText, setDirectInputText] = useState<string>('')
    const [sendEnterAfterText, setSendEnterAfterText] = useState<boolean>(true)
    const [value] = useDebounce(text, 1000)
    const browserRef = useRef<HTMLDivElement>(null)
    const directInputRef = useRef<HTMLInputElement>(null)
    const [focusedFormElement, setFocusedFormElement] = useState<{
        tagName: string;
        id: string;
        name: string;
        type: string;
        value: string;
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null)
    
    // Add browser focus state
    const [isBrowserFocused, setIsBrowserFocused] = useState<boolean>(false)
    
    // Add state for showing login prompt
    const [showLoginPrompt, setShowLoginPrompt] = useState<boolean>(false)

    // State variables to handle auto-refresh of site screenshots
    const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
    const [refreshInterval, setRefreshInterval] = useState<number>(2000); // 2 seconds
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

    // Initialize session and connect to SSE
    useEffect(() => {
        // Prevent any browser updates until sessionId is defined
        if (!sessionId) {
            return;
        }

        const initBrowser = async () => {
            // Wait a short delay for the session to be properly initialized
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Get URL from localStorage if available (for persistence)
            const storedUrl = typeof window !== 'undefined' ? 
                window.localStorage.getItem('lastBrowserUrl') : null;
                
            // Use stored URL if available, otherwise use the current URL prop
            const targetUrl = storedUrl || url;
            
            if (targetUrl) {
                console.log(`Initializing browser with URL: ${targetUrl}`);
                await handleNavigation(targetUrl);
            } else {
                await handleNavigation(url);
            }
        }

        initBrowser();

        return () => {
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, [sessionId]);

    // Add this function to start/stop the auto-refresh
    const toggleAutoRefresh = (enabled: boolean) => {
        setAutoRefresh(enabled);

        // Clear existing timer
        if (refreshTimerRef.current) {
            clearInterval(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }

        // Start new timer if enabled
        if (enabled && browserRef.current) {
            refreshTimerRef.current = setInterval(async () => {
                // Only refresh if not already loading
                if (!isLoading && browserRef.current) {
                    await refreshScreenshot();
                }
            }, refreshInterval);
        }
    };

    // Add this function to manually refresh the screenshot
    const refreshScreenshot = async () => {
        if (!browserRef.current || isLoading) return;

        setIsLoading(true);
        try {
            // Create a simple action that doesn't change the page but returns a fresh screenshot
            const result = await performAction('refresh', '', undefined, sessionId);
            if (result.success) {
                updateBrowserState(result);
            }
        } catch (error) {
            console.error('Error refreshing screenshot:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Modify 
    const addLog = (message: string) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const handleNavigation = async (targetUrl: string) => {
        setIsLoading(true);
        setUrl(targetUrl);
        
        // Store current URL in localStorage for persistence
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('lastBrowserUrl', targetUrl);
        }
        
        try {
            console.log("Navigating to ", targetUrl)
            const result = await navigateTo(targetUrl, sessionId);
            if (result.success) {
                updateBrowserState(result);
                addLog(`Loaded: ${result.url}`);

                // Restart auto-refresh after navigation
                if (autoRefresh) {
                    toggleAutoRefresh(false); // Stop current timer
                    toggleAutoRefresh(true);  // Start new timer
                }
            } else {
                addLog(`Error: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLog(`Error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }

    const handleAction = useCallback(async (action: string, selector: string, value?: string) => {
        // setIsLoading(true);
        try {
            const result = await performAction(action, selector, value, sessionId);
            console.log("Result", result)
            if (result.success) {
                updateBrowserState(result);
                if (action === "mouseClick") {
                    addLog(`Performed ${action} on x-y coordinates ${value}`)
                } else {
                    addLog(`Performed ${action} ${selector ? 'on ' + selector : ''}`);
                }
            } else {
                addLog(`Error: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLog(`Error: ${errorMessage}`);
        } finally {
            // setIsLoading(false);
        }
    }, [sessionId])

    const handleScreenshotClick = async (e: React.MouseEvent<HTMLImageElement>) => {
        if (!browserRef.current) return;

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

        const clickedFormElement = formElements.find(el => {
            const isMatch = (
                (actualX >= el.x && actualX <= el.x + el.width) &&
                (actualY >= el.y && actualY <= el.y + el.height)
            )
            if (isMatch) {
                console.log(`Match found: ${el.tagName} "${el.value}" at (${el.x}, ${el.y})`);
            }
            return isMatch;
        }) || null;

        console.log("Form elements available:", formElements);
        console.log("Clicked form element:", clickedFormElement);

        await handleAction('mouseClick', '', `${Math.round(actualX)},${Math.round(actualY)}`);

        if (clickedFormElement) {
            addLog(`Clicked on form element: ${clickedFormElement.tagName} ${clickedFormElement.id ? `#${clickedFormElement.id}` : ''}`);
        }

        setFocusedFormElement(clickedFormElement);
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


    const handleSubmitUrl = (e: React.FormEvent) => {
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

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setText(e.target.value);
        
    }

    /**
     * Attenots to fill user's input into the currently focused form element
     */
    useEffect(() => {
        if (value && focusedFormElement) {
            // Create a selector that will work even if ID is missing by using multiple selector strategies
            let selector = '';
            
            if (focusedFormElement.id) {
                selector = `#${focusedFormElement.id}`;
            } else if (focusedFormElement.name) {
                selector = `[name="${focusedFormElement.name}"]`;
            } else {
                // Use more complex selector as a fallback
                selector = `${focusedFormElement.tagName.toLowerCase()}`;
                if (focusedFormElement.type) {
                    selector += `[type="${focusedFormElement.type}"]`;
                }
            }
            
            console.log(`Filling element with selector "${selector}" with value "${value}"`);
            handleAction('fill', selector, value);
            addLog(`Filled input with: ${value}`);
        }
    }, [value, focusedFormElement, handleAction, addLog]);

    
    const handleSubmitTextInput = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Focused form element", focusedFormElement)
        handleAction('press', focusedFormElement ? `#${focusedFormElement.id}` : '', 'Enter')
    }

    // Handle direct text input submission
    const handleDirectInputSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isBrowserFocused || !focusedFormElement || !directInputText) return;
        
        // Send the text to the form element
        const selector = getFormElementSelector(focusedFormElement);
        handleAction('fill', selector, directInputText);
        
        // If sendEnterAfterText is enabled, send Enter key after a small delay
        if (sendEnterAfterText) {
            setTimeout(() => {
                handleAction('press', selector, 'Enter');
            }, 100);
        }
        
        // Clear the input field
        setDirectInputText('');
        
        // Add log
        addLog(`Entered text "${directInputText}" ${sendEnterAfterText ? 'with Enter key' : ''}`);
    }

    // Add keyboard event handler for direct input with enhanced keyboard handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isBrowserFocused || !focusedFormElement) return;
            
            // Skip if the event target is the direct input field
            if (e.target === directInputRef.current) return;
            
            // Prevent default for navigation keys
            if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace'].includes(e.key)) {
                e.preventDefault();
            }
            
            // Handle special keys
            if (e.key === 'Enter') {
                handleAction('press', getFormElementSelector(focusedFormElement), 'Enter');
                return;
            }
            
            if (e.key === 'Tab') {
                handleAction('press', getFormElementSelector(focusedFormElement), 'Tab');
                return;
            }
            
            if (e.key === 'Escape') {
                // Escape should unfocus the browser
                setIsBrowserFocused(false);
                return;
            }
            
            if (e.key === 'Backspace') {
                // For backspace, get current value and remove last character
                const currentValue = focusedFormElement.value || '';
                const newValue = currentValue.slice(0, -1);
                handleAction('fill', getFormElementSelector(focusedFormElement), newValue);
                
                // Update local state to reflect the change
                setFocusedFormElement({
                    ...focusedFormElement,
                    value: newValue
                });
                return;
            }
            
            if (e.key === 'Delete') {
                // Similar to backspace but for Delete key
                handleAction('press', getFormElementSelector(focusedFormElement), 'Delete');
                return;
            }
            
            // For printable characters
            if (e.key.length === 1) {
                const currentValue = focusedFormElement.value || '';
                const newValue = currentValue + e.key;
                handleAction('fill', getFormElementSelector(focusedFormElement), newValue);
                
                // Update local state to reflect the change
                setFocusedFormElement({
                    ...focusedFormElement,
                    value: newValue
                });
            }
        };
        
        if (isBrowserFocused) {
            window.addEventListener('keydown', handleKeyDown);
            // Focus the direct input field when the browser is focused
            if (directInputRef.current) {
                directInputRef.current.focus();
            }
        }
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isBrowserFocused, focusedFormElement, handleAction]);

    // Helper function to generate a reliable selector for form elements
    const getFormElementSelector = (element: any) => {
        if (!element) return '';
        
        let selector = '';
        if (element.id) {
            selector = `#${element.id}`;
        } else if (element.name) {
            selector = `[name="${element.name}"]`;
        } else {
            selector = `${element.tagName.toLowerCase()}`;
            if (element.type) {
                selector += `[type="${element.type}"]`;
            }
        }
        return selector;
    };

    // Toggle browser focus with improved feedback
    const toggleBrowserFocus = () => {
        const newFocusState = !isBrowserFocused;
        setIsBrowserFocused(newFocusState);
        
        if (newFocusState) {
            addLog('Browser focused - type directly or use the direct input box');
            // Focus the direct input field
            setTimeout(() => {
                if (directInputRef.current) {
                    directInputRef.current.focus();
                }
            }, 50);
        } else {
            addLog('Browser unfocused');
        }
    };

    // Show login prompt when a login page is detected
    useEffect(() => {
        if (isLoginPage) {
            addLog('Login page detected. Please enter your credentials.');
            setShowLoginPrompt(true);
        }
    }, [isLoginPage]);

    // Handle login credential submission
    const handleLoginSubmit = (credentials: { username: string; password: string }) => {
        if (!sessionId) return;
        
        try {
            // Show authenticating state
            setIsAuthenticating(true);
            // Serialize credentials to JSON for passing to the action
            const credentialsJson = JSON.stringify(credentials);
            handleAction('fillLogin', '', credentialsJson);
            addLog('Login credentials submitted');
            setShowLoginPrompt(false);
            
            // Start a timer to clear the authenticating state
            setTimeout(() => {
                setIsAuthenticating(false);
            }, 10000); // Clear after 10 seconds max
        } catch (error) {
            setIsAuthenticating(false);
            addLog(`Error filling login form: ${error}`);
        }
    };

    // Add this effect to detect when page has changed after authentication
    useEffect(() => {
        if (isAuthenticating && url) {
            // If we got a new screenshot while authenticating, we're probably done
            setIsAuthenticating(false);
        }
    }, [screenshot, isAuthenticating]);

    return (
        <div className="flex flex-col h-full border rounded-md overflow-hidden bg-white">
            {/* Login Prompt Modal */}
            {showLoginPrompt && (
                <LoginPrompt 
                    onSubmit={handleLoginSubmit}
                    onCancel={() => setShowLoginPrompt(false)}
                />
            )}
            
            {/* Browser Controls */}
            <div className="flex items-center gap-2 p-2 border-b bg-gray-100">
                <Button
                    onClick={() => handleAction('back', '')}
                    disabled={!sessionId || !historyState.canGoBack}
                    size="sm"
                    variant="outline"
                >
                    ←
                </Button>
                <Button
                    onClick={() => handleAction('forward', '')}
                    disabled={!sessionId || !historyState.canGoForward}
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

                <form onSubmit={handleSubmitUrl} className="flex-1 flex gap-2">
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
                
                {/* Add Focus Button */}
                <Button
                    onClick={toggleBrowserFocus}
                    disabled={!focusedFormElement}
                    size="sm"
                    variant={isBrowserFocused ? "default" : "outline"}
                    className="ml-2"
                    title={isBrowserFocused ? "Stop direct typing" : "Type directly in the browser"}
                >
                    {isBrowserFocused ? "Unfocus" : "Focus Input"}
                </Button>
                
                {/* Login Button - Show when login form is detected but prompt is hidden */}
                {isLoginPage && !showLoginPrompt && (
                    <Button
                        onClick={() => setShowLoginPrompt(true)}
                        size="sm"
                        variant="outline"
                        className="ml-2 bg-yellow-100 hover:bg-yellow-200 border-yellow-400"
                    >
                        Enter Login
                    </Button>
                )}

                <button
                    onClick={refreshScreenshot}
                    className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    title="Refresh screenshot"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2v6h-6"></path>
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                        <path d="M3 22v-6h6"></path>
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                    </svg>
                </button>

                <div className="flex items-center ml-2">
                    <input
                        type="checkbox"
                        id="auto-refresh"
                        checked={autoRefresh}
                        onChange={(e) => toggleAutoRefresh(e.target.checked)}
                        className="mr-1"
                    />
                    <label htmlFor="auto-refresh" className="text-sm">Auto</label>
                </div>

                <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="ml-2 text-sm bg-gray-200 rounded p-1"
                    disabled={!autoRefresh}
                >
                    <option value={1000}>1s</option>
                    <option value={2000}>2s</option>
                    <option value={5000}>5s</option>
                    <option value={10000}>10s</option>
                </select>
            </div>

            {/* Browser Content with focus visual indicator */}
            <div
                ref={browserRef}
                className={`relative bg-white overflow-hidden ${isBrowserFocused ? 'ring-4 ring-blue-500 ring-opacity-50' : ''}`}
                style={{ 
                    aspectRatio: '16/10', // 1280/800 = 16/10 aspect ratio
                    maxHeight: 'calc(100vh - 300px)' // Limit maximum height
                }}
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                )}
                
                {/* Authentication in progress overlay */}
                {isAuthenticating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-40 z-20">
                        <div className="animate-spin h-10 w-10 border-4 border-yellow-400 rounded-full border-t-transparent mb-3"></div>
                        <div className="text-white font-medium text-center px-4 py-2 rounded bg-black bg-opacity-50">
                            Authentication in progress...<br/>
                            <span className="text-sm">Please approve any security prompts if needed</span>
                        </div>
                    </div>
                )}

                {screenshot && (
                    <div className="relative h-full">
                        <Image
                            src={screenshot}
                            alt="Browser content"
                            className="w-full h-full object-cover"
                            onClick={handleScreenshotClick}
                            width={1280} // Match viewport width
                            height={800}  // Match viewport height
                            priority
                        />
                        
                        {/* Show focus indicator over the active input field */}
                        {isBrowserFocused && focusedFormElement && (
                            <div 
                                className="absolute border-2 border-blue-500 animate-pulse"
                                style={{
                                    top: `${focusedFormElement.y}px`,
                                    left: `${focusedFormElement.x}px`,
                                    width: `${focusedFormElement.width}px`,
                                    height: `${focusedFormElement.height}px`,
                                }}
                            />
                        )}
                    </div>
                )}
                
                {isBrowserFocused && focusedFormElement && (
                    <div className="absolute bottom-0 left-0 right-0 bg-blue-100 text-blue-800 text-sm p-2 text-center">
                        Typing directly into: {focusedFormElement.tagName.toLowerCase()}
                        {focusedFormElement.id ? ` #${focusedFormElement.id}` : ''}
                        {focusedFormElement.name ? ` [name="${focusedFormElement.name}"]` : ''}
                    </div>
                )}
            </div>

            {/* Action Panel - Enhanced with Direct Input */}
            <div className="border-t p-2 bg-gray-50">
                {/* Direct Input Panel */}
                {isBrowserFocused && focusedFormElement && (
                    <div className="flex flex-col mb-2 p-2 border rounded bg-blue-50">
                        <div className="text-sm font-medium mb-1 text-blue-700">Direct Text Input</div>
                        <form onSubmit={handleDirectInputSubmit} className="flex gap-2 items-center">
                            <Input
                                ref={directInputRef}
                                value={directInputText}
                                onChange={(e) => setDirectInputText(e.target.value)}
                                placeholder="Type text here and press Send or Enter"
                                className="flex-1"
                                autoFocus
                            />
                            <Button 
                                type="submit" 
                                size="sm"
                                disabled={!directInputText}
                            >
                                Send
                            </Button>
                            <div className="flex items-center">
                                <Checkbox 
                                    id="send-enter-after"
                                    checked={sendEnterAfterText}
                                    onCheckedChange={(checked: boolean | "indeterminate") => setSendEnterAfterText(checked as boolean)}
                                    className="mr-2"
                                />
                                <label htmlFor="send-enter-after" className="text-xs">
                                    Send Enter after text
                                </label>
                            </div>
                        </form>
                        <div className="text-xs text-blue-600 mt-1">
                            Press Escape to unfocus the browser
                        </div>
                    </div>
                )}

                {/* Original Action Panel */}
                <div className="flex gap-2 mb-2">
                    <form onSubmit={handleSubmitTextInput} className='flex flex-1 gap-2'>
                        <Input
                            placeholder={isBrowserFocused ? "Direct typing enabled above" : "Value (for inputs)"}
                            onChange={handleTextChange}
                            disabled={!focusedFormElement || isBrowserFocused}
                            id="value"
                            className="flex-1"
                        />
                        <Button
                            type="submit"
                            className='cursor-pointer'
                            disabled={!sessionId || !focusedFormElement || isBrowserFocused}
                        >
                            Enter
                        </Button>
                    </form>
                </div>
                <div className="flex gap-2">
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