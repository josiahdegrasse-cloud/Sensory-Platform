import { Component, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl">
          <h1 className="text-xl font-semibold text-white bg-slate-900 rounded-lg px-4 py-2 mb-4">
            Something went wrong
          </h1>
          <pre className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 overflow-auto mb-6 whitespace-pre-wrap break-words">
            {this.state.error?.message ?? "Unknown error"}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-white border border-black text-black font-medium py-2 px-4 rounded-lg hover:bg-black hover:text-white transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}
