/**
 * ExportWebChartModal.jsx
 *
 * Modal shown when user clicks "Export Web Chart" in the Traditional Org Chart editor.
 * Provides three options:
 *   1. Copy shareable link (stored in DB, served via /shared-chart/:id)
 *   2. Download standalone HTML file (single self-contained file)
 *   3. Download ZIP package (index.html + chart-data.json + README)
 */

import { useState } from 'react';
import { X, Link2, Globe, Package, Check, Loader2, Copy, ExternalLink } from 'lucide-react';
import api from '../api/client';
import { downloadStandaloneHtml, downloadZipPackage } from '../utils/webChartExport';

export default function ExportWebChartModal({ chartData, onClose }) {
  const [shareUrl,   setShareUrl]   = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [dlHtml,     setDlHtml]     = useState(false); // loading state
  const [dlZip,      setDlZip]      = useState(false); // loading state
  const [error,      setError]      = useState('');

  // ── Generate shareable link ──────────────────────────────────────────────
  const handleGenerateLink = async () => {
    setGenerating(true);
    setError('');
    try {
      const result = await api.tradOrgChart.shareChart(chartData);
      const base   = window.location.origin;
      setShareUrl(`${base}/shared-chart/${result.id}`);
    } catch (err) {
      setError(err.message || 'Failed to generate link. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Copy link to clipboard ───────────────────────────────────────────────
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // ── Download standalone HTML ─────────────────────────────────────────────
  const handleDownloadHtml = async () => {
    setDlHtml(true);
    try {
      await downloadStandaloneHtml(chartData, 'traditional-org-chart.html');
    } catch (err) {
      alert(err.message || 'Download failed. Please try again.');
    } finally {
      setDlHtml(false);
    }
  };

  // ── Download ZIP package ─────────────────────────────────────────────────
  const handleDownloadZip = async () => {
    setDlZip(true);
    try {
      await downloadZipPackage(chartData, 'traditional-org-chart-web.zip');
    } catch (err) {
      alert(err.message || 'Download failed. Please try again.');
    } finally {
      setDlZip(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-100">
          <Globe className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Export Web Chart</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Share an interactive version of your Traditional Org Chart
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* ── Option 1: Shareable Link ── */}
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <Link2 className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Shareable Link</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Generate a unique URL. Anyone with the link can view the chart interactively — no login needed.
                </p>
              </div>
            </div>

            {!shareUrl ? (
              <button
                type="button"
                onClick={handleGenerateLink}
                disabled={generating}
                className="w-full py-2 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {generating ? 'Generating…' : 'Generate Link'}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 p-2">
                  <span className="flex-1 text-xs text-blue-700 font-mono truncate select-all">{shareUrl}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 p-1.5 rounded-md hover:bg-gray-200 transition-colors text-gray-600"
                    title="Copy link"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1.5 rounded-md hover:bg-gray-200 transition-colors text-gray-600"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                {copied && <p className="text-xs text-green-600 font-medium">Link copied to clipboard!</p>}
                <p className="text-xs text-gray-400">
                  This link works as long as the server is running. Share it with your team.
                </p>
              </div>
            )}

            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>

          {/* ── Option 2: Download HTML ── */}
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Download Standalone HTML</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Download a single <code className="bg-gray-100 px-1 rounded text-xs">index.html</code> file.
                  Open it in any browser — no server or internet needed.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadHtml}
              disabled={dlHtml}
              className="w-full py-2 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {dlHtml ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {dlHtml ? 'Generating…' : 'Download HTML File'}
            </button>
          </div>

          {/* ── Option 3: Download ZIP ── */}
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Download ZIP Package</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Download a ZIP with <code className="bg-gray-100 px-1 rounded text-xs">index.html</code>,
                  {' '}<code className="bg-gray-100 px-1 rounded text-xs">chart-data.json</code>, and README.
                  Extract and double-click <code className="bg-gray-100 px-1 rounded text-xs">index.html</code>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={dlZip}
              className="w-full py-2 px-4 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {dlZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              {dlZip ? 'Generating…' : 'Download ZIP Package'}
            </button>
          </div>

          {/* Feature list */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">Interactive features included:</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                'Expand / collapse nodes',
                'Zoom in & out',
                'Pan / drag canvas',
                'Search employees',
                'Fit to screen',
                'Full screen view',
                'Read-only (no editing)',
                'Works offline',
              ].map((f) => (
                <div key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
