import { NextResponse } from "next/server";

/** `/api/similar`・`/api/trend` 等で揃える API エラー用コード */
export const API_ERROR_CODES = ["INVALID_INPUT", "RATE_LIMIT", "INTERNAL_ERROR"] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export function jsonApiError(status: number, message: string, code: ApiErrorCode) {
  return NextResponse.json({ error: message, code }, { status });
}
