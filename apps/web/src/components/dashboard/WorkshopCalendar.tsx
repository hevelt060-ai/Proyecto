import { useState } from "react";

import type { BikeService } from "./types";
import { toLocalDateKey } from "./types";

interface WorkshopCalendarProps {
  services: BikeService[];
  onSelectDeliveries: (date: string, services: BikeService[]) => void;
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function WorkshopCalendar({ services, onSelectDeliveries }: WorkshopCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const monthLabel = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(visibleMonth);
  const offset = (visibleMonth.getDay() + 6) % 7;
  const dayCount = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
  const todayKey = toLocalDateKey(new Date());
  const calendarDays = Array.from({ length: cellCount }, (_, index) => {
    const dayNumber = index - offset + 1;
    if (dayNumber < 1 || dayNumber > dayCount) return null;
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), dayNumber);
    const dateKey = toLocalDateKey(date);
    return {
      date,
      dateKey,
      services: services.filter(
        (service) => service.deliveryDate && service.deliveryDate.slice(0, 10) === dateKey,
      ),
    };
  });

  const changeMonth = (delta: number) => {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + delta, 1));
  };

  return (
    <section className="dashboard-panel calendar-panel" aria-labelledby="calendar-heading">
      <div className="panel-heading calendar-heading">
        <div>
          <p className="panel-kicker">AGENDA</p>
          <h2 id="calendar-heading">Entregas</h2>
        </div>
        <div className="calendar-navigation">
          <button type="button" aria-label="Mes anterior" onClick={() => changeMonth(-1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button type="button" aria-label="Mes siguiente" onClick={() => changeMonth(1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="calendar-month-label">{monthLabel}</div>
      <div className="calendar-grid" role="grid" aria-label={`Entregas de ${monthLabel}`}>
        {WEEKDAYS.map((weekday, index) => (
          <span className="calendar-weekday" key={`${weekday}-${index}`} role="columnheader">
            {weekday}
          </span>
        ))}
        {calendarDays.map((day, index) =>
          day ? (
            <button
              key={day.dateKey}
              type="button"
              className={`calendar-day${day.dateKey === todayKey ? " is-today" : ""}${day.services.length ? " has-deliveries" : ""}`}
              disabled={day.services.length === 0}
              aria-label={`${day.date.getDate()} de ${monthLabel}${day.services.length ? `, ${day.services.length} entregas` : ""}`}
              onClick={() => onSelectDeliveries(day.dateKey, day.services)}
            >
              <span>{day.date.getDate()}</span>
              {day.services.length > 0 && <span className="delivery-mark" aria-hidden="true" />}
            </button>
          ) : (
            <span className="calendar-day is-outside" key={`outside-${index}`} aria-hidden="true" />
          ),
        )}
      </div>

      <p className="calendar-legend">
        <span className="delivery-mark" aria-hidden="true" /> Entrega programada
      </p>
    </section>
  );
}
