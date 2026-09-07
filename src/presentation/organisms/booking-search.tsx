"use client";

import { useId, type FormEvent, type ReactNode } from "react";
import { Button, Icon, type IconName } from "@/presentation/atoms";
import { DateField, GuestCounter } from "@/presentation/molecules";

type BookingSearchPresentation = "compact" | "hero";

function HeroField({
  children,
  icon,
  iconClassName = "mt-7",
  className = "",
}: Readonly<{
  children: ReactNode;
  icon: IconName;
  iconClassName?: string;
  className?: string;
}>) {
  return (
    <div className={`flex min-w-0 items-start gap-3 ${className}`}>
      <span
        aria-hidden="true"
        className={`vv-booking-icon ${iconClassName} inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-primary`}
      >
        <Icon decorative name={icon} className="size-6" />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function BookingSearch({
  idPrefix,
  formLabel,
  checkIn,
  checkOut,
  guests,
  minGuests,
  maxGuests,
  checkInLabel,
  checkOutLabel,
  guestsLabel,
  submitLabel,
  checkInMin,
  checkOutMin,
  checkInHint,
  checkOutHint,
  checkInError,
  checkOutError,
  guestsError,
  room,
  roomError,
  action = "/disponibilidad",
  onCheckInChange,
  onCheckOutChange,
  onGuestsChange,
  onSubmit,
  pending = false,
  className = "",
  presentation = "compact",
}: {
  idPrefix?: string;
  formLabel: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  minGuests: number;
  maxGuests: number;
  checkInLabel: string;
  checkOutLabel: string;
  guestsLabel: string;
  submitLabel: string;
  checkInMin?: string;
  checkOutMin?: string;
  checkInHint?: string;
  checkOutHint?: string;
  checkInError?: string;
  checkOutError?: string;
  guestsError?: string;
  room?: string;
  roomError?: string;
  action?: string;
  onCheckInChange: (value: string) => void;
  onCheckOutChange: (value: string) => void;
  onGuestsChange: (value: number) => void;
  onSubmit: () => void;
  pending?: boolean;
  className?: string;
  presentation?: BookingSearchPresentation;
}) {
  const generated = useId().replace(/:/g, "");
  const prefix = idPrefix ?? `booking-${generated}`;
  const isHero = presentation === "hero";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!pending) onSubmit();
  };
  return (
    <form
      aria-label={formLabel}
      aria-busy={pending}
      action={action}
      method="get"
      onSubmit={submit}
      className={`${isHero ? "vv-booking grid gap-5 rounded-[1.75rem] border border-border/80 bg-card p-4 shadow-2xl ring-1 ring-background/70 phone:p-5 tablet:grid-cols-2 tablet:p-6 laptop:flex laptop:items-center laptop:gap-0" : "grid gap-3 rounded-xl bg-card p-3 shadow-lg tablet:grid-cols-2 laptop:flex laptop:justify-between laptop:gap-6 laptop:[&>*]:min-w-0 laptop:[&>div]:w-48"} ${className}`}
    >
      {isHero ? (
        <HeroField
          icon="CalendarDays"
          className="laptop:flex-1 laptop:border-r laptop:border-border laptop:pr-6 laptop:pl-1"
        >
          <DateField
            id={`${prefix}-check-in`}
            label={checkInLabel}
            value={checkIn}
            name="checkIn"
            min={checkInMin}
            hint={checkInHint}
            error={checkInError}
            errorClassName="text-xs leading-4"
            reserveMessageSpace
            inputClassName="min-h-14 rounded-lg border-2 px-4 py-3 text-base"
            onChange={(event) => onCheckInChange(event.target.value)}
            onInput={(event) => onCheckInChange(event.currentTarget.value)}
          />
        </HeroField>
      ) : (
        <DateField
          id={`${prefix}-check-in`}
          label={checkInLabel}
          value={checkIn}
          name="checkIn"
          min={checkInMin}
          hint={checkInHint}
          error={checkInError}
          onChange={(event) => onCheckInChange(event.target.value)}
          onInput={(event) => onCheckInChange(event.currentTarget.value)}
        />
      )}
      {isHero ? (
        <HeroField
          icon="CalendarDays"
          className="laptop:flex-1 laptop:border-r laptop:border-border laptop:px-6"
        >
          <DateField
            id={`${prefix}-check-out`}
            label={checkOutLabel}
            value={checkOut}
            name="checkOut"
            min={checkOutMin}
            hint={checkOutHint}
            error={checkOutError}
            errorClassName="text-xs leading-4"
            reserveMessageSpace
            inputClassName="min-h-14 rounded-lg border-2 px-4 py-3 text-base"
            onChange={(event) => onCheckOutChange(event.target.value)}
            onInput={(event) => onCheckOutChange(event.currentTarget.value)}
          />
        </HeroField>
      ) : (
        <DateField
          id={`${prefix}-check-out`}
          label={checkOutLabel}
          value={checkOut}
          name="checkOut"
          min={checkOutMin}
          hint={checkOutHint}
          error={checkOutError}
          onChange={(event) => onCheckOutChange(event.target.value)}
          onInput={(event) => onCheckOutChange(event.currentTarget.value)}
        />
      )}
      {isHero ? (
        <HeroField
          icon="UserRound"
          iconClassName="mt-6"
          className="laptop:px-6"
        >
          <GuestCounter
            className="self-end"
            label={guestsLabel}
            value={guests}
            min={minGuests}
            max={maxGuests}
            error={guestsError}
            onChange={onGuestsChange}
          />
        </HeroField>
      ) : (
        <GuestCounter
          className="self-end"
          label={guestsLabel}
          value={guests}
          min={minGuests}
          max={maxGuests}
          error={guestsError}
          onChange={onGuestsChange}
        />
      )}
      <input type="hidden" name="guests" value={String(guests)} readOnly />
      {room ? <input type="hidden" name="room" value={room} readOnly /> : null}
      {roomError ? (
        <p role="alert" className="text-body text-destructive">
          {roomError}
        </p>
      ) : null}
      <Button
        type="submit"
        loading={pending}
        className={
          isHero
            ? "min-h-14 justify-self-stretch rounded-lg px-6 text-sm font-semibold laptop:min-w-56 laptop:justify-self-end"
            : "justify-self-center self-end px-3 py-1 text-xs laptop:justify-self-center"
        }
      >
        {submitLabel}
      </Button>
    </form>
  );
}
