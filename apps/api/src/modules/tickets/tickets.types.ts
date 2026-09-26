export const priorities = ["low", "medium", "high", "critical"] as const;
export const statuses = ["open", "in_progress", "pending", "resolved"] as const;
export type Priority = (typeof priorities)[number];
export type Status = (typeof statuses)[number];
export interface TicketInput {
  title: string;
  description: string;
  type: "incident" | "request";
  category_id: string;
  priority: Priority;
  requester: string;
  technician_id?: string | null;
}
export interface TicketPatch {
  version: number;
  title?: string;
  description?: string;
  category_id?: string;
  priority?: Priority;
  status?: Status;
  technician_id?: string | null;
  pending_reason?: string;
  resolution_summary?: string;
  reopen_reason?: string;
}
export interface Ticket extends TicketInput {
  id: string;
  number: string;
  status: Status;
  technician_id: string | null;
  category_name: string;
  technician_name: string | null;
  version: number;
  pending_reason: string | null;
  resolution_summary: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
}
export interface Filters {
  status?: Status;
  priority?: Priority;
  category_id?: string;
  page?: number;
  page_size?: number;
}
export class TicketError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
