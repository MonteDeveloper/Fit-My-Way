import React, { useState } from 'react';
import { X, Copy, Check, Terminal, ChevronDown, ChevronLeft, Clipboard, Info, AlertCircle } from 'lucide-react';
import { getTranslation } from '../utils/i18n';
import { AnimatePresence, motion } from 'framer-motion';
import { Language } from '@/types';

interface TextImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (text: string) => void;
  prompt: string;
  language: Language;
}

const mainModalVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2 }
};

export const TextImportModal: React.FC<TextImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  prompt,
  language
}) => {
  const [text, setText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  const t = getTranslation(language);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy", e);
    }
  };

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) setText(clipText);
    } catch (err) {
      setErrorAlert("Cannot access clipboard. Please paste manually.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            {...mainModalVariants}
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col h-full max-h-[90vh] overflow-hidden relative"
          >
            
            {/* Header - Standardized: Left (Spacer), Center (Title), Right (X) */}
            <div className="flex-none p-4 border-b border-gray-100 dark:border-slate-800 grid grid-cols-[40px_1fr_40px] items-center bg-white dark:bg-slate-900 z-10">
              <div />
              <h3 className="font-bold text-xl flex items-center justify-center gap-2 truncate">
                <Terminal className="text-primary flex-shrink-0" size={24} />
                <span className="truncate">{t.importModal.title}</span>
              </h3>
              <div className="flex justify-end">
                <button onClick={onClose} className="p-2 -mr-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500">
                    <X size={24} />
                </button>
              </div>
            </div>

            {/* Main Input Body */}
            <div className="flex-1 flex flex-col p-4 bg-gray-50 dark:bg-black/20 relative">
                <button 
                  onClick={() => setShowInfo(true)}
                  className="w-full py-2 mb-2 bg-indigo-50 dark:bg-indigo-900/30 text-primary rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-900/50"
                >
                   <Info size={18} /> {t.common.seeHow}
                </button>

                <button 
                  onClick={handlePaste}
                  className="w-full py-3 mb-3 bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors"
                >
                   <Clipboard size={18} /> {t.common.paste}
                </button>

                <textarea 
                    className="flex-1 w-full p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 outline-none resize-none font-mono text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={t.importModal.placeholder}
                    value={text}
                    onChange={e => setText(e.target.value)}
                />
            </div>

            {/* INFO OVERLAY */}
            <AnimatePresence>
              {showInfo && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-20 bg-white dark:bg-slate-900 flex flex-col"
                >
                   {/* Fixed Info Header with Back Arrow */}
                   <div className="flex-none p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur">
                      <div className="flex items-center gap-2">
                          <button onClick={() => setShowInfo(false)} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200">
                            <ChevronLeft size={20}/>
                          </button>
                          <h4 className="font-bold text-lg">{t.importModal.infoTitle}</h4>
                      </div>
                   </div>
                   
                   {/* Scrollable Info Body */}
                   <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="space-y-4">
                          <div className="flex gap-4 items-start">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-primary flex items-center justify-center font-bold shrink-0">1</div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 pt-1">{t.importModal.step1}</p>
                          </div>
                          <div className="flex gap-4 items-start">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-primary flex items-center justify-center font-bold shrink-0">2</div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 pt-1">{t.importModal.step2}</p>
                          </div>
                          <div className="flex gap-4 items-start">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-primary flex items-center justify-center font-bold shrink-0">3</div>
                              <p className="text-sm font-bold text-primary pt-1 bg-indigo-50 dark:bg-indigo-900/10 p-2 rounded-lg w-full">
                                  {t.importModal.step3}
                              </p>
                          </div>
                           <div className="flex gap-4 items-start">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-primary flex items-center justify-center font-bold shrink-0">4</div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 pt-1">{t.importModal.step4}</p>
                          </div>
                          <div className="flex gap-4 items-start">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-primary flex items-center justify-center font-bold shrink-0">5</div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 pt-1">{t.importModal.step5}</p>
                          </div>
                      </div>

                      <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
                          <button 
                              onClick={handleCopy}
                              className="w-full py-4 bg-primary hover:bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mb-4"
                          >
                              {copied ? <Check size={20}/> : <Copy size={20}/>} 
                              {copied ? t.common.copied : t.common.copyPrompt}
                          </button>

                          <details className="group bg-gray-50 dark:bg-black/20 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800">
                              <summary className="flex items-center justify-between p-4 cursor-pointer font-bold text-xs text-gray-500 uppercase hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors select-none">
                                  {t.importModal.promptLabel}
                                  <div className="text-gray-400 group-open:rotate-180 transition-transform">
                                      <ChevronDown size={16} />
                                  </div>
                              </summary>
                              <div className="p-4 pt-0 border-t border-gray-200 dark:border-slate-800">
                                  <pre className="text-[10px] font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all leading-relaxed">
                                      {prompt}
                                  </pre>
                              </div>
                          </details>
                      </div>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="flex-none p-4 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 z-10">
                <button 
                    onClick={onClose} 
                    className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                    {t.common.cancel}
                </button>
                <button 
                    onClick={() => onImport(text)}
                    disabled={!text.trim()}
                    className="px-6 py-3 rounded-xl font-bold bg-primary text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {t.common.generate}
                </button>
            </div>
            
            {/* Error Alert inside modal context */}
            <AnimatePresence>
                {errorAlert && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-red-100 dark:border-red-900 max-w-xs w-full"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="text-red-500 mb-2"><AlertCircle size={24}/></div>
                                <p className="text-sm mb-4">{errorAlert}</p>
                                <button 
                                    onClick={() => setErrorAlert(null)}
                                    className="w-full py-2 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm font-bold"
                                >
                                    {t.common.close}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};