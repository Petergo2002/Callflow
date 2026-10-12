import { ArrowRight, Plus, Sprout } from "lucide-react";
import { Status } from "@/lib/model";
import { Button } from "./ui/button";
export function StatusBadge({ status }: { status: Status }) {
  const color =
    status === "Intresserad" || status === "Kund"
      ? "green"
      : status === "Återkom senare"
        ? "orange"
        : status === "Möte bokat"
          ? "blue"
          : status === "Inte intresserad"
            ? "red"
            : "";
  return (
    <span className={`badge ${color ? "badge-" + color : ""}`}>{status}</span>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="Dagens samtalsmål"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, Math.round(value))}
    >
      <div
        className="progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
export function Empty({
  title = "Ett bra samtal börjar med ett företag.",
  description = "Importera en CSV- eller Excel-fil, eller lägg till ditt första företag.",
  onAdd,
  onImport,
}: {
  title?: string;
  description?: string;
  onAdd?: () => void;
  onImport?: () => void;
}) {
  return (
    <div className="empty">
      <Sprout size={35} strokeWidth={1.3} />
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="flex justify-center">
        {onAdd && (
          <Button variant="secondary" onClick={onAdd}>
            <Plus size={14} />
            Lägg till företag
          </Button>
        )}
        {onImport && (
          <Button onClick={onImport}>
            Importera leads
            <ArrowRight size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
export function duration(seconds: number) {
  return `${Math.floor(seconds / 3600) ? Math.floor(seconds / 3600) + ":" : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
