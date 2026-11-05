import React from 'react';

interface LazyBoundaryProps {
  /** Shown while the code is downloading. */
  loading: React.ReactNode;
  /** Shown if the download fails. */
  failed: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Wraps a lazily loaded component. Suspense covers the download; this also
 * catches a failed download (for example, when the connection drops), which
 * would otherwise unmount the whole app.
 */
export class LazyBoundary extends React.Component<LazyBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Loading part of the app failed:', error);
  }

  render() {
    if (this.state.hasError) return this.props.failed;
    return <React.Suspense fallback={this.props.loading}>{this.props.children}</React.Suspense>;
  }
}
