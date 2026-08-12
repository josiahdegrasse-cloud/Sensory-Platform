export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  // Monitoring is important, but it should not block the login shell. Load it
  // as a separate chunk; browser tracing still captures route and Core Web
  // Vitals data once initialized.
  void import("@sentry/react").then(Sentry => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION,
      sendDefaultPii: false,
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
      integrations: [Sentry.browserTracingIntegration()],
    })
  })
}

export type AppErrorSource = 'react-root' | 'react-route'

export function captureAppError(error: unknown, source: AppErrorSource) {
  if (!import.meta.env.VITE_SENTRY_DSN) return

  const reportable = error instanceof Error ? error : new Error('Unknown application error')
  void import('@sentry/react')
    .then(Sentry => {
      Sentry.captureException(reportable, {
        tags: { app_error_source: source },
      })
    })
    .catch(() => {
      // Monitoring must never replace or interrupt the user-facing recovery path.
    })
}
