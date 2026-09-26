import { priorities, statuses } from "./tickets.types.js";
const text = (minLength: number, maxLength: number) => ({
  type: "string",
  minLength,
  maxLength,
  pattern: "\\S",
});
const uuid = { type: "string", format: "uuid" };
const technician = { anyOf: [uuid, { type: "null" }] };
const editable = {
  title: text(5, 160),
  description: text(10, 10000),
  category_id: uuid,
  priority: { type: "string", enum: priorities },
  technician_id: technician,
};
export const createSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "description",
    "type",
    "category_id",
    "priority",
    "requester",
  ],
  properties: {
    ...editable,
    type: { type: "string", enum: ["incident", "request"] },
    requester: text(2, 100),
  },
};
export const patchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version"],
  minProperties: 2,
  properties: {
    ...editable,
    version: { type: "integer", minimum: 1 },
    status: { type: "string", enum: statuses },
    pending_reason: text(5, 2000),
    resolution_summary: text(5, 4000),
    reopen_reason: text(5, 2000),
  },
};
export const idSchema = {
  type: "object",
  required: ["id"],
  properties: { id: uuid },
};
export const filterSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: statuses },
    priority: { type: "string", enum: priorities },
    category_id: uuid,
    page: { type: "integer", minimum: 1, maximum: 100000, default: 1 },
    page_size: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};
