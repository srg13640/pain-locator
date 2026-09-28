const CENTRAL: Intl.DateTimeFormatOptions = {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

function part(date: Date, type: Intl.DateTimeFormatPartTypes): string {
  const parts = new Intl.DateTimeFormat("en-US", CENTRAL).formatToParts(date);
  return parts.find((item) => item.type === type)?.value ?? "";
}

/** Clock time in US Central, labeled CT, from the computer's timezone data. */
export function formatCentralTime(date: Date): string {
  return `${part(date, "year")}-${part(date, "month")}-${part(date, "day")} ${part(date, "hour")}:${part(date, "minute")} CT`;
}

export function centralDay(date: Date): string {
  return `${part(date, "year")}-${part(date, "month")}-${part(date, "day")}`;
}
