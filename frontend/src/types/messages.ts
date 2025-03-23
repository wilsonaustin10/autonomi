export enum ResponseType {
    Error = "error",
    Success = "chat"
}

export type ChatResponse = {
    type: ResponseType;
    message: string;
}


type ActionBase = {
    type: string;
}

export enum ActionType {
    Click = "click",
    Navigate = "navigate",
    Type = "type",
}

export type ClickAction = ActionBase & {
    type: ActionType.Click;
    selector?: string,
    position?: {
        x: number;
        y: number;
    }
}

export type TypeAction = ActionBase & {
    type: ActionType.Type,
    selector: string;
    text: string;
}

export type NavigateAction = ActionBase & {
    type: ActionType.Navigate,
    url: string;
}

export type Message = {
    role: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: string
}




