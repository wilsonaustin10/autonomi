export const computerUseFunctions = [
    {
        name: "mouseClick",
        description: "Clicks on a point specified by x and y coordinates",
        parameters: {
            type: "object",
            properties: {
                x: {
                    type: "number",
                    description: "The x coordinate of the point to click"
                },
                y: {
                    type: "number",
                    description: "The y coordinate of the point to click"
                }
            }
        }
    },
  {
    name: "clickElement",
    description: "Click on an element on the page",
    parameters: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector or XPath for the element to click"
        }
      },
      required: ["selector"]
    }
  },
  {
    name: "fillForm",
    description: "Fill a form field with text",
    parameters: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector or XPath for the form field"
        },
        value: {
          type: "string",
          description: "Text to input into the field"
        }
      },
      required: ["selector", "value"]
    }
  },
  {
    name: "navigateTo",
    description: "Navigate to a specific URL",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to navigate to"
        }
      },
      required: ["url"]
    }
  },
  // Add more functions as needed
];
