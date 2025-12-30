/**
 * PDF parsing utilities using PDF.js v3
 * This module only works in browser environments
 */

export interface PdfPage {
  pageNumber: number;
  width: number;
  height: number;
  imageData: ImageData;
}

/**
 * Load a PDF file and extract all pages as ImageData
 */
export async function loadPdf(file: File, scale: number = 2): Promise<PdfPage[]> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be used in browser environments');
  }

  const pdfjsLib = await import('pdfjs-dist');

  // Set worker path for v3
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pages: PdfPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    // Render page to canvas
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
    }).promise;

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    pages.push({
      pageNumber: i,
      width: canvas.width,
      height: canvas.height,
      imageData,
    });
  }

  return pages;
}

/**
 * Get the number of pages in a PDF
 */
export async function getPdfPageCount(file: File): Promise<number> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be used in browser environments');
  }

  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}

/**
 * Load a single page from a PDF
 */
export async function loadPdfPage(
  file: File,
  pageNumber: number,
  scale: number = 2
): Promise<PdfPage | null> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be used in browser environments');
  }

  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    return null;
  }

  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({
    canvasContext: ctx,
    viewport: viewport,
  }).promise;

  return {
    pageNumber,
    width: canvas.width,
    height: canvas.height,
    imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
  };
}
