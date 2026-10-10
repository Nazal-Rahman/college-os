// College OS — Unified 5-Item Navigation Front-End Controller

let state = {
  user: null,
  subjects: [],
  timetable: [],
  attendanceData: null,
  periodAttendanceRecords: {},
  holidayDays: ['Saturday', 'Sunday'],
  defaultAttendanceTarget: 75,
  customTargetsEnabled: false,
  academicCalendarPdf: null,
  tasks: [],
  labs: [],
  studyPlans: [],
  studySessions: [],
  vaultFolders: [],
  vaultFiles: [],
  calendarEvents: [],
  currentView: 'dashboard',
  selectedSheetDay: 'Monday',
  selectedTaskFilter: 'All',
  activeFolderId: null,
  isTrashView: false,
  timer: {
    totalSeconds: 25 * 60,
    secondsLeft: 25 * 60,
    isRunning: false,
    intervalId: null
  }
};

// -------------------------------------------------------------
// INITIALIZATION & THEME MANAGER
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  // Apply saved theme (Default to dark for high contrast)
  const savedTheme = localStorage.getItem('college_os_theme') || 'dark';
  setThemeMode(savedTheme, false);

  // Check auth or auto-login as demo
  let token = API.getToken();
  if (!token) {
    try {
      console.log('Auto-logging in as Demo Student for direct verification...');
      const demoRes = await API.demoLogin();
      token = demoRes.token;
    } catch (e) {
      console.error('Demo auto-login failed:', e);
      window.location.href = '/';
      return;
    }
  }

  try {
    const user = await API.getMe();
    state.user = user;
    renderUserProfile(user);

    // [Vercel Data Wipe Hydration]
    // If Vercel wiped the backend store, the user's data will be empty.
    // Try to load from Firebase Cloud or LocalStorage offline backup.
    let backupData = null;
    if (window.FirebaseSync && window.FirebaseSync.isAvailable()) {
      try {
        backupData = await window.FirebaseSync.loadUserData(user.id);
      } catch (e) { console.warn('Cloud restore check failed:', e); }
    }
    if (!backupData) {
      try {
        const localCache = JSON.parse(localStorage.getItem(`college_os_backup_${user.email}`));
        if (localCache) backupData = localCache;
      } catch(e) {}
    }

    if (backupData && Object.keys(backupData).length > 0) {
       const { subjects } = await API.getSubjects();
       if (!subjects || subjects.length === 0) {
          console.log('[Hydration] Backend appears empty (Vercel cold start). Restoring state...');
          await API.restoreCloudData(backupData);
       }
    }

    // Initial load
    await refreshAllData();

    // Check URL hash for direct view navigation
    const initialView = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(initialView);
  } catch (err) {
    console.error('Failed to initialize session:', err);
    API.logout();
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearchModal();
    }
    if (e.key === 'Escape') {
      closeFullscreenStudyTimer();
      closeAllModals();
    }
  });
});

function setThemeMode(mode, save = true) {
  const isDark = mode === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  if (save) localStorage.setItem('college_os_theme', mode);

  const icon1 = document.getElementById('header-theme-icon');
  if (icon1) icon1.textContent = isDark ? '☀️' : '🌙';

  const icon2 = document.getElementById('theme-btn-icon');
  const text2 = document.getElementById('theme-btn-text');
  if (icon2) icon2.textContent = isDark ? '☀️' : '🌙';
  if (text2) text2.textContent = isDark ? 'White Mode' : 'Dark Mode';
}

function toggleThemeMode() {
  const isDark = document.documentElement.classList.contains('dark');
  setThemeMode(isDark ? 'light' : 'dark', true);
}

function renderUserProfile(user) {
  if (!user || !user.profile) return;
  const p = user.profile;

  const nameEl = document.getElementById('top-student-name');
  if (nameEl) nameEl.textContent = p.name;

  const gpaEl = document.getElementById('top-student-gpa');
  if (gpaEl) gpaEl.textContent = `${p.cgpa || 3.84} CGPA`;

  const cgpaDisp = document.getElementById('grades-cgpa-val');
  if (cgpaDisp) cgpaDisp.textContent = p.cgpa || '3.84';

  const semTextEl = document.getElementById('top-semester-text');
  if (semTextEl) semTextEl.textContent = `${p.semester} • ${p.major || 'CSE'}`;

  const semSideEl = document.getElementById('sidebar-semester-label');
  if (semSideEl) semSideEl.textContent = p.semester;

  const welcomeEl = document.getElementById('dash-welcome-text');
  if (welcomeEl) welcomeEl.textContent = `Good day, ${p.name.split(' ')[0]} 👋`;

  // Settings inputs
  const sName = document.getElementById('settings-input-name');
  if (sName) sName.value = p.name;
  const sCollege = document.getElementById('settings-input-college');
  if (sCollege) sCollege.value = p.college;
  const sSem = document.getElementById('settings-input-semester');
  if (sSem) sSem.value = p.semester;
  const sMajor = document.getElementById('settings-input-major');
  if (sMajor) sMajor.value = p.major;
  const sId = document.getElementById('settings-input-id');
  if (sId) sId.value = p.studentId;

  const dispName = document.getElementById('settings-name-display');
  if (dispName) dispName.textContent = p.name;
  const dispEmail = document.getElementById('settings-email-display');
  if (dispEmail) dispEmail.textContent = user.email;
}

// -------------------------------------------------------------
// 5 PRIMARY NAVIGATION DISPATCHER
// -------------------------------------------------------------

function navigateTo(viewName) {
  const validViews = ['dashboard', 'timetable', 'labs', 'vault', 'settings'];
  if (!validViews.includes(viewName)) viewName = 'dashboard';

  state.currentView = viewName;
  window.location.hash = viewName;

  // Hide all panels, show target
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.add('hidden'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.remove('hidden');

  // Update Desktop Sidebar Buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.getAttribute('data-view') === viewName) {
      btn.className = 'nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition bg-blue-600 text-white shadow-sm';
    } else {
      btn.className = 'nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition hover:bg-slate-100 dark:hover:bg-slate-800/60';
    }
  });

  // Update Mobile Bottom Dock Buttons
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    if (btn.getAttribute('data-view') === viewName) {
      btn.className = 'mobile-nav-btn flex flex-col items-center gap-0.5 text-blue-600';
    } else {
      btn.className = 'mobile-nav-btn flex flex-col items-center gap-0.5 text-slate-500';
    }
  });

  // Re-render target view
  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'timetable') renderDailyAttendanceSheet();
  if (viewName === 'labs') renderLabsAndWorks();
  if (viewName === 'vault') renderVault();
  if (viewName === 'settings') renderSettings();
}

async function refreshAllData() {
  try {
    const [subRes, ttRes, attRes, periodRecRes, taskRes, labRes, planRes, studyRes, vaultFldRes, vaultFileRes, calRes, calPdfRes] = await Promise.all([
      API.getSubjects(),
      API.getTimetable(),
      API.getAttendance(),
      API.request('/api/attendance/period-records'),
      API.getTasks(),
      API.getLabs(),
      API.getStudyPlans(),
      API.getStudySessions(),
      API.getFolders(),
      API.getFiles(),
      API.getCalendar(),
      API.getCalendarPdf().catch(() => ({ file: null }))
    ]);

    state.subjects = subRes.subjects || [];
    state.timetable = ttRes.timetable || [];
    state.holidayDays = ttRes.holidayDays || ['Saturday', 'Sunday'];
    state.attendanceData = attRes;
    state.defaultAttendanceTarget = attRes.defaultTarget || 75;
    state.customTargetsEnabled = attRes.customTargetsEnabled || false;
    state.periodAttendanceRecords = periodRecRes.records || {};
    state.tasks = taskRes.tasks || [];
    state.labs = labRes.labs || [];
    state.studyPlans = planRes.plans || [];
    state.studySessions = studyRes.sessions || [];
    state.vaultFolders = vaultFldRes.folders || [];
    state.vaultFiles = vaultFileRes.files || [];
    state.calendarEvents = calRes.events || [];
    state.academicCalendarPdf = calPdfRes ? calPdfRes.file : null;

    // Sync settings UI inputs
    const prefGlobal = document.getElementById('pref-global-target');
    if (prefGlobal) prefGlobal.value = state.defaultAttendanceTarget;

    const prefCustomSwitch = document.getElementById('pref-custom-target-switch');
    if (prefCustomSwitch) prefCustomSwitch.checked = !!state.customTargetsEnabled;

    renderDashboard();
    populateSubjectSelects();
    updateDayHolidayBadges();

    // Cloud & Offline Backup Sync
    if (state.user) {
      const exportData = {
        subjects: state.subjects,
        timetable: state.timetable,
        attendanceData: state.attendanceData, // Full attendance state
        periodAttendance: state.periodAttendanceRecords,
        tasks: state.tasks,
        labs: state.labs,
        studyPlans: state.studyPlans,
        studySessions: state.studySessions,
        vaultFolders: state.vaultFolders,
        vaultFiles: state.vaultFiles,
        calendarEvents: state.calendarEvents
      };
      
      if (window.FirebaseSync && window.FirebaseSync.isAvailable()) {
        window.FirebaseSync.syncUserData(state.user.id, exportData);
      }
      
      // Offline Local Storage Backup
      localStorage.setItem(`college_os_backup_${state.user.email}`, JSON.stringify(exportData));
    }
  } catch (err) {
    console.error('Error refreshing workspace data:', err);
  }
}

