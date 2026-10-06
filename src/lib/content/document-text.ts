import "server-only";

export const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_CHARS = 40_000;

/** Extract plain text from a PDF, Word, text or Markdown source document. */
export async function extractDocumentText(mimeType: string, fileName: string, bytes: Buffer): Promise<string> {
  let text = "";
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const extracted = await mammoth.extractRawText({ buffer: bytes });
    text = extracted.value;
  } else if (mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    try {
      const info = await parser.getInfo();
      if (info.total > 25) throw new Error("PDF repurposing supports up to 25 pages. Split the source into shorter documents.");
      text = (await parser.getText({ first: 25 })).text;
    } finally {
      await parser.destroy();
    }
  } else {
    throw new Error(`Document repurposing does not support ${fileName}'s file type.`);
  }
  const cleaned = text.replace(/\u0000/g, "").trim();
  if (cleaned.length < 80) throw new Error("This document has too little extractable text. Scanned PDFs need OCR before repurposing.");
  return cleaned.slice(0, MAX_DOCUMENT_CHARS);
}
