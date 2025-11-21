import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';

// --- Global Image Loading Queue System ---
// Ensures images load progressively (limited concurrency) to prevent main thread blocking on mobile
const LOAD_QUEUE: (() => void)[] = [];
let activeDownloads = 0;
const MAX_CONCURRENT_DOWNLOADS = 2; // Keep low for mobile performance

const processQueue = () => {
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS || LOAD_QUEUE.length === 0) return;

  const nextLoad = LOAD_QUEUE.shift();
  if (nextLoad) {
    activeDownloads++;
    nextLoad();
  }
};

const enqueueImageLoad = (startLoadingCallback: () => void) => {
  LOAD_QUEUE.push(startLoadingCallback);
  processQueue();
};

const releaseImageLoad = () => {
  activeDownloads--;
  processQueue();
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
  // Controls whether the component is logically "mounted" (after transition delay)
  const [isMounted, setIsMounted] = useState(skipDelay);
  // Controls whether the component is in the viewport
  const [isInView, setIsInView] = useState(false);
  // Controls whether the Queue has allowed this specific image to start fetching
  const [allowedToLoad, setAllowedToLoad] = useState(false);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  // 1. Transition Delay Logic
  // Delays rendering during page transitions to ensure smooth Framer Motion animations
  useEffect(() => {
    mountedRef.current = true;
    if (skipDelay) {
        setIsMounted(true);
        return;
    }
    const timer = setTimeout(() => {
        if (mountedRef.current) setIsMounted(true);
    }, 400); // 400ms delay to wait for typical transitions
    return () => {
        mountedRef.current = false;
        clearTimeout(timer);
    };
  }, [skipDelay]);

  // 2. Viewport Detection (IntersectionObserver)
  useEffect(() => {
    if (!containerRef.current || !isMounted) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect(); // Stop observing once detected
        }
      });
    }, { 
        rootMargin: '100px', // Preload slightly before appearing
        threshold: 0.1 
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isMounted]);

  // 3. Queue Registration
  // Only request to load if we are Mounted AND In View AND not already allowed
  useEffect(() => {
    if (isMounted && isInView && !allowedToLoad && !hasError) {
        enqueueImageLoad(() => {
            if (mountedRef.current) {
                setAllowedToLoad(true);
            } else {
                // If component unmounted while in queue, release the slot immediately
                releaseImageLoad();
            }
        });
    }
  }, [isMounted, isInView, allowedToLoad, hasError]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    releaseImageLoad(); // Release slot for next image
    if (onLoad) onLoad(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    releaseImageLoad(); // Release slot even on error
    if (onError) onError(e);
  };

  // If error, we might want to show a fallback icon or nothing. 
  // For this UI, we simply hide the skeleton and let the parent handle fallback if needed,
  // or just show nothing.
  if (hasError) return null;

  return (
    <div 
        ref={containerRef} 
        className={`w-full h-full relative overflow-hidden bg-gray-100 dark:bg-slate-800 ${className}`}
        style={style}
    >
      {/* Stylish Skeleton Loader */}
      <div 
        className={`absolute inset-0 z-0 flex items-center justify-center transition-opacity duration-500 ${isLoaded ? 'opacity-0' : 'opacity-100'}`}
      >
         {/* Pulse Background */}
         <div className="absolute inset-0 bg-gray-200 dark:bg-slate-700 animate-pulse" />
         
         {/* Shimmer Overlay Effect */}
         <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent animate-pulse" style={{ animationDuration: '2s' }} />
         
         {/* Central Icon */}
         <div className="relative z-10 text-gray-300 dark:text-slate-600 animate-bounce" style={{ animationDuration: '3s' }}>
            <ImageIcon size={24} />
         </div>
      </div>

      {/* Actual Image - Rendered only when allowed by queue */}
      {allowedToLoad && (
        <img
          src={src}
          alt={alt || ''}
          loading="lazy" // Native lazy loading as backup
          decoding="async" // Off-main-thread decoding
          className={`w-full h-full object-contain relative z-10 transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      )}
    </div>
  );
};
