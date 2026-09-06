"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateAlert } from "@/lib/queries";
import { extractError } from "@/lib/api";
import { SIGNAL_TYPE_LABEL } from "@/components/badges";
import type { Market, SignalType, Timeframe } from "@/lib/types";

const schema = z.object({
  cooldown_sec: z.coerce.number().int().positive("쿨다운은 0보다 큰 정수여야 합니다."),
});
type Values = z.infer<typeof schema>;

export function AlertCreateDialog({
  instrumentId,
  symbol,
  signalType,
  timeframe,
  market,
}: {
  instrumentId: string;
  symbol: string;
  signalType: SignalType;
  timeframe: Timeframe;
  market: Market;
}) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const createAlert = useCreateAlert();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { cooldown_sec: 3600 } });

  const onSubmit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      await createAlert.mutateAsync({
        instrument_id: instrumentId,
        signal_type: signalType,
        timeframe,
        market,
        cooldown_sec: v.cooldown_sec,
      });
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
      }, 900);
    } catch (err) {
      const body = extractError(err);
      setServerError(
        body.code === "DUPLICATE_ALERT"
          ? "이미 동일한 알림 규칙이 있습니다."
          : body.code === "INVALID_COOLDOWN"
            ? "쿨다운 값이 올바르지 않습니다."
            : body.message,
      );
    }
  });

  return (
    <>
      <Button variant="outline" className="flex-1" onClick={() => setOpen(true)}>
        알림 생성
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-2xl border-t border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">패턴 알림 생성</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {symbol} · {SIGNAL_TYPE_LABEL[signalType]} · {timeframe}
            </p>

            {done ? (
              <p className="py-6 text-center text-sm text-[hsl(var(--success))]">알림 규칙이 생성되었습니다.</p>
            ) : (
              <form onSubmit={onSubmit} className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cooldown">쿨다운 (초)</Label>
                  <Input id="cooldown" type="number" min={1} {...register("cooldown_sec")} />
                  {errors.cooldown_sec && <p className="text-xs text-destructive">{errors.cooldown_sec.message}</p>}
                  <p className="text-xs text-muted-foreground">쿨다운 내 중복 알림은 1건으로 제한됩니다.</p>
                </div>
                {serverError && <p className="text-sm text-destructive">{serverError}</p>}
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
                    취소
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? "생성 중..." : "생성"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
