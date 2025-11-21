import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';

// --- Global Image Loading Queue System ---
// Ensures images load progressively to prevent main thread blocking
const LOAD_QUEUE: (() => void)[] = [];
let activeDownloads = 0;
const MAX_CONCURRENT_DOWNLOADS = 3; // Reduced concurrency for smoother scrolling
let isQueueProcessing = false;

const processQueue = async () => {
  // If already running the loop, don't start another instance
  if (isQueueProcessing) return;
  
  isQueueProcessing = true;

  try {
    // Process queue as long as we have items and slots
    while (LOAD_QUEUE.length > 0 && activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
      const nextLoad = LOAD_QUEUE.shift();
      if (nextLoad) {
        activeDownloads++;
        nextLoad();
        // 50ms delay between starting downloads to prevent jank/stutter
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  } finally {
    isQueueProcessing = false;
    // Double check if slots opened up while we were waiting
    if (LOAD_QUEUE.length > 0 && activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
      processQueue();
    }
  }
};

const enqueueImageLoad = (startLoadingCallback: () => void) => {
  LOAD_QUEUE.push(startLoadingCallback);
  processQueue();
};

const releaseImageLoad = () => {
  activeDownloads--;
  // Small buffer to let UI breathe before processing next batch
  setTimeout(() => {
    processQueue();
  }, 10);
};

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  skipDelay?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className,
  style,
  skipDelay = false,
  onError,
  onLoad,
  ...props
}) => {
  const [isMounted, setIsMounted] = useState(skipDelay);
  const [isInView, setIsInView] = useState(false);
  const [allowedToLoad, setAllowedToLoad] = useState(false);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(true);

  // Check if source is a GIF (case insensitive)
  const isGif = src ? /\.gif($|\?)/i.test(src) : false;

  // 1. Transition Delay Logic
  useEffect(() => {
    mountedRef.current = true;
    if (skipDelay) {
        setIsMounted(true);
        return;
    }
    const timer = setTimeout(() => {
        if (mountedRef.current) setIsMounted(true);
    }, 400); 
    return () => {
        mountedRef.current = false;
        clearTimeout(timer);
    };
  }, [skipDelay]);

  // 2. Viewport Detection
  useEffect(() => {
    if (!containerRef.current || !isMounted) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect(); 
        }
      });
    }, { 
        rootMargin: '150px', // Increased lookahead
        threshold: 0.01 
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isMounted]);

  // 3. Queue Registration
  useEffect(() => {
    if (isMounted && isInView && !allowedToLoad && !hasError && src) {
        enqueueImageLoad(() => {
            if (mountedRef.current) {
                setAllowedToLoad(true);
            } else {
                releaseImageLoad();
            }
        });
    }
  }, [isMounted, isInView, allowedToLoad, hasError, src]);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Ensure minimum skeleton display time to avoid flicker if load is instant
    if (mountedRef.current) {
       setIsLoaded(true);
    }
    releaseImageLoad(); 
    if (onLoad) onLoad(e);
  };

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (mountedRef.current) {
      setHasError(true);
    }
    releaseImageLoad(); 
    if (onError) onError(e);
  };

  // 4. Special Handling for GIFs (Freeze frame via Canvas)
  useEffect(() => {
    if (!allowedToLoad || !isGif || !src) return;

    const img = new Image();
    img.src = src;
    img.onload = () => {
        if (!mountedRef.current) return;
        
        if (canvasRef.current) {
            canvasRef.current.width = img.naturalWidth;
            canvasRef.current.height = img.naturalHeight;
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
            }
            setIsLoaded(true);
        }
        releaseImageLoad();
    };

    img.onerror = (e) => {
        if (!mountedRef.current) return;
        setHasError(true);
        releaseImageLoad();
    };
  }, [allowedToLoad, isGif, src]);

  if (hasError || !src) {
      return (
        <div className={`flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-400 ${className}`}>
             <ImageIcon size={24} />
        </div>
      );
  }

  return (
    <div 
        ref={containerRef} 
        className={`relative overflow-hidden bg-gray-100 dark:bg-slate-800 ${className}`}
    >
      {/* Skeleton Loader - Stays visible until fully loaded */}
      <div 
        className={`absolute inset-0 z-20 flex items-center justify-center bg-gray-100 dark:bg-slate-800 transition-opacity duration-500 ${isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
         <div className="absolute inset-0 bg-gray-200 dark:bg-slate-700 animate-pulse" />
         <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-shimmer" />
         <div className="relative z-30 text-gray-300 dark:text-slate-600 animate-pulse">
            <ImageIcon size={24} />
         </div>
      </div>

      {/* Render Content */}
      {allowedToLoad && (
        isGif ? (
            <canvas
                ref={canvasRef}
                style={style}
                className={`w-full h-full object-contain relative z-10 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                aria-label={alt}
                role="img"
            />
        ) : (
            <img
                src={src}
                alt={alt || ''}
                loading="lazy"
                decoding="async"
                style={style}
                className={`w-full h-full object-contain relative z-10 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={handleImgLoad}
                onError={handleImgError}
                {...props}
            />
        )
      )}
    </div>
  );
};