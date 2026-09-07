import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './index.css';
import App from './App.jsx';
import { queryClient } from './lib/queryClient.js';
import { ToastProvider } from './hooks/useToasts.jsx';
import { ThemeProvider, applyTheme, initialTheme } from './hooks/useTheme.jsx';

/** `reducedMotion="user"` makes every framer-motion component in the app
 * honour the operating system's reduce-motion setting.
 *
 * It was not honoured at all before this, and the reason is easy to miss:
 * index.css has a thorough `@media (prefers-reduced-motion: reduce)`
 * block, and it does nothing for these three components. That rule sets
 * transition-duration and animation-duration, which govern CSS
 * transitions and CSS keyframes. framer-motion does neither -- it writes
 * transform and opacity values itself, frame by frame -- so the toast
 * slide, the context menu's scale and the resource gauge's sweep all ran
 * at full strength for someone who had asked the OS for less motion.
 *
 * Set here rather than per component so a fourth animated component is
 * covered the day it is written, instead of the day someone notices. It
 * leaves opacity fades alone and disables transforms, which is the
 * distinction the setting actually asks for: people who set it are
 * usually avoiding vestibular triggers, not dimming.
 */
/* The theme goes on the root element BEFORE the first render, not in an
 * effect. An effect runs after the first paint, so the app would show one
 * frame of dark and then flip -- the flash every theme implementation has
 * to deal with. Reading localStorage synchronously here is cheap and
 * happens once. */
applyTheme(initialTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ThemeProvider>
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>
);
