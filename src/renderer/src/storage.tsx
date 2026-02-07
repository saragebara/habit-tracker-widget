export interface Habit {
  id: number;
  name: string;
  completions: Record<string, boolean>; // Key: YYYY-MM-DD, Value: true if completed
}

//mock database
export const mockHabits: Habit[] = [
  {
    id: 1,
    name: 'Exercise',
    completions: {
      '2026-02-01': true,
      '2026-02-02': true,
      '2026-02-03': true,
      '2026-02-05': true,
      '2026-02-08': true,
      '2026-02-10': true,
      '2026-02-12': true,
      '2026-02-15': true,
      '2026-02-17': true,
      '2026-02-20': true,
    }
  },
  {
    id: 2,
    name: 'Read',
    completions: {
      '2026-02-01': true,
      '2026-02-03': true,
      '2026-02-04': true,
      '2026-02-05': true,
      '2026-02-06': true,
      '2026-02-07': true,
      '2026-02-09': true,
      '2026-02-11': true,
      '2026-02-13': true,
      '2026-02-14': true,
    }
  },
  {
    id: 3,
    name: 'Meditate',
    completions: {
      '2026-02-02': true,
      '2026-02-04': true,
      '2026-02-06': true,
      '2026-02-08': true,
      '2026-02-10': true,
      '2026-02-12': true,
      '2026-02-14': true,
      '2026-02-16': true,
    }
  },
  {
    id: 4,
    name: 'Water Plants',
    completions: {
      '2026-02-03': true,
      '2026-02-07': true,
      '2026-02-11': true,
      '2026-02-15': true,
      '2026-02-19': true,
    }
  },
  {
    id: 5,
    name: 'Journal',
    completions: {
      '2026-02-01': true,
      '2026-02-02': true,
      '2026-02-04': true,
      '2026-02-05': true,
      '2026-02-07': true,
      '2026-02-08': true,
      '2026-02-09': true,
      '2026-02-11': true,
    }
  }
];

//function gets habit count for each day
export function getHabitsForMonth(
  habits: Habit[],
  year: number,
  month: number
): Record<number, number> {
  const result: Record<number, number> = {};

  //initializing all days to 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    result[day] = 0;
  }

  //counting the total completions for each day
  habits.forEach(habit => {
    Object.keys(habit.completions).forEach(dateStr => {
      const date = new Date(dateStr);
      if (date.getFullYear() === year && date.getMonth() === month) {
        const day = date.getDate();
        result[day] = (result[day] || 0) + 1;
      }
    });
  });

  return result;
}