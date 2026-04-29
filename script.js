/* ═══════════════════════════════════════════════════════════════════
   NEXUS STUDY — Core Shared JavaScript
   Includes: Theme Toggle, Toast System, AI Schedule Generator
   ═══════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════
   1. THEME TOGGLE SYSTEM
════════════════════════════════ */

/**
 * Initialize theme from LocalStorage on every page load.
 * Called automatically via DOMContentLoaded.
 */
function initTheme() {
  const savedTheme = localStorage.getItem('nexus_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
}

/**
 * Toggle between dark and light mode.
 * Saves preference to LocalStorage.
 */
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('nexus_theme', isLight ? 'light' : 'dark');
}

// Attach theme toggle on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleTheme);
  }
});


/* ════════════════════════════════
   2. TOAST NOTIFICATION SYSTEM
════════════════════════════════ */

/**
 * Display a toast notification.
 * @param {string} message - The text to show
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Auto-dismiss after (ms)
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Icon map
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  // Color map
  const colors = {
    success: 'var(--neon-green)',
    error: 'var(--neon-pink)',
    warning: 'var(--neon-orange)',
    info: 'var(--neon-cyan)'
  };

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span style="
      width: 24px; height: 24px; border-radius: 50%;
      background: ${colors[type]}22;
      border: 1px solid ${colors[type]};
      color: ${colors[type]};
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: bold; flex-shrink: 0;
    ">${icons[type]}</span>
    <span style="flex: 1; font-size: 0.875rem; color: var(--text-primary);">${message}</span>
  `;

  container.appendChild(toast);

  // Auto dismiss
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}


/* ════════════════════════════════
   3. AI SCHEDULE GENERATOR
════════════════════════════════ */

/**
 * Convert "HH:MM" string to total minutes from midnight.
 * @param {string} timeStr
 * @returns {number}
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convert total minutes from midnight to "HH:MM" string.
 * @param {number} minutes
 * @returns {string}
 */
