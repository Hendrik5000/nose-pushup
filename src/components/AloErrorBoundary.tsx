import { Component, type ErrorInfo, type ReactNode } from "react";

type AloErrorBoundaryProps = Readonly<{
  children: ReactNode;
  /** Name des geschützten Bereichs, z. B. "Widgets" — ehrlich im Fallback genannt. */
  section: string;
}>;

type AloErrorBoundaryState = {
  failed: boolean;
  resetCount: number;
};

/**
 * Isolierter Fehlerzustand: Ein Renderfehler in einem Bereich blockiert nicht die
 * gesamte Startseite, sondern zeigt nur für diesen Bereich eine ehrliche Meldung
 * mit einem Neuladen des Bereichs (keine erfundenen Inhalte, kein stiller Absturz).
 */
export class AloErrorBoundary extends Component<AloErrorBoundaryProps, AloErrorBoundaryState> {
  state: AloErrorBoundaryState = { failed: false, resetCount: 0 };

  static getDerivedStateFromError(): Partial<AloErrorBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error(`[${this.props.section}]`, error, info.componentStack);
    }
  }

  private reset = () => {
    this.setState((state) => ({ failed: false, resetCount: state.resetCount + 1 }));
  };

  render() {
    if (!this.state.failed) {
      return <div key={this.state.resetCount}>{this.props.children}</div>;
    }
    return (
      <section
        role="alert"
        aria-label={`${this.props.section} konnte nicht geladen werden`}
        className="rounded-2xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground backdrop-blur"
      >
        <p className="font-semibold text-foreground">
          {this.props.section} konnte nicht geladen werden.
        </p>
        <p className="mt-1">
          In diesem Bereich ist ein Fehler aufgetreten. Der Rest bleibt nutzbar.
        </p>
        <button type="button" className="alo-btn mt-3" onClick={this.reset}>
          Erneut versuchen
        </button>
      </section>
    );
  }
}