// -------------------------------------------------------------
// 1. DASHBOARD RENDERER
// -------------------------------------------------------------

function renderDashboard() {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const dateEl = document.getElementById('dash-date-str');
  if (dateEl) dateEl.textContent = dateStr;

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const classesToday = state.timetable.filter(s => s.day.toLowerCase() === todayName.toLowerCase());
  const classesToShow = classesToday.length > 0 ? classesToday : state.timetable.filter(s => s.day === 'Monday');

  const classesMetric = document.getElementById('metric-classes-today');
  if (classesMetric) classesMetric.textContent = classesToShow.length;

  if (state.attendanceData && state.attendanceData.overall) {
    const ov = state.attendanceData.overall;
    const attPctEl = document.getElementById('metric-attendance-pct');
    if (attPctEl) attPctEl.textContent = `${ov.percentage}%`;
    const attRatioEl = document.getElementById('metric-attendance-ratio');
    if (attRatioEl) attRatioEl.textContent = `${ov.attended} / ${ov.total} hours attended`;
  }

  const pendingTasks = state.tasks.filter(t => t.status !== 'Completed');
  const taskMetric = document.getElementById('metric-pending-tasks');
  if (taskMetric) taskMetric.textContent = pendingTasks.length;

  if (classesToShow.length > 0) {
    const nextClass = classesToShow[0];
    const nName = document.getElementById('next-class-name');
    if (nName) nName.textContent = nextClass.subjectName;
    const nRoom = document.getElementById('next-class-room');
    if (nRoom) nRoom.textContent = `(${nextClass.classroom})`;
    const nProf = document.getElementById('next-class-prof');
    if (nProf) nProf.textContent = nextClass.faculty;
  }

  // Today's timeline on dashboard
  const timelineEl = document.getElementById('dash-timeline-list');
  if (timelineEl) {
    if (classesToShow.length === 0) {
      timelineEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-inter">No scheduled classes for today. Great time for independent deep work!</div>`;
    } else {
      timelineEl.innerHTML = classesToShow.map(cls => `
        <div class="p-4 rounded-2xl theme-subtle border theme-border flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-1.5 h-10 rounded-full" style="background: ${cls.color || '#1D4ED8'}"></div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold">${cls.subjectCode}: ${cls.subjectName}</span>
                <span class="text-[10px] theme-card border theme-border px-2 py-0.5 rounded-md font-semibold">${cls.classroom}</span>
              </div>
              <div class="text-[11px] text-slate-500 font-inter mt-0.5">
                ${cls.startTime} - ${cls.endTime} • ${cls.faculty}
              </div>
            </div>
          </div>
          <button onclick="navigateTo('timetable')" class="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200 text-xs font-bold font-inter">
            Daily Sheet →
          </button>
        </div>
      `).join('');
    }
  }

  // Attendance summary on dashboard
  const attSummaryEl = document.getElementById('dash-attendance-summary');
  if (attSummaryEl && state.attendanceData && state.attendanceData.subjects) {
    if (state.attendanceData.subjects.length === 0) {
      attSummaryEl.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 font-inter">No attendance records yet. Add timetable classes to begin tracking.</div>`;
    } else {
      attSummaryEl.innerHTML = state.attendanceData.subjects.slice(0, 4).map(sub => `
        <div class="p-3 rounded-xl theme-subtle border theme-border flex items-center justify-between">
          <div>
            <span class="text-xs font-bold block">${sub.code}: ${sub.name}</span>
            <span class="text-[10px] text-slate-500">${sub.attended}/${sub.total} hours</span>
          </div>
          <div class="text-right font-inter">
            <span class="text-xs font-extrabold ${sub.isAtRisk ? 'text-red-600' : 'text-emerald-600'}">${sub.percentage}%</span>
            <span class="text-[10px] block ${sub.isAtRisk ? 'text-red-500 font-bold' : 'text-slate-500'}">
              ${sub.isAtRisk ? `Need ${sub.neededToReach} hrs` : `Safe: ${sub.safeToSkip} hrs`}
            </span>
          </div>
        </div>
      `).join('');
    }
  }

  // Urgent tasks on dashboard
  const taskSummaryEl = document.getElementById('dash-tasks-summary');
  if (taskSummaryEl) {
    const topTasks = pendingTasks.slice(0, 3);
    if (topTasks.length === 0) {
      taskSummaryEl.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 font-inter">All deliverables up to date! 🎉</div>`;
    } else {
      taskSummaryEl.innerHTML = topTasks.map(t => `
        <div class="p-3 rounded-xl theme-subtle border theme-border flex items-center justify-between">
          <span class="text-xs font-semibold truncate max-w-[200px]">${t.title}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${t.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'}">
            Due ${t.dueDate}
          </span>
        </div>
      `).join('');
    }
  }
}

// -------------------------------------------------------------
// 2. TIMETABLE & ATTENDANCE CONTROLLER
// -------------------------------------------------------------

function switchTimetableSubTab(tabId, btn) {
  ['daily-sheet', 'week-matrix', 'analytics-report'].forEach(id => {
    const el = document.getElementById(`subtab-${id}`);
    if (el) el.classList.toggle('hidden', id !== tabId);
  });
  document.querySelectorAll('.tt-subtab-btn').forEach(b => {
    b.className = 'tt-subtab-btn px-4 py-2 rounded-xl theme-card border theme-border hover:bg-slate-100 dark:hover:bg-slate-800';
  });
  btn.className = 'tt-subtab-btn px-4 py-2 rounded-xl bg-blue-600 text-white shadow-xs';

  if (tabId === 'daily-sheet') renderDailyAttendanceSheet();
  if (tabId === 'week-matrix') renderTimetableMatrix();
  if (tabId === 'analytics-report') renderAttendanceAnalytics();
}

function selectDailySheetDay(day, btn) {
  state.selectedSheetDay = day;
  document.querySelectorAll('.sheet-day-btn').forEach(b => {
    b.className = 'sheet-day-btn px-3.5 py-2 rounded-xl text-xs font-bold theme-card border theme-border hover:bg-slate-100 dark:hover:bg-slate-800';
  });
  if (btn) {
    btn.className = 'sheet-day-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-xs';
  }
  document.getElementById('daily-sheet-day-title').textContent = day;
  updateDayHolidayBadges();
  renderDailyAttendanceSheet();
}

function updateDayHolidayBadges() {
  const isSatHoliday = state.holidayDays.includes('Saturday');
  const isSunHoliday = state.holidayDays.includes('Sunday');

  const satBadge = document.getElementById('sat-holiday-badge');
  if (satBadge) satBadge.style.display = isSatHoliday ? 'inline-block' : 'none';

  const sunBadge = document.getElementById('sun-holiday-badge');
  if (sunBadge) sunBadge.style.display = isSunHoliday ? 'inline-block' : 'none';

  const isCurrentDayHoliday = state.holidayDays.includes(state.selectedSheetDay);
  const holidayLabel = document.getElementById('btn-holiday-label');
  if (holidayLabel) {
    holidayLabel.textContent = isCurrentDayHoliday ? 'Unmark Holiday' : 'Mark as Holiday';
  }
}

