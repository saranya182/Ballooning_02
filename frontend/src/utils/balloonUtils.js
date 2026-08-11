export const getNextBalloonNumber = (balloons) => (balloons.length ? Math.max(...balloons.map((b) => b.number)) + 1 : 1);

export const calculateResult = (actual, lower, upper) => {
  const numeric = Number(actual);
  if (Number.isNaN(numeric)) return 'NOT INSPECTED';
  if (numeric >= Number(lower) && numeric <= Number(upper)) return 'PASS';
  return 'FAIL';
};