function minutesToTime(minutes) {
  // Wrap around past midnight
  const totalMin = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Format a duration in minutes to a readable string.
 * @param {number} minutes
 * @returns {string}
 */
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Check if a time window [start, end] overlaps with a blocked period.
 * @param {number} start - in minutes
 * @param {number} end - in minutes
 * @param {Array} blocked - array of {start, end} in minutes
 * @returns {boolean}
 */
function overlapsBlocked(start, end, blocked) {
  return blocked.some(b => start < b.end && end > b.start);
}

/**
 * Generate an AI-optimized daily schedule.
 * 
 * Algorithm:
 * 1. Parse blocked periods (sleep, college).
 * 2. Find free windows throughout the day.
 * 3. Distribute subjects into study slots (50 min each).
 * 4. Insert short breaks (10 min) after every 50 min study.
 * 5. Add revision slots at the end of available study time.
 * 6. Include college period in schedule.
 * 
 * @param {Object} setupData - User's setup form data
 * @returns {Array} - Array of schedule slot objects
 */
function generateAISchedule(setupData) {
  const {
    subjects,
    collegeStart, collegeEnd,
    sleepTime, wakeTime,
    studyHours,
    studyPreference
  } = setupData;

  // Convert all times to minutes from midnight
  const sleep = timeToMinutes(sleepTime);
  const wake  = timeToMinutes(wakeTime);
  const colStart = timeToMinutes(collegeStart);
  const colEnd   = timeToMinutes(collegeEnd);

  // Build blocked time ranges
  // Handle overnight sleep (e.g., sleep at 23:00, wake at 06:00)
  const blocked = [];

  if (sleep > wake) {
    // Overnight sleep: 23:00 → 06:00
    blocked.push({ start: sleep, end: 1440 }); // sleep to midnight
    blocked.push({ start: 0, end: wake });       // midnight to wake
  } else {
    // Same-day nap
    blocked.push({ start: sleep, end: wake });
  }

  // Block college time
  blocked.push({ start: colStart, end: colEnd });

  // Available total study minutes (with 10% buffer for meals/misc)
  const targetStudyMin = studyHours * 60;

  // Study slot length + break pattern
  const STUDY_BLOCK  = 50; // 50 min study
  const BREAK_BLOCK  = 10; // 10 min break
  const REVISION_BLOCK = 20; // 20 min revision

  // Generate candidate time windows (1-minute granularity check)
  // We scan the day in study-block + break-block chunks
  const schedule = [];

  // Add a fixed "morning alarm / wake up" slot
  schedule.push({
    time: minutesToTime(wake),
    activity: '🌅 Morning Routine',
    type: 'break',
    duration: '30 min'
  });

  // Add college block
  schedule.push({
    time: minutesToTime(colStart),
    activity: `🏫 College / Classes`,
    type: 'college',
    duration: formatDuration(colEnd - colStart)
  });

  // --- Determine study windows ---
  // Based on preference, we order morning-first, evening-first, or balanced

  // Build free windows in order
  const morningStart = wake + 30;  // after morning routine
  const morningEnd   = colStart;
  const eveningStart = colEnd;
  const eveningEnd   = sleep > wake ? sleep : sleep + 1440; // handle overnight

  let windows = [];

  if (studyPreference === 'morning') {
    windows = [
      { from: morningStart, to: morningEnd },
      { from: eveningStart, to: eveningEnd }
    ];
  } else if (studyPreference === 'evening') {
    windows = [
      { from: eveningStart, to: eveningEnd },
      { from: morningStart, to: morningEnd }
    ];
  } else {
    // Balanced: split morning and evening equally
    windows = [
      { from: morningStart, to: morningEnd },
      { from: eveningStart, to: eveningEnd }
    ];
  }

  // --- Schedule Study + Break slots ---
  let studyMinutesAllocated = 0;
  let subjectIndex = 0;
  const numSubjects = subjects.length;

  // Calculate how many study blocks we need
  const totalStudyBlocks = Math.ceil(targetStudyMin / STUDY_BLOCK);
  // Reserve last block for revision
  const studyBlocks = Math.max(totalStudyBlocks - 1, 1);

  // Iterate windows and place study slots
  for (const window of windows) {
    let cursor = window.from;

    while (cursor + STUDY_BLOCK <= window.to && studyMinutesAllocated < targetStudyMin) {
      const slotStart = cursor;
      const slotEnd   = cursor + STUDY_BLOCK;

      // Check it doesn't overlap any blocked period
      if (!overlapsBlocked(slotStart % 1440, slotEnd % 1440, blocked)) {
        const subject = subjects[subjectIndex % numSubjects];
        subjectIndex++;

        schedule.push({
          time: minutesToTime(slotStart),
          activity: `📘 ${subject}`,
          type: 'study',
          duration: `${STUDY_BLOCK} min`
        });

        studyMinutesAllocated += STUDY_BLOCK;
        cursor += STUDY_BLOCK;

        // Add a break after study slot (if space available)
        const breakEnd = cursor + BREAK_BLOCK;
        if (breakEnd <= window.to && !overlapsBlocked(cursor % 1440, breakEnd % 1440, blocked)) {
          schedule.push({
            time: minutesToTime(cursor),
            activity: '☕ Short Break',
            type: 'break',
            duration: `${BREAK_BLOCK} min`
          });
          cursor += BREAK_BLOCK;
        }
      } else {
        // Skip ahead in 5-min increments to find next free slot
        cursor += 5;
      }
    }
  }

  // --- Add Revision Slot ---
  // Place after last study slot
  const lastStudySlot = schedule.filter(s => s.type === 'study').pop();
  if (lastStudySlot) {
    const lastTime = timeToMinutes(lastStudySlot.time) + STUDY_BLOCK + BREAK_BLOCK;
    if (!overlapsBlocked(lastTime % 1440, (lastTime + REVISION_BLOCK) % 1440, blocked)) {
      schedule.push({
        time: minutesToTime(lastTime),
        activity: `🔁 Revision — All Subjects`,
        type: 'revision',
        duration: `${REVISION_BLOCK} min`
      });
    }
  }

  // --- Add Sleep / Wind-Down ---
  schedule.push({
    time: minutesToTime(sleep - 30 < 0 ? sleep : sleep - 30),
    activity: '📵 Wind Down / No Screen',
    type: 'break',
    duration: '30 min'
  });

  schedule.push({
    time: minutesToTime(sleep),
    activity: '😴 Sleep Time',
    type: 'break',
    duration: formatDuration(
      sleep > wake ? (1440 - sleep) + wake : wake - sleep
    )
  });

  // --- Sort schedule by time ---
  // Convert times to minutes for sorting (handle midnight crossover)
  schedule.sort((a, b) => {
    let tA = timeToMinutes(a.time);
    let tB = timeToMinutes(b.time);
    // Normalize: anything before wake time is "next day"
    if (tA < wake) tA += 1440;
    if (tB < wake) tB += 1440;
    return tA - tB;
  });

  return schedule;
}


/* ════════════════════════════════
   4. UTILITY HELPERS
════════════════════════════════ */

/**
 * Get greeting based on current hour.
 * @returns {string}
 */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Good Night';
}

/**
 * Format a Date object to readable string.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Safely parse JSON from LocalStorage.
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function getStorage(key, fallback = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Save any value to LocalStorage as JSON.
 * @param {string} key
 * @param {*} value
 */
function setStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