async function toggleActiveDayHoliday() {
  const day = state.selectedSheetDay;
  const res = await API.toggleHolidayDay(day);
  state.holidayDays = res.holidayDays || [];
  updateDayHolidayBadges();
  renderDailyAttendanceSheet();
}

async function confirmClearTimetable() {
  const confirmed = confirm('⚠️ Clear Timetable & Attendance:\n\nThis will remove all class timetable slots and their associated period attendance marks. Are you sure?');
  if (!confirmed) return;

  await API.clearTimetableAll();
  state.timetable = [];
  state.periodAttendanceRecords = {};
  state.attendanceData = await API.getAttendance();
  renderDailyAttendanceSheet();
  renderTimetableMatrix();
  renderAttendanceAnalytics();
  renderDashboard();
  alert('Timetable and period attendance cleared.');
}

function renderDailyAttendanceSheet() {
  const container = document.getElementById('daily-sheet-subject-rows');
  if (!container) return;

  const day = state.selectedSheetDay;
  const isHoliday = state.holidayDays.includes(day);
  const slotsForDay = state.timetable.filter(s => s.day.toLowerCase() === day.toLowerCase());

  let holidayBanner = '';
  if (isHoliday) {
    holidayBanner = `
      <div class="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-center justify-between text-xs font-inter mb-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">beach_access</span>
          <span><strong>${day} is marked as a Holiday.</strong> No regular attendance required. You can still add extra sessions and mark attendance if classes occurred.</span>
        </div>
      </div>
    `;
  }

  if (slotsForDay.length === 0) {
    container.innerHTML = `
      ${holidayBanner}
      <div class="p-8 text-center text-xs text-slate-400 font-inter">
        No class periods scheduled for ${day}. Click "Add Class / Hours" above to schedule.
      </div>
    `;
    return;
  }

  // Group slots by subject to produce the exact representation specified:
  // e.g.:
  // Monday:
  // chemistry 3 hours: 1st [] 2nd [] 3rd []
  // electronics: []
  // electrical: []
  const grouped = {};
  slotsForDay.forEach(slot => {
    if (!grouped[slot.subjectId]) {
      grouped[slot.subjectId] = {
        subjectId: slot.subjectId,
        subjectCode: slot.subjectCode,
        subjectName: slot.subjectName,
        classroom: slot.classroom,
        faculty: slot.faculty,
        color: slot.color,
        slots: []
      };
    }
    grouped[slot.subjectId].slots.push(slot);
  });

  const dayKey = state.selectedSheetDay;

  container.innerHTML = holidayBanner + Object.values(grouped).map(group => {
    const hoursCount = group.slots.length;
    const attendedCount = group.slots.filter((s, idx) => {
      const slotKey = `${dayKey}_${group.subjectId}_period_${idx + 1}`;
      return state.periodAttendanceRecords[slotKey] === 'Present';
    }).length;

    return `
      <div class="p-5 rounded-2xl theme-subtle border theme-border flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-blue-500/40">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="w-3.5 h-3.5 rounded-full ring-2 ring-white/20" style="background: ${group.color || '#2563EB'}"></span>
            <h3 class="text-sm font-extrabold">${group.subjectCode}: ${group.subjectName}</h3>
            ${hoursCount > 1 ? `
              <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                ${hoursCount} hours
              </span>
            ` : `
              <span class="text-[11px] font-medium text-slate-500 font-inter">1 hr</span>
            `}
          </div>
          <div class="text-xs text-slate-500 font-inter mt-1.5 flex items-center gap-3">
            <span>📍 ${group.classroom}</span>
            <span>👤 ${group.faculty}</span>
            <span class="text-blue-600 dark:text-blue-400 font-bold">${attendedCount} of ${hoursCount} attended</span>
          </div>
        </div>

        <!-- Period Action Buttons: e.g. Chemistry 3 hours: 1st [✓][✕] 2nd [✓][✕] 3rd [✓][✕] -->
        <div class="flex flex-wrap items-center gap-3">
          ${group.slots.map((s, idx) => {
            const periodNum = idx + 1;
            const slotKey = `${dayKey}_${group.subjectId}_period_${periodNum}`;
            const status = state.periodAttendanceRecords[slotKey]; // 'Present', 'Absent', or undefined
            const isPresent = status === 'Present';
            const isAbsent = status === 'Absent';
            const labelText = hoursCount > 1 ? `${periodNum}${getOrdinal(periodNum)} Hr` : 'Class';

            return `
              <div class="p-1.5 rounded-xl border theme-border theme-card flex items-center gap-1.5 shadow-2xs">
                <span class="text-[11px] font-bold font-inter text-slate-500 px-1.5">${labelText}</span>
                <button onclick="markPeriodStatus('${group.subjectId}', ${periodNum}, true)" title="Mark Present" class="px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  isPresent 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'theme-subtle text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/40'
                }">
                  <span>✓</span>
                  <span class="hidden sm:inline">Present</span>
                </button>
                <button onclick="markPeriodStatus('${group.subjectId}', ${periodNum}, false)" title="Mark Absent" class="px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  isAbsent 
                    ? 'bg-red-600 text-white shadow-xs' 
                    : 'theme-subtle text-slate-600 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-950/40'
                }">
                  <span>✕</span>
                  <span class="hidden sm:inline">Absent</span>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function getOrdinal(n) {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

async function markPeriodStatus(subjectId, periodNumber, isPresent) {
  const dayKey = state.selectedSheetDay;
  const slotKey = `${dayKey}_${subjectId}_period_${periodNumber}`;
  state.periodAttendanceRecords[slotKey] = isPresent ? 'Present' : 'Absent';

  await API.markPeriod({ subjectId, date: dayKey, periodNumber, isPresent });

  // Refresh attendance statistics in real-time
  state.attendanceData = await API.getAttendance();
  renderDailyAttendanceSheet();
  renderDashboard();
}

async function markAllPeriodsForDay(present) {
  const day = state.selectedSheetDay;
  const slotsForDay = state.timetable.filter(s => s.day.toLowerCase() === day.toLowerCase());

  const grouped = {};
  slotsForDay.forEach(slot => {
    if (!grouped[slot.subjectId]) grouped[slot.subjectId] = [];
    grouped[slot.subjectId].push(slot);
  });

  for (const [subjectId, subjectSlots] of Object.entries(grouped)) {
    for (let periodNum = 1; periodNum <= subjectSlots.length; periodNum++) {
      const slotKey = `${day}_${subjectId}_period_${periodNum}`;
      state.periodAttendanceRecords[slotKey] = present ? 'Present' : 'Absent';
      await API.markPeriod({ subjectId, date: day, periodNumber: periodNum, isPresent: present });
    }
  }

  state.attendanceData = await API.getAttendance();
  renderDailyAttendanceSheet();
  renderDashboard();
}

function renderTimetableMatrix() {
  const container = document.getElementById('timetable-cards-container');
  if (!container) return;

  if (state.timetable.length === 0) {
    container.innerHTML = `<div class="col-span-3 p-8 text-center text-xs text-slate-400 font-inter">No classes in timetable. Click "Add Class / Hours" above to begin scheduling.</div>`;
    return;
  }

  container.innerHTML = state.timetable.map(s => `
    <div class="p-5 rounded-2xl theme-card border theme-border shadow-xs flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 uppercase">${s.day}</span>
          <button onclick="deleteTimetableSlot('${s.id}')" title="Delete class slot" class="text-slate-400 hover:text-red-500 text-xs px-2 py-1">✕</button>
        </div>
        <h3 class="text-sm font-bold">${s.subjectCode}: ${s.subjectName}</h3>
        <p class="text-xs text-slate-500 font-inter mt-1">${s.faculty}</p>
      </div>
      <div class="mt-4 pt-3 border-t theme-border flex items-center justify-between text-xs font-inter font-semibold">
        <span class="text-blue-600">${s.startTime} - ${s.endTime}</span>
        <span class="text-slate-500">${s.classroom}</span>
      </div>
    </div>
  `).join('');
}

async function deleteTimetableSlot(id) {
  if (!confirm('Delete this class slot?')) return;
  await API.deleteTimetableSlot(id);
  state.timetable = state.timetable.filter(s => s.id !== id);
  renderTimetableMatrix();
  renderDailyAttendanceSheet();
  renderDashboard();
}

function renderAttendanceAnalytics() {
  const grid = document.getElementById('attendance-subjects-grid');
  if (!grid || !state.attendanceData) return;

  const subjects = state.attendanceData.subjects || [];
  if (subjects.length === 0) {
    grid.innerHTML = `<div class="col-span-3 p-8 text-center text-xs text-slate-400 font-inter">No subject attendance recorded yet. Schedule classes to view analytics.</div>`;
    return;
  }

  grid.innerHTML = subjects.map(s => `
    <div class="p-6 rounded-3xl theme-card border theme-border shadow-xs flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">${s.code}</span>
          <span class="text-xs font-inter text-slate-500">Target: ${s.target}%</span>
        </div>
        <h3 class="text-base font-bold">${s.name}</h3>

        <div class="my-4 flex items-baseline justify-between">
          <div class="text-4xl font-extrabold ${s.isAtRisk ? 'text-red-600' : 'text-emerald-600'} font-inter">
            ${s.percentage}%
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full ${s.isAtRisk ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'}">
            ${s.isAtRisk ? '⚠️ Under Target' : '✓ Safe'}
          </span>
        </div>

        <div class="p-3 rounded-xl ${s.isAtRisk ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'} text-xs font-inter font-semibold mb-3">
          ${s.isAtRisk
            ? `Must attend <strong>${s.neededToReach} upcoming hours</strong> to reach ${s.target}%`
            : `Safe to miss <strong>${s.safeToSkip} upcoming hours</strong>`}
        </div>

        <div class="text-xs text-slate-500 font-inter mb-3">
          Attended: ${s.attended} / ${s.total} hours
        </div>

        ${state.customTargetsEnabled ? `
          <div class="p-2.5 rounded-xl theme-subtle border theme-border flex items-center justify-between gap-2 mb-3">
            <span class="text-[11px] font-bold text-slate-500">Custom Target:</span>
            <div class="flex items-center gap-1.5">
              <input type="number" id="custom-target-input-${s.id}" min="50" max="100" value="${s.target}" class="w-14 h-7 text-xs text-center rounded-lg border theme-border theme-card font-bold outline-none">
              <span class="text-[11px] font-bold">%</span>
              <button onclick="updateSubjectTarget('${s.id}')" class="px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold">Set</button>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="pt-3 border-t theme-border flex items-center justify-between">
        <button onclick="openSubjectHistoryModal('${s.id}')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
          <span>View Class History</span>
          <span>→</span>
        </button>
      </div>
    </div>
  `).join('');
}

async function updateSubjectTarget(subjectId) {
  const input = document.getElementById(`custom-target-input-${subjectId}`);
  if (!input) return;
  const newTarget = Number(input.value) || 75;
  await API.updateSubject(subjectId, { targetAttendance: newTarget });
  state.attendanceData = await API.getAttendance();
  renderAttendanceAnalytics();
  renderDashboard();
}

// Subject Attendance Drill-Down History Modal
async function openSubjectHistoryModal(subjectId) {
  const sub = (state.attendanceData?.subjects || []).find(s => s.id === subjectId) || state.subjects.find(s => s.id === subjectId);
  if (!sub) return;

  const titleEl = document.getElementById('hist-modal-title');
  if (titleEl) titleEl.textContent = `${sub.code}: ${sub.name}`;

  const pctEl = document.getElementById('hist-modal-stat-pct');
  if (pctEl) pctEl.textContent = `${sub.percentage || 0}%`;

  const ratioEl = document.getElementById('hist-modal-stat-ratio');
  if (ratioEl) ratioEl.textContent = `${sub.attended || 0} / ${sub.total || 0} hours attended`;

  const listEl = document.getElementById('hist-modal-records-list');
  if (listEl) {
    listEl.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">Loading history...</div>`;
  }

  const modal = document.getElementById('modal-subject-history');
  if (modal) modal.classList.remove('hidden');

  try {
    const res = await API.getSubjectHistory(subjectId);
    const records = res.history || [];

    if (!listEl) return;

    if (records.length === 0) {
      listEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-inter">No recorded attendance history for this course yet.</div>`;
      return;
    }

    listEl.innerHTML = records.map(rec => `
      <div class="p-3 rounded-xl theme-subtle border theme-border flex items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-xs">${rec.date} (${rec.dayOfWeek || 'Scheduled'})</span>
            <span class="text-[10px] theme-card border theme-border px-1.5 py-0.5 rounded font-mono font-semibold">Period ${rec.periodNumber}</span>
          </div>
          <span class="text-[10px] text-slate-500 font-inter">Status: <strong>${rec.status}</strong></span>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
            rec.status === 'Present' 
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' 
              : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200'
          }">
            ${rec.status}
          </span>
          <button onclick="toggleHistoryRecordStatus('${rec.id}', '${rec.status === 'Present' ? 'Absent' : 'Present'}', '${subjectId}')" class="px-2.5 py-1 rounded-lg theme-card border theme-border text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Switch to ${rec.status === 'Present' ? 'Absent' : 'Present'}
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    if (listEl) listEl.innerHTML = `<div class="p-4 text-center text-xs text-red-500">Failed to load history: ${err.message}</div>`;
  }
}

async function toggleHistoryRecordStatus(recordId, newStatus, subjectId) {
  await API.updateHistoryRecord(recordId, newStatus);
  state.attendanceData = await API.getAttendance();
  await openSubjectHistoryModal(subjectId);
  renderDailyAttendanceSheet();
  renderDashboard();
}

async function saveAttendanceTargetSettings() {
  const globalTarget = Number(document.getElementById('pref-global-target')?.value) || 75;
  const customEnabled = document.getElementById('pref-custom-target-switch')?.checked || false;

  await API.setAttendanceTargetSettings({
    defaultTarget: globalTarget,
    customTargetsEnabled: customEnabled
  });

  state.defaultAttendanceTarget = globalTarget;
  state.customTargetsEnabled = customEnabled;
  state.attendanceData = await API.getAttendance();
  renderAttendanceAnalytics();
  renderDashboard();
  alert('Attendance target policy updated successfully.');
}

async function toggleCustomTargetsSwitch(checked) {
  state.customTargetsEnabled = checked;
  await API.setAttendanceTargetSettings({ customTargetsEnabled: checked });
  renderAttendanceAnalytics();
}

// -------------------------------------------------------------
// 3. LABS & COLLEGE WORKS CONTROLLER (WITH DELETE & FULLSCREEN)
// -------------------------------------------------------------

function renderLabsAndWorks() {
  renderTasks();
  renderLabs();
  renderStudyPlanner();
}

function switchWorksSubTab(tabId, btn) {
  ['works-tasks', 'labs-experiments', 'study-planner-timer'].forEach(id => {
    const el = document.getElementById(`subtab-${id}`);
    if (el) el.classList.toggle('hidden', id !== tabId);
  });
  document.querySelectorAll('.works-subtab-btn').forEach(b => {
    b.className = 'works-subtab-btn px-4 py-2 rounded-xl theme-card border theme-border hover:bg-slate-100 dark:hover:bg-slate-800';
  });
  btn.className = 'works-subtab-btn px-4 py-2 rounded-xl bg-blue-600 text-white shadow-xs';

  if (tabId === 'works-tasks') renderTasks();
  if (tabId === 'labs-experiments') renderLabs();
  if (tabId === 'study-planner-timer') renderStudyPlanner();
}

function filterTasks(status, btn) {
  state.selectedTaskFilter = status;
  document.querySelectorAll('.task-filter-btn').forEach(b => {
    b.className = 'task-filter-btn px-3.5 py-1.5 rounded-xl font-bold theme-card border theme-border hover:bg-slate-100 dark:hover:bg-slate-800';
  });
  btn.className = 'task-filter-btn px-3.5 py-1.5 rounded-xl font-bold bg-blue-600 text-white shadow-xs';
  renderTasks();
}

function renderTasks() {
  const container = document.getElementById('tasks-list-container');
  if (!container) return;

  let tasks = state.tasks;
  if (state.selectedTaskFilter !== 'All') {
    tasks = tasks.filter(t => t.status === state.selectedTaskFilter);
  }

  if (tasks.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-xs text-slate-400 font-inter">No college works in this filter. Add one above!</div>`;
    return;
  }

  container.innerHTML = tasks.map(t => `
    <div class="p-4 rounded-2xl theme-card border theme-border shadow-xs flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <input type="checkbox" ${t.status === 'Completed' ? 'checked' : ''} onchange="toggleTaskStatus('${t.id}')" class="w-5 h-5 rounded text-blue-600 cursor-pointer accent-blue-600">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold ${t.status === 'Completed' ? 'line-through text-slate-400' : ''}">${t.title}</span>
            <span class="text-[10px] theme-subtle px-2 py-0.5 rounded-full font-semibold">${t.type}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${t.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'}">
              ${t.priority}
            </span>
          </div>
          <div class="text-[11px] text-slate-500 font-inter mt-0.5">
            ${t.subjectCode} • Scheduled Due: ${t.dueDate}
          </div>
        </div>
      </div>

      <!-- Working Delete Option for College Work -->
      <button onclick="deleteTask('${t.id}')" title="Delete College Work" class="text-slate-400 hover:text-red-500 text-xs px-2.5 py-1.5 rounded-lg border theme-border hover:bg-red-50 dark:hover:bg-red-950/40 transition">
        Delete
      </button>
    </div>
  `).join('');
}

async function toggleTaskStatus(id) {
  await API.toggleTask(id);
  const task = state.tasks.find(t => t.id === id);
  if (task) task.status = task.status === 'Completed' ? 'Pending' : 'Completed';
  renderTasks();
  renderDashboard();
}

async function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this college work?')) return;
  await API.deleteTask(id);
  state.tasks = state.tasks.filter(t => t.id !== id);
  renderTasks();
  renderDashboard();
}

function renderLabs() {
  const container = document.getElementById('labs-list-container');
  if (!container) return;

  if (state.labs.length === 0) {
    container.innerHTML = `<div class="col-span-3 p-8 text-center text-xs text-slate-400 font-inter">No laboratory experiments logged. Click "Add Lab Session" above.</div>`;
    return;
  }

  container.innerHTML = state.labs.map(l => `
    <div class="p-6 rounded-3xl theme-card border theme-border shadow-xs flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200 px-2 py-0.5 rounded-full uppercase">${l.subjectCode}</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full ${l.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${l.status}</span>
        </div>
        <h3 class="text-sm font-bold mt-1">${l.title}</h3>
        <p class="text-xs text-slate-500 font-inter mt-1">${l.description || 'Practical experiment'}</p>
      </div>

      <div class="mt-4 pt-3 border-t theme-border flex items-center justify-between text-xs font-inter">
        <span class="text-slate-500">Sign-off: <strong>${l.recordStatus || 'Pending'}</strong></span>
        <!-- Working Delete Option for Lab Experiment -->
        <button onclick="deleteLab('${l.id}')" title="Delete Lab Record" class="text-red-600 hover:underline font-bold">
          Delete
        </button>
      </div>
    </div>
  `).join('');
}

async function deleteLab(id) {
  if (!confirm('Delete this laboratory record?')) return;
  await API.deleteLab(id);
  state.labs = state.labs.filter(l => l.id !== id);
  renderLabs();
}

function renderStudyPlanner() {
  // Render Study Planner custom tasks with Delete option
  const planList = document.getElementById('study-plans-list');
  if (planList) {
    if (state.studyPlans.length === 0) {
      planList.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 font-inter">No scheduled study tasks. Click "Add Study Task" above.</div>`;
    } else {
      planList.innerHTML = state.studyPlans.map(p => `
        <div class="p-3 rounded-2xl theme-subtle border theme-border flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
            <div>
              <span class="text-xs font-bold block">${p.title}</span>
              <span class="text-[10px] text-slate-500 font-inter">${p.targetMinutes} mins target • Scheduled for ${p.date}</span>
            </div>
          </div>
          <button onclick="deleteStudyPlan('${p.id}')" class="text-slate-400 hover:text-red-500 text-xs px-2 py-1">Delete</button>
        </div>
      `).join('');
    }
  }

  // Render Study Sessions Log with Delete option
  const sessionList = document.getElementById('study-sessions-list');
  if (sessionList) {
    if (state.studySessions.length === 0) {
      sessionList.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 font-inter">No recent study sessions. Launch the Focus Room to begin!</div>`;
    } else {
      sessionList.innerHTML = state.studySessions.map(s => `
        <div class="p-3 rounded-2xl theme-subtle border theme-border flex items-center justify-between">
          <div>
            <span class="text-xs font-bold block">${s.notes}</span>
            <span class="text-[10px] text-slate-500 font-inter">${s.date} • ${s.durationMinutes} mins completed</span>
          </div>
          <button onclick="deleteStudySession('${s.id}')" class="text-slate-400 hover:text-red-500 text-xs px-2 py-1">Delete</button>
        </div>
      `).join('');
    }
  }
}

async function deleteStudyPlan(id) {
  await API.deleteStudyPlan(id);
  state.studyPlans = state.studyPlans.filter(p => p.id !== id);
  renderStudyPlanner();
}

async function deleteStudySession(id) {
  await API.deleteStudySession(id);
  state.studySessions = state.studySessions.filter(s => s.id !== id);
  renderStudyPlanner();
}

async function clearAllStudyLogs() {
  if (!confirm('Clear all study history logs?')) return;
  await API.clearAllStudySessions();
  state.studySessions = [];
  renderStudyPlanner();
}

// Fullscreen Focus Room Controller
function openFullscreenStudyTimer() {
  const room = document.getElementById('fullscreen-study-room');
  if (room) {
    room.classList.remove('hidden');
    room.classList.add('flex');
  }

  // Request native browser fullscreen if supported
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

function closeFullscreenStudyTimer() {
  const room = document.getElementById('fullscreen-study-room');
  if (room && !room.classList.contains('hidden')) {
    room.classList.add('hidden');
    room.classList.remove('flex');
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

function setTimerDuration(minutes, btn) {
  if (state.timer.isRunning) return;
  state.timer.totalSeconds = minutes * 60;
  state.timer.secondsLeft = minutes * 60;
  updateTimerDisplay();

  document.querySelectorAll('.timer-mode-btn').forEach(b => {
    b.className = 'timer-mode-btn px-3.5 py-1 rounded-full text-xs font-bold theme-subtle text-slate-600 dark:text-slate-300';
  });
  if (btn) {
    btn.className = 'timer-mode-btn px-3.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white';
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(state.timer.secondsLeft / 60);
  const secs = state.timer.secondsLeft % 60;
  const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const el = document.getElementById('timer-display');
  if (el) el.textContent = str;

  const fsEl = document.getElementById('fs-timer-display');
  if (fsEl) fsEl.textContent = str;
}

function toggleStudyTimer() {
  const btn = document.getElementById('btn-start-timer');
  const fsBtn = document.getElementById('fs-btn-start');

  if (state.timer.isRunning) {
    clearInterval(state.timer.intervalId);
    state.timer.isRunning = false;
    const txt = `<span class="material-symbols-outlined text-[18px]">play_arrow</span><span>Resume</span>`;
    if (btn) btn.innerHTML = txt;
    if (fsBtn) fsBtn.innerHTML = txt;
  } else {
    state.timer.isRunning = true;
    const txt = `<span class="material-symbols-outlined text-[18px]">pause</span><span>Pause</span>`;
    if (btn) btn.innerHTML = txt;
    if (fsBtn) fsBtn.innerHTML = txt;

    state.timer.intervalId = setInterval(async () => {
      if (state.timer.secondsLeft > 0) {
        state.timer.secondsLeft--;
        updateTimerDisplay();
      } else {
        clearInterval(state.timer.intervalId);
        state.timer.isRunning = false;
        alert('🎉 Focus Session Completed! Logged to your workspace.');

        const duration = Math.round(state.timer.totalSeconds / 60);
        await API.logStudySession({ durationMinutes: duration, notes: 'Completed Focus Session' });
        state.studySessions = (await API.getStudySessions()).sessions || [];
        renderStudyPlanner();
        renderDashboard();
      }
    }, 1000);
  }
}

function resetStudyTimer() {
  clearInterval(state.timer.intervalId);
  state.timer.isRunning = false;
  state.timer.secondsLeft = state.timer.totalSeconds;
  updateTimerDisplay();
  const btn = document.getElementById('btn-start-timer');
  if (btn) btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">play_arrow</span><span>Start</span>`;
  const fsBtn = document.getElementById('fs-btn-start');
  if (fsBtn) fsBtn.innerHTML = `<span class="material-symbols-outlined text-[22px]">play_arrow</span><span>Start Focus Timer</span>`;
}

// -------------------------------------------------------------
// 4. VAULT CONTROLLER
// -------------------------------------------------------------

function renderVault() {
  const fldGrid = document.getElementById('vault-folders-grid');
  if (fldGrid) {
    fldGrid.innerHTML = state.vaultFolders.map(f => `
      <div onclick="selectVaultFolder('${f.id}')" class="p-4 rounded-2xl theme-card border theme-border hover:border-blue-500 cursor-pointer transition flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200 flex items-center justify-center">
          <span class="material-symbols-outlined text-[22px]">${f.icon || 'folder'}</span>
        </div>
        <div class="truncate">
          <span class="text-xs font-bold truncate block">${f.name}</span>
          <span class="text-[10px] text-slate-500 font-inter">Folder</span>
        </div>
      </div>
    `).join('');
  }
  loadVaultFiles(state.isTrashView);
}

async function selectVaultFolder(folderId) {
  state.activeFolderId = folderId;
  const res = await API.getFiles({ folderId });
  state.vaultFiles = res.files || [];
  loadVaultFiles(false);
}

async function loadVaultFiles(isTrash = false) {
  state.isTrashView = isTrash;
  const res = await API.getFiles({ trash: isTrash, folderId: state.activeFolderId });
  state.vaultFiles = res.files || [];

  const tabActive = document.getElementById('tab-active-files');
  const tabTrash = document.getElementById('tab-trash-files');
  if (tabActive && tabTrash) {
    if (isTrash) {
      tabTrash.className = 'px-3 py-1 rounded-lg bg-blue-600 text-white';
      tabActive.className = 'px-3 py-1 rounded-lg theme-subtle hover:opacity-80';
    } else {
      tabActive.className = 'px-3 py-1 rounded-lg bg-blue-600 text-white';
      tabTrash.className = 'px-3 py-1 rounded-lg theme-subtle hover:opacity-80';
    }
  }

  const list = document.getElementById('vault-files-list');
  if (!list) return;

  if (state.vaultFiles.length === 0) {
    list.innerHTML = `<div class="p-8 text-center text-xs text-slate-400 font-inter">${isTrash ? 'Trash bin is empty.' : 'No files in this folder. Upload or scan notes above.'}</div>`;
    return;
  }

  list.innerHTML = state.vaultFiles.map(f => `
    <div class="py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-blue-600 text-[24px]">description</span>
        <div>
          <a href="${f.url}" target="_blank" class="text-xs font-bold hover:text-blue-600 block">${f.name}</a>
          <span class="text-[10px] text-slate-500 font-inter">${f.size} • Uploaded ${f.uploadDate}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <a href="${f.url}" download="${f.name}" class="px-2.5 py-1 rounded-lg theme-subtle text-xs font-bold">Download</a>
        ${isTrash ? `
          <button onclick="restoreVaultFile('${f.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">Restore</button>
          <button onclick="deleteVaultFile('${f.id}', true)" class="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold">Wipe</button>
        ` : `
          <button onclick="deleteVaultFile('${f.id}', false)" class="text-slate-400 hover:text-red-500 text-xs px-2 py-1">Delete</button>
        `}
      </div>
    </div>
  `).join('');
}

async function deleteVaultFile(id, permanent = false) {
  await API.deleteFile(id, permanent);
  loadVaultFiles(state.isTrashView);
}

async function restoreVaultFile(id) {
  await API.restoreFile(id);
  loadVaultFiles(true);
}

// -------------------------------------------------------------
// 5. PROFILE & SETTINGS CONTROLLER
// -------------------------------------------------------------

function switchSettingsSubTab(tabId, btn) {
  ['student-profile', 'grade-calculator', 'unified-calendar', 'preferences-reset'].forEach(id => {
    const el = document.getElementById(`subtab-${id}`);
    if (el) el.classList.toggle('hidden', id !== tabId);
  });
  document.querySelectorAll('.settings-subtab-btn').forEach(b => {
    b.className = 'settings-subtab-btn px-4 py-2 rounded-xl theme-card border theme-border hover:bg-slate-100 dark:hover:bg-slate-800';
  });
  btn.className = 'settings-subtab-btn px-4 py-2 rounded-xl bg-blue-600 text-white shadow-xs';

  if (tabId === 'grade-calculator') renderGradeCalculator();
  if (tabId === 'unified-calendar') {
    renderCalendar();
  }
}

function renderSettings() {
  renderUserProfile(state.user);
}

function renderGradeCalculator() {
  const container = document.getElementById('sgpa-calculator-rows');
  if (!container || container.children.length > 0) return;

  const list = state.subjects.length > 0 ? state.subjects : [
    { code: 'CS 501', name: 'Database Engineering', credits: 4 },
    { code: 'CS 502', name: 'Operating Systems', credits: 4 },
    { code: 'CS 503', name: 'Software Engineering', credits: 3 },
    { code: 'CS 504', name: 'Theory of Computation', credits: 3 }
  ];

  container.innerHTML = list.map(s => `
    <div class="course-calc-row grid grid-cols-12 gap-2 items-center theme-subtle p-2 rounded-xl">
      <input type="text" value="${s.code}: ${s.name}" class="col-span-6 theme-card px-2 py-1.5 rounded-lg border theme-border outline-none text-xs">
      <select class="calc-credits col-span-3 theme-card px-2 py-1.5 rounded-lg border theme-border text-xs">
        <option value="4" ${s.credits === 4 ? 'selected' : ''}>4 Credits</option>
        <option value="3" ${s.credits === 3 ? 'selected' : ''}>3 Credits</option>
        <option value="2" ${s.credits === 2 ? 'selected' : ''}>2 Credits</option>
      </select>
      <select class="calc-grade col-span-3 theme-card px-2 py-1.5 rounded-lg border theme-border text-xs font-bold text-blue-600">
        <option value="10">A+ (10)</option>
        <option value="9" selected>A (9)</option>
        <option value="8">B+ (8)</option>
        <option value="7">B (7)</option>
      </select>
    </div>
  `).join('');
}

function addCourseToSgpaCalc() {
  const container = document.getElementById('sgpa-calculator-rows');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'course-calc-row grid grid-cols-12 gap-2 items-center theme-subtle p-2 rounded-xl';
  row.innerHTML = `
    <input type="text" placeholder="Course Name" class="col-span-6 theme-card px-2 py-1.5 rounded-lg border theme-border outline-none text-xs">
    <select class="calc-credits col-span-3 theme-card px-2 py-1.5 rounded-lg border theme-border text-xs">
      <option value="4">4 Credits</option>
      <option value="3" selected>3 Credits</option>
      <option value="2">2 Credits</option>
    </select>
    <select class="calc-grade col-span-3 theme-card px-2 py-1.5 rounded-lg border theme-border text-xs font-bold text-blue-600">
      <option value="10">A+ (10)</option>
      <option value="9" selected>A (9)</option>
      <option value="8">B+ (8)</option>
    </select>
  `;
  container.appendChild(row);
}

function calculateAndDisplaySgpa() {
  const rows = document.querySelectorAll('.course-calc-row');
  let totalPts = 0;
  let totalCr = 0;
  rows.forEach(r => {
    const c = Number(r.querySelector('.calc-credits').value) || 0;
    const g = Number(r.querySelector('.calc-grade').value) || 0;
    totalPts += c * g;
    totalCr += c;
  });
  const sgpa = totalCr > 0 ? (totalPts / totalCr).toFixed(2) : '0.00';
  document.getElementById('calculated-sgpa-badge').textContent = `${sgpa} SGPA`;
  return sgpa;
}

async function saveCalculatedSgpaToProfile() {
  const sgpaVal = calculateAndDisplaySgpa();
  const rows = document.querySelectorAll('.course-calc-row');
  const courses = [];
  rows.forEach(r => {
    const name = r.querySelector('input').value;
    const credits = Number(r.querySelector('.calc-credits').value) || 3;
    const gradePoint = Number(r.querySelector('.calc-grade').value) || 9;
    courses.push({ name, credits, gradePoint });
  });

  try {
    const res = await API.saveSemesterGrade({
      semester: state.user?.profile?.semester || 'Semester 5',
      sgpa: Number(sgpaVal),
      courses,
      updateProfileCgpa: true
    });

    if (state.user?.profile) {
      state.user.profile.cgpa = res.cumulativeCgpa;
    }
    const topGpa = document.getElementById('top-student-gpa');
    if (topGpa) topGpa.textContent = `${res.cumulativeCgpa} CGPA`;

    const cgpaVal = document.getElementById('grades-cgpa-val');
    if (cgpaVal) cgpaVal.textContent = res.cumulativeCgpa;

    alert(`✅ Semester SGPA (${sgpaVal}) calculated and saved!\nCumulative CGPA updated to ${res.cumulativeCgpa}.`);
  } catch (err) {
    alert('Failed to save CGPA: ' + err.message);
  }
}

// Unified Academic Calendar (Single Active PDF + Events)
function renderCalendarPdfCard() {
  const container = document.getElementById('calendar-pdf-status-container');
  if (!container) return;

  if (state.academicCalendarPdf) {
    const pdf = state.academicCalendarPdf;
    container.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-red-600 text-3xl">picture_as_pdf</span>
          <div>
            <span class="text-xs font-bold block">${pdf.name}</span>
            <span class="text-[10px] text-slate-500 font-inter">Uploaded ${pdf.uploadDate || 'recently'} • ${pdf.size || 'PDF'}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a href="${pdf.url}" target="_blank" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs">
            <span>View PDF</span>
            <span class="material-symbols-outlined text-[16px]">open_in_new</span>
          </a>
          <button onclick="confirmDeleteCalendarPdf()" class="px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950/50 dark:text-red-300 font-bold text-xs transition">
            Delete PDF
          </button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="text-xs font-bold block text-slate-700 dark:text-slate-300">No active academic calendar PDF uploaded</span>
          <span class="text-[11px] text-slate-500 font-inter">Upload your official semester academic calendar PDF (stored in Vault and synchronized).</span>
        </div>
        <label class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0">
          <span class="material-symbols-outlined text-[18px]">upload_file</span>
          <span>Upload Calendar PDF</span>
          <input type="file" accept=".pdf,application/pdf" onchange="handleCalendarPdfUpload(event)" class="hidden">
        </label>
      </div>
    `;
  }
}

async function confirmDeleteCalendarPdf() {
  if (!confirm('Are you sure you want to delete the active academic calendar PDF? You can upload a new one anytime.')) return;
  await API.deleteCalendarPdf();
  state.academicCalendarPdf = null;
  renderCalendarPdfCard();
  alert('Academic calendar PDF deleted.');
}

async function handleCalendarPdfUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('calendarPdf', file);

  try {
    const res = await API.uploadCalendarPdf(formData);
    state.academicCalendarPdf = res.file;
    renderCalendarPdfCard();
    alert('Academic Calendar PDF uploaded successfully!');
  } catch (err) {
    alert('Upload failed: ' + err.message);
  }
}

function renderCalendar() {
  const container = document.getElementById('calendar-events-container');
  if (!container) return;

  if (state.calendarEvents.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-xs text-slate-400 font-inter">No calendar event markers added yet. Click "Add Event Marker" above.</div>`;
    return;
  }

  container.innerHTML = state.calendarEvents.map(e => `
    <div class="p-4 rounded-2xl theme-card border theme-border flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-2 h-10 rounded-full" style="background: ${e.color || '#1D4ED8'}"></div>
        <div>
          <span class="text-xs font-bold block">${e.title}</span>
          <span class="text-[11px] text-slate-500 font-inter">${e.type} • ${e.date || e.dayOfWeek} ${e.time ? '• ' + e.time : ''}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-bold px-2.5 py-1 rounded-full theme-subtle">${e.location || e.status || 'Active'}</span>
        <button onclick="openEditCalendarEventModal('${e.id}')" title="Edit Event" class="text-slate-400 hover:text-blue-500 text-xs px-2 py-1">Edit</button>
        <button onclick="deleteCalendarEvent('${e.id}')" title="Delete Event" class="text-slate-400 hover:text-red-500 text-xs px-2 py-1">Delete</button>
      </div>
    </div>
  `).join('');
}

function openAddCalendarEventModal() {
  document.getElementById('cal-event-input-id').value = '';
  document.getElementById('modal-cal-event-title').textContent = 'Add Academic Event Marker';
  document.getElementById('btn-submit-cal-event').textContent = 'Save Event Marker';
  document.getElementById('cal-event-input-title').value = '';
  document.getElementById('cal-event-input-date').value = '';
  document.getElementById('cal-event-input-type').value = 'Examination';
  document.getElementById('cal-event-input-loc').value = '';
  document.getElementById('modal-calendar-event').classList.remove('hidden');
}

function openEditCalendarEventModal(eventId) {
  const ev = state.calendarEvents.find(e => e.id === eventId);
  if (!ev) return;

  document.getElementById('cal-event-input-id').value = ev.id;
  document.getElementById('modal-cal-event-title').textContent = 'Edit Academic Event Marker';
  document.getElementById('btn-submit-cal-event').textContent = 'Update Event Marker';
  document.getElementById('cal-event-input-title').value = ev.title;
  document.getElementById('cal-event-input-date').value = ev.date;
  document.getElementById('cal-event-input-type').value = ev.type || 'Examination';
  document.getElementById('cal-event-input-loc').value = ev.location || '';
  document.getElementById('modal-calendar-event').classList.remove('hidden');
}

async function handleCalendarEventSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('cal-event-input-id').value;
  const title = document.getElementById('cal-event-input-title').value;
  const date = document.getElementById('cal-event-input-date').value;
  const type = document.getElementById('cal-event-input-type').value;
  const location = document.getElementById('cal-event-input-loc').value;

  if (id) {
    await API.updateCalendarEvent(id, { title, date, type, location });
  } else {
    await API.createCalendarEvent({ title, date, type, location });
  }

  closeModal('modal-calendar-event');
  state.calendarEvents = (await API.getCalendar()).events || [];
  renderCalendar();
}

async function deleteCalendarEvent(id) {
  if (!confirm('Remove this calendar event?')) return;
  await API.deleteCalendarEvent(id);
  state.calendarEvents = state.calendarEvents.filter(e => e.id !== id);
  renderCalendar();
}

// FACTORY RESET (Wipes offline cache & cloud data)
async function triggerFactoryReset() {
  const confirmed = confirm('⚠️ FACTORY RESET WARNING:\n\nThis will completely wipe all your academic records (subjects, attendance, timetable, homework, labs, study logs, and vault files) on both this device and the cloud.\n\nAre you absolutely sure you want to proceed?');
  if (!confirmed) return;

  try {
    await API.factoryReset(); if (state.user && state.user.email) localStorage.removeItem('college_os_backup_' + state.user.email);
    localStorage.removeItem('college_os_offline_queue');
    alert('Factory reset completed. Reloading clean workspace...');
    window.location.reload();
  } catch (err) {
    alert('Reset failed: ' + err.message);
  }
}

// -------------------------------------------------------------
// MODALS, CREATION & GLOBAL SEARCH
// -------------------------------------------------------------

function populateSubjectSelects() {
  const select1 = document.getElementById('task-input-subject');
  const select2 = document.getElementById('timer-subject-select');
  const select3 = document.getElementById('slot-input-subject');
  const select4 = document.getElementById('lab-input-subject');
  const select5 = document.getElementById('plan-input-subject');

  const baseOpts = state.subjects.map(s => `<option value="${s.id}">${s.code}: ${s.name}</option>`).join('');
  const optsWithCustom = `<option value="" disabled selected>Select a subject...</option>` + baseOpts + `<option value="CUSTOM">+ Custom Subject...</option>`;

  if (select1) select1.innerHTML = optsWithCustom;
  if (select2) select2.innerHTML = baseOpts;
  if (select3) select3.innerHTML = optsWithCustom;
  if (select4) select4.innerHTML = optsWithCustom;
  if (select5) select5.innerHTML = baseOpts;

  populateVaultFolderSelects();
}

function populateVaultFolderSelects() {
  const fldSelect = document.getElementById('vault-input-folder');
  if (fldSelect && state.vaultFolders.length > 0) {
    fldSelect.innerHTML = state.vaultFolders.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  }
}

// Custom input toggle helpers
function toggleCustomTaskType(val) {
  const container = document.getElementById('task-custom-type-container');
  if (container) container.classList.toggle('hidden', val !== 'custom');
}

function toggleCustomTaskSubject(val) {
  const container = document.getElementById('task-custom-subject-container');
  if (container) container.classList.toggle('hidden', val !== 'CUSTOM');
}

function setQuickTaskDueDate(days) {
  const target = new Date();
  target.setDate(target.getDate() + days);
  const input = document.getElementById('task-input-due');
  if (input) input.value = target.toISOString().split('T')[0];
}

function toggleCustomSlotSubject(val) {
  const container = document.getElementById('slot-custom-subject-container');
  if (container) container.classList.toggle('hidden', val !== 'CUSTOM');
}

function toggleCustomLabSubject(val) {
  const container = document.getElementById('lab-custom-subject-container');
  if (container) container.classList.toggle('hidden', val !== 'CUSTOM');
}

function toggleCustomLabType(val) {
  const container = document.getElementById('lab-custom-type-container');
  if (container) container.classList.toggle('hidden', val !== 'custom');
}

function openQuickActionModal() { document.getElementById('modal-quick-actions').classList.remove('hidden'); }
function openSearchModal() { document.getElementById('modal-search').classList.remove('hidden'); document.getElementById('input-global-search').focus(); }
function openAddTaskModal() { document.getElementById('modal-add-task').classList.remove('hidden'); }
function openAddSlotModal() { document.getElementById('modal-add-slot').classList.remove('hidden'); }
function openAddLabModal() { document.getElementById('modal-add-lab').classList.remove('hidden'); }
function openAddStudyPlanModal() { document.getElementById('modal-add-study-plan').classList.remove('hidden'); }
function openUploadVaultModal() { document.getElementById('modal-upload-vault').classList.remove('hidden'); }
function openScannerModal() { document.getElementById('modal-scanner').classList.remove('hidden'); }

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function closeAllModals() {
  document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
}

async function handleCreateTask(e) {
  e.preventDefault();
  const title = document.getElementById('task-input-title').value;
  let type = document.getElementById('task-input-type').value;
  if (type === 'custom') {
    type = document.getElementById('task-input-custom-type').value || 'Academic Task';
  }
  const priority = document.getElementById('task-input-priority').value;
  const subjectId = document.getElementById('task-input-subject').value;
  const customSubject = subjectId === 'CUSTOM' ? document.getElementById('task-input-custom-subject').value : null;
  const dueDate = document.getElementById('task-input-due').value;

  try {
    await API.createTask({ title, type, priority, subjectId, customSubject, dueDate });
    closeModal('modal-add-task');
    state.tasks = (await API.getTasks()).tasks || [];
    renderTasks();
    renderDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function handleCreateSlot(e) {
  e.preventDefault();
  const day = document.getElementById('slot-input-day').value;
  const subjectId = document.getElementById('slot-input-subject').value;
  const customSubjectName = subjectId === 'CUSTOM' ? document.getElementById('slot-input-custom-name').value : null;
  const customSubjectCode = subjectId === 'CUSTOM' ? document.getElementById('slot-input-custom-code').value : null;

  const periodNum = Number(document.getElementById('slot-input-period').value) || 1;
  const startTime = document.getElementById('slot-input-start-time').value || '08:30';
  const endTime = document.getElementById('slot-input-end-time').value || '09:30';
  const room = document.getElementById('slot-input-room').value || 'Lecture Hall';
  const faculty = document.getElementById('slot-input-faculty').value || 'Instructor';

  try {
    await API.createTimetableSlot({
      subjectId,
      customSubjectName,
      customSubjectCode,
      day,
      periodNumber: periodNum,
      startTime,
      endTime,
      classroom: room,
      faculty
    });

    closeModal('modal-add-slot');
    await refreshAllData();
    renderDailyAttendanceSheet();
    renderTimetableMatrix();
    renderDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function handleCreateLab(e) {
  e.preventDefault();
  const title = document.getElementById('lab-input-title').value;
  const subjectId = document.getElementById('lab-input-subject').value;
  const customSubject = subjectId === 'CUSTOM' ? document.getElementById('lab-input-custom-subject').value : null;

  let labType = document.getElementById('lab-input-type').value;
  if (labType === 'custom') {
    labType = document.getElementById('lab-input-custom-type').value || 'Practical';
  }

  const description = document.getElementById('lab-input-desc').value;
  const sessionDate = document.getElementById('lab-input-session-date').value || new Date().toISOString().split('T')[0];
  const deadline = document.getElementById('lab-input-deadline').value;
  const recordStatus = document.getElementById('lab-input-status').value;

  try {
    await API.createLab({ title, subjectId, customSubject, type: labType, description, sessionDate, deadline, recordStatus, status: 'In Progress' });
    closeModal('modal-add-lab');
    state.labs = (await API.getLabs()).labs || [];
    renderLabs();
    renderDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function handleCreateStudyPlan(e) {
  e.preventDefault();
  const title = document.getElementById('plan-input-title').value;
  const subjectId = document.getElementById('plan-input-subject').value;
  const targetMinutes = Number(document.getElementById('plan-input-minutes').value) || 60;
  const date = document.getElementById('plan-input-date').value;

  await API.createStudyPlan({ title, subjectId, targetMinutes, date });
  closeModal('modal-add-study-plan');
  state.studyPlans = (await API.getStudyPlans()).plans || [];
  renderStudyPlanner();
}

async function handleVaultUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('vault-file-input');
  const folderId = document.getElementById('vault-input-folder').value;
  if (!fileInput.files.length) return;

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  if (folderId) formData.append('folderId', folderId);

  try {
    await API.uploadFile(formData);
    closeModal('modal-upload-vault');
    alert('File uploaded to Vault!');
    state.vaultFiles = (await API.getFiles()).files || [];
    loadVaultFiles(state.isTrashView);
  } catch (err) {
    alert('Upload failed: ' + err.message);
  }
}

async function handleSaveScannedDoc() {
  const title = document.getElementById('scanner-doc-title').value || 'Scanned Document';
  await API.saveScannedDoc({ title, folderId: null });
  closeModal('modal-scanner');
  alert('Document compiled and saved to Vault!');
  state.vaultFiles = (await API.getFiles()).files || [];
  navigateTo('vault');
}

async function handleGlobalSearch(query) {
  const container = document.getElementById('global-search-results');
  if (!query || query.trim().length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">Start typing to search your academic records...</div>`;
    return;
  }
  const res = await API.search(query);
  const results = res.results || [];
  if (results.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">No matching subjects, tasks, or documents found.</div>`;
    return;
  }
  container.innerHTML = results.map(r => `
    <div onclick="closeModal('modal-search'); navigateTo('${r.link.replace('/app#', '')}')" class="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between transition">
      <div>
        <span class="text-xs font-bold block">${r.title}</span>
        <span class="text-[10px] text-slate-500 font-inter">${r.subtitle}</span>
      </div>
      <span class="text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 px-2 py-0.5 rounded-md">${r.category}</span>
    </div>
  `).join('');
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const name = document.getElementById('settings-input-name').value;
  const college = document.getElementById('settings-input-college').value;
  const semester = document.getElementById('settings-input-semester').value;
  const major = document.getElementById('settings-input-major').value;
  const studentId = document.getElementById('settings-input-id').value;

  const res = await API.updateProfile({ name, college, semester, major, studentId });
  state.user = res.user;
  renderUserProfile(res.user);
  alert('Profile changes saved successfully!');
}
