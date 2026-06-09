import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const EXPORT_PADDING = 32;
const EXPORT_MIN_SCALE = 2;
const EXPORT_MAX_SCALE = 3;
const MAX_CANVAS_SIDE = 16384;

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function pxToPt(px) {
  return (px * 72) / 96;
}

function findExportArea(element) {
  if (!element) return null;
  if (element.id === 'org-chart-export-area') return element;
  return element.closest('#org-chart-export-area') || element;
}

function polishCloneForExport(root) {
  root.querySelectorAll('[data-export-exclude], [data-export-hide-grid]').forEach((node) => {
    node.remove();
  });

  root.querySelectorAll('*').forEach((node) => {
    if (node.style) {
      if (node.style.transform && node.style.transform !== 'none') {
        node.style.transform = 'none';
      }
      node.style.overflow = 'visible';
      node.style.overflowX = 'visible';
      node.style.overflowY = 'visible';
    }
  });

  root.querySelectorAll('.truncate').forEach((node) => {
    node.style.overflow = 'visible';
    node.style.textOverflow = 'clip';
    node.style.whiteSpace = 'normal';
    node.style.wordBreak = 'break-word';
  });

  root.querySelectorAll('.overflow-hidden, .overflow-auto, .overflow-scroll').forEach((node) => {
    node.style.overflow = 'visible';
  });
}

function buildFreeformExportTree(element) {
  const exportArea = findExportArea(element);
  const chartRoot = (exportArea || element).querySelector('[data-chart-export-root]');
  if (!chartRoot) return null;

  const canvasWidth = Number(chartRoot.getAttribute('data-canvas-width'))
    || chartRoot.scrollWidth
    || chartRoot.offsetWidth;
  const canvasHeight = Number(chartRoot.getAttribute('data-canvas-height'))
    || chartRoot.scrollHeight
    || chartRoot.offsetHeight;

  if (!canvasWidth || !canvasHeight) {
    throw new Error('Chart dimensions are not ready. Wait for the chart to finish loading.');
  }

  const doc = document.createElement('div');
  doc.style.background = '#ffffff';
  doc.style.padding = `${EXPORT_PADDING}px`;
  doc.style.boxSizing = 'border-box';
  doc.style.width = `${canvasWidth + EXPORT_PADDING * 2}px`;
  doc.style.position = 'relative';
  doc.style.overflow = 'visible';

  const titleEl = exportArea?.querySelector('h2');
  if (titleEl) {
    const titleClone = titleEl.cloneNode(true);
    titleClone.style.display = 'block';
    titleClone.style.margin = '0 0 24px 0';
    titleClone.style.padding = '0 0 12px 0';
    titleClone.style.lineHeight = '1.2';
    titleClone.style.color = '#1e3a5f';
    doc.appendChild(titleClone);
  }

  const chartClone = chartRoot.cloneNode(true);
  chartClone.style.transform = 'none';
  chartClone.style.transformOrigin = 'top left';
  chartClone.style.width = `${canvasWidth}px`;
  chartClone.style.height = `${canvasHeight}px`;
  chartClone.style.minWidth = `${canvasWidth}px`;
  chartClone.style.minHeight = `${canvasHeight}px`;
  chartClone.style.position = 'relative';
  chartClone.style.overflow = 'visible';
  chartClone.style.background = '#ffffff';

  polishCloneForExport(chartClone);
  doc.appendChild(chartClone);

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0';
  wrapper.style.zIndex = '-1';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.background = '#ffffff';
  wrapper.style.overflow = 'visible';
  wrapper.appendChild(doc);
  document.body.appendChild(wrapper);

  const width = Math.ceil(doc.scrollWidth || doc.offsetWidth);
  const height = Math.ceil(doc.scrollHeight || doc.offsetHeight);

  doc.style.width = `${width}px`;
  doc.style.height = `${height}px`;
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.left = `${-(width + 200)}px`;

  return { wrapper, captureNode: doc, width, height };
}

function buildLegacyExportTree(element) {
  const clone = element.cloneNode(true);
  polishCloneForExport(clone);

  clone.style.position = 'relative';
  clone.style.transform = 'none';
  clone.style.overflow = 'visible';
  clone.style.background = '#ffffff';

  const width = Math.max(clone.scrollWidth, clone.offsetWidth, element.scrollWidth, element.offsetWidth, 1);
  const height = Math.max(clone.scrollHeight, clone.offsetHeight, element.scrollHeight, element.offsetHeight, 1);

  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0';
  wrapper.style.zIndex = '-1';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.background = '#ffffff';
  wrapper.style.overflow = 'visible';
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.left = `${-(width + 200)}px`;
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  return { wrapper, captureNode: clone, width, height };
}

function prepareExportCapture(element) {
  if (!element) throw new Error('Chart area not found');
  return buildFreeformExportTree(element) || buildLegacyExportTree(element);
}

function computeExportScale(width, height) {
  const longestSide = Math.max(width, height, 1);
  return Math.max(
    EXPORT_MIN_SCALE,
    Math.min(EXPORT_MAX_SCALE, MAX_CANVAS_SIDE / longestSide),
  );
}

function triggerDownload(link) {
  document.body.appendChild(link);
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  link.remove();
}

export async function captureChartElement(element) {
  const { wrapper, captureNode, width, height } = prepareExportCapture(element);
  await waitForPaint();

  const scale = computeExportScale(width, height);

  try {
    const canvas = await html2canvas(captureNode, {
      backgroundColor: '#ffffff',
      width,
      height,
      scale,
      logging: false,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 30000,
      foreignObjectRendering: false,
      onclone: (doc) => {
        doc.querySelectorAll('[data-export-exclude], [data-export-hide-grid]').forEach((node) => {
          node.remove();
        });
        doc.querySelectorAll('svg marker[id]').forEach((marker, index) => {
          marker.id = `${marker.id}-export-${index}`;
        });
        doc.querySelectorAll('.truncate').forEach((node) => {
          node.style.overflow = 'visible';
          node.style.textOverflow = 'clip';
          node.style.whiteSpace = 'normal';
        });
      },
    });

    if (!canvas.width || !canvas.height) {
      throw new Error('Export produced an empty image. Ensure the chart is fully loaded.');
    }

    return canvas;
  } finally {
    wrapper.remove();
  }
}

export async function exportChartAsImage(element, filename = 'org-chart.png') {
  const canvas = await captureChartElement(element);
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png', 1.0);
  triggerDownload(link);
}

export async function exportChartAsPdf(element, filename = 'org-chart.pdf') {
  const canvas = await captureChartElement(element);
  const imgData = canvas.toDataURL('image/png', 1.0);

  const pageWidthPt = pxToPt(canvas.width);
  const pageHeightPt = pxToPt(canvas.height);

  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageWidthPt, pageHeightPt],
    compress: true,
  });

  pdf.addImage(imgData, 'PNG', 0, 0, pageWidthPt, pageHeightPt, undefined, 'FAST');
  pdf.save(filename);
}
