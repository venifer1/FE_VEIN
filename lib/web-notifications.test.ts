import { describe, it, expect } from "vitest";
import {
  notificationIds,
  urlBase64ToUint8Array,
  subscriptionMatchesKey,
} from "./web-notifications";
import type { Notification as VeinNotification } from "./types";

// node 환경엔 window가 없다. 헬퍼는 window.atob만 지연 참조하므로 얇은 shim으로 충분.
(globalThis as unknown as { window?: unknown }).window ??= globalThis;

// 웹푸시(VAPID) 순수 헬퍼 회귀 보호(R168): 알림 id 추출·base64url 디코드·구독 키 일치 판정.

describe("notificationIds", () => {
  it("stringifies each id", () => {
    const items = [{ id: 1 }, { id: "abc" }] as unknown as VeinNotification[];
    expect(notificationIds(items)).toEqual(["1", "abc"]);
    expect(notificationIds([])).toEqual([]);
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes base64url without padding", () => {
    // "aGVsbG8" = base64url("hello")
    expect(Array.from(urlBase64ToUint8Array("aGVsbG8"))).toEqual([104, 101, 108, 108, 111]);
  });

  it("handles - and _ substitutions and re-pads", () => {
    // "-_w" → "+/w=" → bytes [251, 252]
    expect(Array.from(urlBase64ToUint8Array("-_w"))).toEqual([251, 252]);
  });
});

describe("subscriptionMatchesKey", () => {
  const sub = (key: ArrayBuffer | undefined) =>
    ({ options: { applicationServerKey: key } }) as unknown as PushSubscription;

  it("returns false when no applicationServerKey is stored", () => {
    expect(subscriptionMatchesKey(sub(undefined), "aGVsbG8")).toBe(false);
  });

  it("returns true when stored key equals the current public key bytes", () => {
    const buf = new Uint8Array([104, 101, 108, 108, 111]).buffer;
    expect(subscriptionMatchesKey(sub(buf), "aGVsbG8")).toBe(true);
  });

  it("returns false on length or byte mismatch (rotated key)", () => {
    expect(subscriptionMatchesKey(sub(new Uint8Array([104]).buffer), "aGVsbG8")).toBe(false);
    expect(
      subscriptionMatchesKey(sub(new Uint8Array([104, 101, 108, 108, 112]).buffer), "aGVsbG8"),
    ).toBe(false);
  });
});
