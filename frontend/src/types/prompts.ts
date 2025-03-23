import { BrowserHistoryState, ClickableElement, FormElement } from "./common";

export type PageInfo = {
    url: string;
    title: string;
    screenshot?: string; // base64 encoded image
    content: string; // html content of the page
    formElements: FormElement[];
    clickableElements: ClickableElement[];
    historyState: BrowserHistoryState;
}

export type ComputerUsePrompt = {
    pageInfo: PageInfo;
    userMessage: string;
}