import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class FirestoreErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'An unexpected Firestore error occurred.';
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string | null;
      };
      if (parsed && parsed.error) {
        readable = `${parsed.error}${parsed.path ? ` (${parsed.operationType || 'read'} on ${parsed.path})` : ''}`;
      }
    } catch {
      // Non-JSON error message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FirestoreErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="p-6 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 space-y-3"
        >
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-display text-sm font-semibold">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Firestore Access Error</span>
          </div>
          <p className="text-xs text-red-700 dark:text-red-300 font-mono break-all">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="px-3.5 py-1.5 rounded-md bg-white dark:bg-[#19191F] border border-red-300 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
