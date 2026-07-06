/**
 * Utility to calculate pregnancy tracking metrics.
 * 280 days standard gestation (40 weeks).
 */

export function calculatePregnancyStats(lmpDateStr, dueDateStr) {
  let lmpDate = null;
  let dueDate = null;

  if (lmpDateStr) {
    lmpDate = new Date(lmpDateStr);
    dueDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
  } else if (dueDateStr) {
    dueDate = new Date(dueDateStr);
    lmpDate = new Date(dueDate.getTime() - 280 * 24 * 60 * 60 * 1000);
  } else {
    return {
      lmpDate: null,
      dueDate: null,
      currentWeek: null,
      currentTrimester: null,
      pregnancyDay: null,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lmpDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - lmpDate.getTime();
  const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000)) + 1;

  // Constrain days to [1, 280] for standard calendar logic
  const pregnancyDay = Math.max(1, Math.min(280, diffDays));
  const currentWeek = Math.max(1, Math.min(40, Math.floor((pregnancyDay - 1) / 7) + 1));

  let currentTrimester = 1;
  if (currentWeek >= 13 && currentWeek <= 26) {
    currentTrimester = 2;
  } else if (currentWeek >= 27) {
    currentTrimester = 3;
  }

  return {
    lmpDate: lmpDate.toISOString().split('T')[0],
    dueDate: dueDate.toISOString().split('T')[0],
    currentWeek,
    currentTrimester,
    pregnancyDay,
  };
}
