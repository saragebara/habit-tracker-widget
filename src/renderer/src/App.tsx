import React, { useState } from "react";
import { mockHabits, getHabitsForMonth } from "./storage";

export default function App() {
  const [currentMonth, setCurrentMonth] = useState(0); // 0 = current month, -1 = last month, etc.
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');

  //getting current date and adjusting offset
  const getDisplayDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + currentMonth);
    return date;
  };

  const displayDate = getDisplayDate();
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  //getting month's dates
  const getMonthDates = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const dates: (number | null)[] = [];

    //adding empty cells for days before the month starts
    for (let i = 0; i < firstDay; i++) {
      dates.push(null);
    }

    //adding all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(day);
    }

    return dates;
  };

  //week dates 
  const getWeekDates = () => {
    const now = new Date();
    const dates: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.getDate());
    }

    return dates;
  };

  const dates = viewMode === 'monthly' ? getMonthDates() : getWeekDates();
  
  // Get today's date (only highlight if viewing current month)
  const today = currentMonth === 0 ? new Date().getDate() : -1;

  // Get habits data for this month
  const monthData = getHabitsForMonth(mockHabits, year, month);

  // Calculate count for a specific day
  const getCountForDay = (day: number): number => {
    return monthData[day] || 0;
  };

  // Get color class based on count (1-5+ levels)
  const getColorClass = (count: number): string => {
    if (count === 0) return '';
    if (count === 1) return 'level-1';
    if (count === 2) return 'level-2';
    if (count === 3) return 'level-3';
    if (count === 4) return 'level-4';
    return 'level-5'; // 5+
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => prev - 1);
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => prev + 1);
  };

  // Calculate daily average for current month
  const calculateDailyAverage = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCompleted = Object.values(monthData).reduce((sum, count) => sum + count, 0);
    return (totalCompleted / daysInMonth).toFixed(1);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="habit-tracker">
      <div className="header">
        <button className="icon-button settings-button">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
          </svg>
        </button>
        <button className="icon-button close-button">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div className="title-row">
        <h1>Summary</h1>
        <button
          className="view-toggle"
          onClick={() => setViewMode(viewMode === 'monthly' ? 'weekly' : 'monthly')}
        >
          {viewMode}
          <svg viewBox="0 0 24 24" fill="currentColor" className="dropdown-icon">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
      </div>

      <div className="calendar-container">
        <div className="calendar-grid">
          {dates.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="calendar-cell empty" />;
            }

            const count = getCountForDay(day);
            const colorClass = getColorClass(count);
            const isToday = day === today;

            return (
              <div
                key={`day-${day}-${index}`}
                className={`calendar-cell ${colorClass} ${isToday ? 'today' : ''}`}
                title={`${count} habit${count !== 1 ? 's' : ''} completed`}
              >
              </div>
            );
          })}
        </div>
      </div>

      <div className="stats">
        <div className="stat-label">daily average</div>
        <div className="stat-value">{calculateDailyAverage()} habits</div>
        <div className="navigation">
          <button onClick={handlePrevMonth} className="nav-button">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>
          <span className="month-name">{monthNames[month]} {year}</span>
          <button onClick={handleNextMonth} className="nav-button">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}