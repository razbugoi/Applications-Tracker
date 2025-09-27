'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message ?? 'Something went wrong',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: null });
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.assign('/');
      }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>We hit a snag</h2>
          <p>{this.state.message ?? 'Unexpected error'}</p>
          <button type="button" onClick={this.handleReset}>
            Go Back
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
