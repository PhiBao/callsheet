import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Extract text from a PDF in the browser. The file never leaves the page.
 * Layout is flattened to one string per line item; the local parser and the
 * on-device model both accept that.
 */
export async function extractPdfText(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let page = 1; page <= doc.numPages; page += 1) {
    const content = await (await doc.getPage(page)).getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) parts.push(text);
  }
  await doc.destroy();
  return parts.join('\n');
}
