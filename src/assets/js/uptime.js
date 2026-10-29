let uptimeElements = document.querySelectorAll('[data-uptime]');

const elapsedParts = (birthDate, now) => {
  const [year, month, day] = birthDate.split('-').map(Number);

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

  const days = (today - monthiversary) / 86400000;

  return { years, months, days };
};

const formatUptime = (element, now) => {
  const parts = elapsedParts(element.dataset.uptime, now);

  const locale =
    element.dataset.uptimeLocale || document.documentElement.lang || 'en';

  const units = ['years', 'months', 'days'];

  const unitNames = {
    years: 'year',
    months: 'month',
    days: 'day',
  };

  return units
    .map((unit) =>
      new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: unitNames[unit],
        unitDisplay: 'long',
      }).format(parts[unit]),
    )
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

  window.clearTimeout(updateUptime.timer);
  updateUptime.timer = window.setTimeout(updateUptime, tomorrow - now);
};

document.addEventListener('lobby:navigate', () => {
  uptimeElements = document.querySelectorAll('[data-uptime]');

  if (uptimeElements.length) updateUptime();
});

if (uptimeElements.length > 0) {
  updateUptime();
}
