"use client";

import { Component, ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/** Full-page error boundary — use at the layout/page level */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2">
              {this.state.error?.message || "An unexpected error occurred"}
            </AlertDescription>
            <Button
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ComponentErrorBoundaryProps {
  children: ReactNode;
  /** Label shown in the error message, e.g. "Portfolio Chart" */
  name: string;
}

/**
 * Lightweight error boundary for individual components/sections.
 * Shows an inline error with a retry button instead of crashing the whole page.
 */
export class ComponentErrorBoundary extends Component<ComponentErrorBoundaryProps, State> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.name}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">
            Failed to load {this.props.name}
          </p>
          <p className="text-xs text-gray-500 mb-3">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}