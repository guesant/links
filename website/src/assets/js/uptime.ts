type UptimeUnit = 'years' | 'months' | 'days';

type UptimeParts = Record<UptimeUnit, number>;

let uptimeElements = document.querySelectorAll<HTMLElement>('[data-uptime]');

let updateTimer: number | undefined;

const elapsedParts = (birthDate: string, now: Date): UptimeParts => {
  const [year = 0, month = 1, day = 1] = birthDate.split('-').map(Number);

  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );

  let years = today.getUTCFullYear() - year;

  let anniversary = new Date(Date.UTC(year + years, month - 1, day));

  if (anniversary > today) {
    years -= 1;
    anniversary = new Date(Date.UTC(year + years, month - 1, day));
  }

  let months =
    (today.getUTCFullYear() - anniversary.getUTCFullYear()) * 12 +
    today.getUTCMonth() -
    anniversary.getUTCMonth();

  let monthiversary = new Date(
    Date.UTC(
      anniversary.getUTCFullYear(),
      anniversary.getUTCMonth() + months,
      day,
    ),
  );

  if (monthiversary > today) {
    months -= 1;
    monthiversary = new Date(
      Date.UTC(
        anniversary.getUTCFullYear(),
        anniversary.getUTCMonth() + months,
        day,
      ),
    );
  }

  const days = (today.getTime() - monthiversary.getTime()) / 86400000;

  return { years, months, days };
};

const formatUptime = (element: HTMLElement, now: Date) => {
  const birthDate = element.dataset.uptime;

  if (!birthDate) {
    return '';
  }

  const parts = elapsedParts(birthDate, now);

  const locale =
    element.dataset.uptimeLocale || document.documentElement.lang || 'en';

  const units: UptimeUnit[] = ['years', 'months', 'days'];

  const unitNames: Record<UptimeUnit, 'year' | 'month' | 'day'> = {
    years: 'year',
    months: 'month',
    days: 'day',
  };

  return units
    .map((unit) => {
      return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: unitNames[unit],
        unitDisplay: 'long',
      }).format(parts[unit]);
    })
    .join(', ');
};

const updateUptime = () => {
  const now = new Date();

  uptimeElements.forEach((element) => {
    element.textContent = formatUptime(element, now);
  });

  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );

  window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(
    updateUptime,
    tomorrow.getTime() - now.getTime(),
  );
};

document.addEventListener('lobby:navigate', () => {
  uptimeElements = document.querySelectorAll<HTMLElement>('[data-uptime]');

  if (uptimeElements.length) {
    updateUptime();
  }
});

if (uptimeElements.length > 0) {
  updateUptime();
}
