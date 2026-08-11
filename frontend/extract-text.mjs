import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const file = process.argv[2];
const data = new Uint8Array(readFileSync(file));
const pdf = await getDocument({ data }).promise;

for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p);
  const viewport = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  console.log(`=== PAGE ${p} (w=${viewport.width.toFixed(1)}, h=${viewport.height.toFixed(1)}) ===`);
  for (const item of tc.items) {
    if (!item.str || !item.str.trim()) continue;
    const x = item.transform?.[4] || 0;
    const y = item.transform?.[5] || 0;
    const w = (item.width || 0);
    const h = (item.height || 0);
    console.log(
      `[${x.toFixed(1)}, ${y.toFixed(1)}] ${w.toFixed(1)}x${h.toFixed(1)}  "${item.str.replace(/\n/g, '\\n')}"`
    );
  }
}
