import React, { useEffect } from 'react';
import { GamificationToast } from '../../types';
import { Award, Zap, Sparkles, CheckCircle, X } from 'lucide-react';

interface GamificationToastQueueProps {
  toasts: GamificationToast[];
  onDismiss: (id: string) => void;
}

export const GamificationToastQueue: React.FC<GamificationToastQueueProps> = ({ toasts, onDismiss }) => {
  useEffect(() => {
    if (toasts.length > 0) {
      const firstToast = toasts[0];
      const timer = setTimeout(() => {
        onDismiss(firstToast.id);
      }, 4500);

      return () => clearTimeout(timer);
    }
  }, [toasts, onDismiss]);

  if (!toasts || toasts.length === 0) return null;

  const currentToast = toasts[0];

  const getIcon = () => {
    if (currentToast.type === 'badge') return <Award className="w-6 h-6 text-amber-400 animate-bounce" />;
    if (currentToast.type === 'level') return <Sparkles className="w-6 h-6 text-teal-400 animate-spin" />;
    if (currentToast.type === 'mastery') return <Award className="w-6 h-6 text-purple-400" />;
    return <Zap className="w-6 h-6 text-emerald-400" />;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full px-4 pointer-events-none">
      <div className="card p-4 shadow-2xl flex items-start gap-3.5 border-2 border-teal-500/40 bg-card/95 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto rounded-2xl">
        <div className="p-2.5 rounded-2xl bg-teal-500/10 shrink-0">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400">
              {currentToast.title}
            </h4>
            <button
              onClick={() => onDismiss(currentToast.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="font-black text-sm text-gray-900 dark:text-gray-100 mt-0.5 truncate">
            {currentToast.message}
          </p>
          {currentToast.subtext && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-bold">
              {currentToast.subtext}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
