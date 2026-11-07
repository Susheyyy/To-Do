import { Component, ErrorInfo, ReactNode } from "react";
import { Icon } from "./Icon";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in React tree:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", width: "100%", background: "var(--color-bg-primary, #121214)", color: "var(--color-text-primary, #ffffff)", padding: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "440px", textAlign: "center", padding: "32px", borderRadius: "16px", background: "var(--color-bg-secondary, #1a1a1e)", border: "1px solid var(--color-border, #2c2c34)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", marginBottom: "16px", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
              <Icon name="close" size={28} />
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 8px 0" }}>Something went wrong</h2>
            <p style={{ fontSize: "14px", color: "var(--color-text-secondary, #a1a1aa)", margin: "0 0 20px 0" }}>
              The application encountered an unexpected error. You can try recovering or reloading the window.
            </p>
            {this.state.error?.message && (
              <pre style={{ fontSize: "12px", background: "rgba(0,0,0,0.4)", color: "#fca5a5", padding: "12px", borderRadius: "8px", width: "100%", marginBottom: "20px", textAlign: "left", overflow: "auto", maxHeight: "120px", border: "1px solid rgba(255,255,255,0.05)", fontFamily: "monospace" }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{ padding: "8px 16px", fontSize: "14px", fontWeight: 500, borderRadius: "8px", background: "var(--color-bg-tertiary, #2a2a30)", color: "var(--color-text-primary, #ffffff)", border: "1px solid var(--color-border, #3a3a44)", cursor: "pointer" }}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "14px", fontWeight: 500, borderRadius: "8px", background: "#4f46e5", color: "#ffffff", border: "none", cursor: "pointer" }}
              >
                <Icon name="redo" size={14} />
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

