import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom React hook for robust, browser-based anti-cheating detection.
 * 
 * Detects:
 * 1. Tab switching (document.visibilityState)
 * 2. Window blur/focus
 * 3. Fullscreen exit
 * 4. Copy, paste, and cut attempts
 * 5. Right-click context menu
 * 6. Print attempts (beforeprint & Ctrl+P / Cmd+P)
 * 
 * @param {Object} options
 * @param {boolean} options.enabled - Whether monitoring is active (default: true)
 * @param {Function} options.onViolation - Callback invoked when a violation is detected: (event) => void
 * @param {React.RefObject} options.containerRef - Optional container element ref for scoped event listeners
 * @param {boolean} options.blockCopyPaste - Whether to call e.preventDefault() on copy/paste/cut (default: true)
 * @param {boolean} options.blockContextMenu - Whether to call e.preventDefault() on contextmenu (default: true)
 */
export const useAntiCheating = ({
    enabled = true,
    onViolation = null,
    containerRef = null,
    blockCopyPaste = true,
    blockContextMenu = true
} = {}) => {
    const [violations, setViolations] = useState([]);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const lastEventTimeRef = useRef({});
    const onViolationRef = useRef(onViolation);
    const gracePeriodEndRef = useRef(Date.now() + 5000); // 5 seconds grace period on mount/enable

    useEffect(() => {
        onViolationRef.current = onViolation;
    }, [onViolation]);

    useEffect(() => {
        if (enabled) {
            gracePeriodEndRef.current = Date.now() + 5000;
        }
    }, [enabled]);

    // Helper to log normalized violation event with deduplication
    const logViolation = useCallback((type, severity, description, details = {}) => {
        const now = Date.now();
        
        // Ignore violations during the grace period (e.g. browser permission prompts, fullscreen transition)
        if (now < gracePeriodEndRef.current) {
            console.log(`[AntiCheating] Ignored ${type} during grace period`);
            return;
        }

        const lastTime = lastEventTimeRef.current[type] || 0;

        // Deduplicate events of the same type within 600ms
        if (now - lastTime < 600) {
            return;
        }

        // Cross-deduplicate WINDOW_BLUR if TAB_SWITCH fired recently (within 1000ms)
        if (type === 'WINDOW_BLUR') {
            const lastTabSwitch = lastEventTimeRef.current['TAB_SWITCH'] || 0;
            if (now - lastTabSwitch < 1000) {
                return;
            }
        }

        lastEventTimeRef.current[type] = now;

        const event = {
            type,
            severity,
            description,
            timestamp: new Date().toISOString(),
            details
        };

        setViolations(prev => [...prev, event]);

        if (onViolationRef.current && typeof onViolationRef.current === 'function') {
            onViolationRef.current(event);
        }
    }, []);

    // Fullscreen helper methods
    const requestFullscreen = useCallback(async () => {
        try {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                await elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                await elem.msRequestFullscreen();
            }
            setIsFullscreen(true);
        } catch (err) {
            console.warn("Fullscreen request declined or unsupported:", err.message);
        }
    }, []);

    const exitFullscreen = useCallback(async () => {
        try {
            if (document.exitFullscreen && document.fullscreenElement) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen && document.webkitFullscreenElement) {
                await document.webkitExitFullscreen();
            }
            setIsFullscreen(false);
        } catch (err) {
            console.warn("Exit fullscreen failed:", err.message);
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const targetElement = containerRef?.current || document;

        let blurTimeout;

        // 1. Tab Switching (document.visibilityState)
        const handleVisibilityChange = () => {
            if (document.hidden || document.visibilityState === 'hidden') {
                if (blurTimeout) clearTimeout(blurTimeout);
                logViolation(
                    'TAB_SWITCH',
                    'High',
                    'Student navigated away from the exam tab.',
                    { visibilityState: document.visibilityState }
                );
            }
        };

        // 2. Window Blur / Focus
        const handleWindowBlur = () => {
            // Delay blur violation by 200ms to allow visibilitychange to fire if it's a tab switch
            blurTimeout = setTimeout(() => {
                if (!document.hidden) {
                    logViolation(
                        'WINDOW_BLUR',
                        'Medium',
                        'Exam window lost focus.',
                        { activeElement: document.activeElement?.tagName || 'UNKNOWN' }
                    );
                }
            }, 200);
        };

        // 3. Fullscreen Exit
        const handleFullscreenChange = () => {
            const currentlyFullscreen = Boolean(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            );

            setIsFullscreen(currentlyFullscreen);

            if (!currentlyFullscreen) {
                logViolation(
                    'FULLSCREEN_EXIT',
                    'High',
                    'Exited fullscreen mode during the exam.'
                );
            }
        };

        // 4. Copy, Paste, Cut
        const handleCopy = (e) => {
            if (blockCopyPaste) {
                e.preventDefault();
            }
            logViolation(
                'COPY_ATTEMPT',
                'Medium',
                'Copy attempt detected on the exam page.',
                { targetTag: e.target?.tagName }
            );
        };

        const handlePaste = (e) => {
            if (blockCopyPaste) {
                e.preventDefault();
            }
            logViolation(
                'PASTE_ATTEMPT',
                'Medium',
                'Paste attempt detected on the exam page.',
                { targetTag: e.target?.tagName }
            );
        };

        const handleCut = (e) => {
            if (blockCopyPaste) {
                e.preventDefault();
            }
            logViolation(
                'CUT_ATTEMPT',
                'Medium',
                'Cut attempt detected on the exam page.',
                { targetTag: e.target?.tagName }
            );
        };

        // 5. Right Click / Context Menu
        const handleContextMenu = (e) => {
            if (blockContextMenu) {
                e.preventDefault();
            }
            logViolation(
                'CONTEXT_MENU',
                'Low',
                'Right-click context menu attempt detected.',
                { x: e.clientX, y: e.clientY }
            );
        };

        // 6. Print Attempts (beforeprint & Ctrl+P / Cmd+P)
        const handleBeforePrint = () => {
            logViolation(
                'PRINT_ATTEMPT',
                'High',
                'Browser print dialog triggered.'
            );
        };

        const handleKeyDown = (e) => {
            // Detect Ctrl+P or Cmd+P
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                logViolation(
                    'PRINT_ATTEMPT',
                    'High',
                    'Keyboard print shortcut (Ctrl+P / Cmd+P) attempted.'
                );
            }
        };

        // Attach event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        targetElement.addEventListener('copy', handleCopy);
        targetElement.addEventListener('paste', handlePaste);
        targetElement.addEventListener('cut', handleCut);
        targetElement.addEventListener('contextmenu', handleContextMenu);

        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('keydown', handleKeyDown);

        // Initial check for fullscreen state
        setIsFullscreen(Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        ));

        // Clean up all event listeners on unmount or when options change
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleWindowBlur);

            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);

            targetElement.removeEventListener('copy', handleCopy);
            targetElement.removeEventListener('paste', handlePaste);
            targetElement.removeEventListener('cut', handleCut);
            targetElement.removeEventListener('contextmenu', handleContextMenu);

            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [enabled, containerRef, blockCopyPaste, blockContextMenu, logViolation]);

    // Computed total count and breakdowns
    const totalViolations = violations.length;

    const violationCounts = violations.reduce((acc, curr) => {
        acc[curr.type] = (acc[curr.type] || 0) + 1;
        return acc;
    }, {});

    const clearViolations = useCallback(() => {
        setViolations([]);
        lastEventTimeRef.current = {};
    }, []);

    return {
        violations,
        violationCounts,
        totalViolations,
        isFullscreen,
        requestFullscreen,
        exitFullscreen,
        clearViolations
    };
};

export default useAntiCheating;
