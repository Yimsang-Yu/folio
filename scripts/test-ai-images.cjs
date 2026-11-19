const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validateImages } = require('../electron/ai-images.cjs');
const { chatRequest, completionsRequest, claudePrompt } = require('../electron/ai-prompt.cjs');
const image = { name: 'screenshot.png', dataUrl: 'data:image/png;base64,' + fs.readFileSync('public/app-icon.png').toString('base64') };
const messages = [{ role: 'user', content: 'Explain', images: [image] }];
const document = { name: 'test.pdf', text: '', truncated: true, recognized: false };
test('image validation rejects remote URLs, forged MIME, assistant images and excess attachments', () => {
 validateImages(messages);
 for (const invalid of [ { ...image, dataUrl: 'https://example.com/image.png' }, { ...image, dataUrl: 'data:image/png;base64,YWJj' } ]) assert.throws(() => validateImages([{ ...messages[0], images: [invalid] }]));
 assert.throws(() => validateImages([{ ...messages[0], role: 'assistant' }]));
 assert.throws(() => validateImages([{ ...messages[0], images: Array(5).fill(image) }]));
});
test('Responses, Chat Completions and Claude receive native image content', () => {
 assert.equal(chatRequest('test', document, messages).input[1].content[1].image_url, image.dataUrl);
 assert.equal(completionsRequest('test', document, messages).input[1].content[1].image_url.url, image.dataUrl);
 const claude = claudePrompt(document, messages);
 assert.equal(claude.inputFormat, 'stream-json');
 const content = JSON.parse(claude.input).message.content;
 assert.equal(content[2].source.data, image.dataUrl.split(',')[1]);
 assert.ok(!content[0].text.includes(image.dataUrl));
 assert.equal(chatRequest('test', document, [{ role: 'user', content: 'hello' }]).input[1].content, 'hello');
 assert.equal(claudePrompt(document, [{ role: 'user', content: 'hello' }]).inputFormat, undefined);
});

test('per-image and whole-conversation byte budgets are enforced', () => {
 const bytes = Buffer.alloc(5 * 1024 * 1024);
 Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
 const large = { name:'large.png', dataUrl:'data:image/png;base64,'+bytes.toString('base64') };
 validateImages([{role:'user',content:'test',images:Array(4).fill(large)}]);
 assert.throws(() => validateImages([{role:'user',content:'test',images:Array(4).fill(large)}, {role:'user',content:'more',images:[image]}]), /20 MB/);
 assert.throws(() => validateImages([{role:'user',content:'test',images:[{...large,dataUrl:'data:image/png;base64,'+Buffer.concat([bytes,Buffer.alloc(1)]).toString('base64')}]}]), /5 MB/);
});
