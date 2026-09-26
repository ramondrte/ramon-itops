import {
  priorityLabels,
  statusLabels,
  type Priority,
  type Status,
} from "../../services/tickets";
export function PriorityBadge({ value }: { value: Priority }) {
  return (
    <span className={`ticket-badge priority-${value}`}>
      <i />
      {priorityLabels[value]}
    </span>
  );
}
export function StatusBadge({ value }: { value: Status }) {
  return (
    <span className={`ticket-badge status-${value}`}>
      {statusLabels[value]}
    </span>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-notice" role="alert">
      <p>{message}</p>
      {retry && (
        <button type="button" onClick={retry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
