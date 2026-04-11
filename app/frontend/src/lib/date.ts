export function getTodayYmd() {
  return formatDateYmd(new Date());
}

export function formatDateYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseYmdToDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatDisplayDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const date = parseYmdToDate(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function startOfWeekSunday(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

export function dayDifferenceFromToday(value: string) {
  const target = parseYmdToDate(value);
  const today = parseYmdToDate(getTodayYmd());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

export function dayDifferenceFromStart(startDate: string | null | undefined, compareDate = getTodayYmd()) {
  if (!startDate) {
    return null;
  }

  const start = parseYmdToDate(startDate);
  const compare = parseYmdToDate(compareDate);
  const diffMs = compare.getTime() - start.getTime();
  return Math.floor(diffMs / 86400000) + 1;
}
