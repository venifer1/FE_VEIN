import { describe, it, expect } from "vitest";
import { extractError } from "./api";

// extractError는 전 화면 에러 표시의 진입점(R123). 서버 에러 봉투는 그대로,
// 네트워크/알 수 없는 오류는 NETWORK_ERROR로 정규화해야 한다.

describe("extractError", () => {
  it("returns the server error envelope when present", () => {
    const err = {
      isAxiosError: true,
      response: { data: { error: { code: "AUTH_INVALID", message: "잘못된 자격" } } },
    };
    expect(extractError(err)).toEqual({ code: "AUTH_INVALID", message: "잘못된 자격" });
  });

  it("falls back to NETWORK_ERROR with the axios message when no envelope", () => {
    const err = { isAxiosError: true, message: "Network Error" };
    expect(extractError(err)).toEqual({ code: "NETWORK_ERROR", message: "Network Error" });
  });

  it("uses a default message for null/undefined", () => {
    expect(extractError(null).code).toBe("NETWORK_ERROR");
    expect(extractError(undefined).code).toBe("NETWORK_ERROR");
    expect(extractError(null).message).toBeTruthy();
  });

  it("normalizes a response without error field to NETWORK_ERROR", () => {
    const err = { isAxiosError: true, response: { data: {} }, message: "500" };
    expect(extractError(err).code).toBe("NETWORK_ERROR");
  });
});
