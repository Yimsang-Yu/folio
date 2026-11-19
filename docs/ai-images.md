# Screenshot questions

Drag PNG, JPEG or WebP files into the Ask AI panel, paste an image into its input, or choose **Attach images**. Remove unwanted previews before pressing Send. A question can contain images without text. Images are sent only when a question is submitted and remain part of subsequent conversation context.

Each question supports up to four images, each up to 5 MB. The conversation supports 20 MB of image data. Start a new conversation if that limit is reached. Remote image URLs and SVG attachments are not imported. Drop a PDF outside the chat to open it as a document.

ChatGPT uses Responses image inputs; Claude Code receives structured image input through its streaming input mode; OpenRouter and custom endpoints receive Chat Completions image inputs. The selected endpoint and model must support image input. Text-only models cannot read screenshots.

Images are stored with local chat history. Protected PDF conversations retain the existing session-only behavior. Clearing chat history removes stored image attachments along with the messages.

## Verification

- `node --test scripts/test-ai-images.cjs scripts/test-openrouter.cjs scripts/test-custom-endpoint.cjs`: validation and provider payload tests, including screenshot-only questions with omitted document text.
- `npm run test:ai-layout`: hidden Electron tests of file drop, clipboard paste, preview removal, image-only sending, no request before sending, unsupported file feedback, and history after reload, plus tables, resizing and visualizations.
- `npm run smoke`: integrates the same screenshot checks with the reader regression suite.

Tests use isolated local data and mocked AI responses. They do not spend API credits or establish that every third-party model supports vision.
