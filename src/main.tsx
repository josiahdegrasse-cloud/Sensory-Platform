import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { ErrorBoundary } from "./app/components/error-boundary"
import { queryClient } from "./app/lib/query-client"
import { initSentry } from "./app/lib/sentry"
import { localTenantPreviewRedirectUrl } from "./app/lib/tenant"
import App from "./app/App.tsx"
import "./styles/index.css"

const tenantPreviewRedirect = localTenantPreviewRedirectUrl()

if (tenantPreviewRedirect) {
  window.location.replace(tenantPreviewRedirect)
} else {
  initSentry()
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
