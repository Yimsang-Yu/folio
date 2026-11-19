import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
export async function checkAiImages(app, page, shots) {
 const base64 = readFileSync(new URL('../public/app-icon.png', import.meta.url)).toString('base64');
 await app.evaluate(({ ipcMain, BrowserWindow }) => {
  ipcMain.removeHandler('folio:ai-ask');
  globalThis.imageRequests = [];
  ipcMain.handle('folio:ai-ask', (_event, req) => {
   globalThis.imageRequests.push(req);
   const wc = BrowserWindow.getAllWindows()[0].webContents;
   setTimeout(() => { wc.send('folio:ai-event', {id:req.id,type:'delta',text:'Screenshot received.'}); wc.send('folio:ai-event',{id:req.id,type:'done'}); }, 20);
  });
 });
 const transfer = async (kind, type = 'image/png', name = 'screenshot.png') => page.evaluate(({ kind, type, name, base64 }) => {
  const dt = new DataTransfer();
  dt.items.add(new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], name, { type }));
  const target = document.querySelector('.ai-panel textarea');
  if (kind === 'paste') target.dispatchEvent(new ClipboardEvent('paste', { bubbles:true, cancelable:true, clipboardData:dt }));
  else { target.dispatchEvent(new DragEvent('dragenter', {bubbles:true,dataTransfer:dt})); target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt})); }
 }, { kind,type,name,base64 });
 const panel = page.locator('.ai-panel');
 if (!await panel.count()) await page.getByRole('button', {name:'Ask AI',exact:true}).click();
 await panel.getByRole('textbox').waitFor();
 await transfer('drop');
 await panel.locator('.ai-images.draft img').waitFor();
 assert.equal(await app.evaluate(() => globalThis.imageRequests.length), 0, 'attaching sent a request');
 assert.equal(await page.locator('.drop-overlay').count(),0);
 await panel.getByRole('button',{name:'Remove screenshot.png'}).click();
 assert.equal(await panel.locator('.ai-images.draft img').count(),0);
 await transfer('paste');
 await panel.locator('.ai-images.draft img').waitFor();
 await panel.getByRole('textbox').fill('');
 await panel.getByRole('button',{name:'Send',exact:true}).click();
 await panel.getByText('Screenshot received.',{exact:true}).waitFor();
 const req = await app.evaluate(() => globalThis.imageRequests[0]);
 assert.equal(req.messages.at(-1).images[0].dataUrl,'data:image/png;base64,'+base64);
 assert.ok(req.messages.at(-1).content.length);
 await panel.locator('.ai-images.sent img').waitFor();
 await transfer('drop','application/pdf','wrong.pdf');
 await panel.getByRole('alert').getByText(/Attach a PNG/).waitFor();
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.screenshot({path:path.join(shots,'ai-image-attachment.png')});
 await page.reload();
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 await page.locator('.ai-images.sent img').waitFor();
 assert.equal(await page.locator('.ai-images.sent img').getAttribute('src'),'data:image/png;base64,'+base64);
 await page.locator('.ai-panel').getByRole('button', {name:'Close Ask AI'}).click();
 console.log('PASS: screenshot drag, paste, remove, image-only send, payload, invalid drop and persisted history');
}
