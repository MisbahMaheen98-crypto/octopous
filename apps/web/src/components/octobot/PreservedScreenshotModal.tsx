import React, { useState, useEffect } from 'react';
import {
  getPreservedScreenshots,
  savePreservedScreenshot,
  deletePreservedScreenshot,
  type PreservedScreenshot,
} from '../../lib/octo/octo-client';
import { X, Image as ImageIcon, Trash2, Check, Upload, Clock } from 'lucide-react';

interface PreservedScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScreenshot: (screenshot: PreservedScreenshot) => void;
}

export const PreservedScreenshotModal: React.FC<PreservedScreenshotModalProps> = ({
  isOpen,
  onClose,
  onSelectScreenshot,
}) => {
  const [screenshots, setScreenshots] = useState<PreservedScreenshot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setScreenshots(getPreservedScreenshots());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUploadNew = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newItem: PreservedScreenshot = {
        id: `ps-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        dataUrl,
        timestamp: new Date().toISOString(),
        sizeBytes: file.size,
      };
      savePreservedScreenshot(newItem);
      setScreenshots(getPreservedScreenshots());
      setSelectedId(newItem.id);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deletePreservedScreenshot(id);
    setScreenshots(getPreservedScreenshots());
    if (selectedId === id) setSelectedId(null);
  };

  const handleConfirmSelection = () => {
    const target = screenshots.find((s) => s.id === selectedId);
    if (target) {
      onSelectScreenshot(target);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-[#0c1120] border border-gray-200 dark:border-cyan-950/70 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-cyan-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <ImageIcon size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white font-mono">
                Preserved Screenshot Gallery
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Pick a preserved screenshot for OCTOBOT visual inspection &amp; error OCR
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-cyan-950/40 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-slate-400 font-semibold">
              Available Screenshots ({screenshots.length})
            </span>
            <label className="cursor-pointer px-3 py-1.5 rounded-xl border border-dashed border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-mono font-medium transition flex items-center space-x-1.5">
              <Upload size={14} />
              <span>Add to Library</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadNew} />
            </label>
          </div>

          {screenshots.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-gray-200 dark:border-cyan-950/50 bg-gray-50/50 dark:bg-[#070b14]">
              <ImageIcon size={32} className="mx-auto text-gray-400 dark:text-slate-600 mb-2" />
              <p className="text-xs text-gray-500 dark:text-slate-400 font-mono">No preserved screenshots found.</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Upload a screenshot or capture one from your project.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {screenshots.map((s) => {
                const isSelected = selectedId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`group relative rounded-xl border p-2 cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10 dark:bg-cyan-950/30 ring-2 ring-cyan-500/30'
                        : 'border-gray-200 dark:border-cyan-950/60 bg-gray-50/50 dark:bg-[#090e1c] hover:border-cyan-500/50'
                    }`}
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black/10 dark:bg-black/40 border border-gray-200 dark:border-cyan-950/40 flex items-center justify-center">
                      <img
                        src={s.dataUrl}
                        alt={s.name}
                        className="w-full h-full object-cover transition group-hover:scale-105"
                      />
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-cyan-500 text-white shadow-md">
                          <Check size={12} />
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 px-1 flex items-start justify-between">
                      <div className="min-w-0 pr-1">
                        <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white block truncate">
                          {s.name}
                        </span>
                        <div className="flex items-center space-x-1 text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 font-mono">
                          <Clock size={10} />
                          <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(s.id, e)}
                        className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition"
                        title="Delete from library"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-gray-200 dark:border-cyan-950/60 bg-gray-50/70 dark:bg-[#080c16] flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">
            {selectedId ? '1 screenshot selected' : 'Select a screenshot to attach'}
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-cyan-950/60 text-xs font-mono text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-cyan-950/40 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSelection}
              disabled={!selectedId}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white text-xs font-mono font-semibold transition shadow-sm flex items-center space-x-1.5"
            >
              <Check size={14} />
              <span>Attach Screenshot</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
