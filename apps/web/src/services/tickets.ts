import { useEffect, useState } from "react";
export const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};
export const statusLabels = {
  open: "Aberto",
  in_progress: "Em atendimento",
  pending: "Pendente",
  resolved: "Resolvido",
};
export const typeLabels = { incident: "Incidente", request: "Solicitação" };
export type Priority = keyof typeof priorityLabels;
export type Status = keyof typeof statusLabels;
export interface Option {
  id: string;
  name: string;
}
export interface Ticket {
  id: string;
  number: string;
  title: string;
  description: string;
  type: keyof typeof typeLabels;
  category_id: string;
  category_name: string;
  priority: Priority;
  status: Status;
  requester: string;
  technician_id: string | null;
  technician_name: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  version: number;
  pending_reason: string | null;
  resolution_summary: string | null;
}
export interface HistoryEvent {
  id: string;
  action: string;
  actor: string;
  note: string | null;
  created_at: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}
export interface Detail extends Ticket {
  history: HistoryEvent[];
}
export interface TicketList {
  items: Ticket[];
  total: number;
  page: number;
  page_size: number;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: options.signal ?? AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(
      0,
      "Não foi possível acessar o serviço. Verifique a conexão e tente novamente.",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      body?.message ?? "Não foi possível concluir a operação. Tente novamente.",
    );
  return body as T;
}
export function useCatalog() {
  const [categories, setCategories] = useState<Option[]>([]);
  const [technicians, setTechnicians] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([api<Option[]>("/categories"), api<Option[]>("/technicians")])
      .then(([c, t]) => {
        if (active) {
          setCategories(c);
          setTechnicians(t);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return {
    categories,
    technicians,
    error,
    loading,
    retry: () => setAttempt((a) => a + 1),
  };
}
export const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
