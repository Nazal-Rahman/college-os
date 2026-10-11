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

  // Check auth - require logged-in session
  let token = API.getToken();
  if (!token) {
    window.location.href = '/';
    return;
  }

  try {
    const user = await API.getMe();
    state.user = user;
    renderUserProfile(user);

    // Ensure Firebase is initialized
    if (window.FirebaseSync) {
      await window.FirebaseSync.init();
    }

    // [Cloud & Multi-Device Data Hydration]
    let backupData = null;
    if (window.FirebaseSync && window.FirebaseSync.isAvailable()) {
      try {
        backupData = await window.FirebaseSync.loadUserData(user.id, user.email);
      } catch (e) { console.warn('Cloud restore check failed:', e); }
    }
    if (!backupData && user.email) {
      try {
        const lowerEmail = user.email.toLowerCase();
        const localCache = JSON.parse(
          localStorage.getItem(`college_os_backup_${lowerEmail}`) ||
          localStorage.getItem(`college_os_backup_${user.email}`)
        );
        if (localCache) backupData = localCache;
      } catch(e) {}
    }

    if (backupData && Object.keys(backupData).length > 0) {
      try {
        const [backendSubRes, backendTtRes] = await Promise.all([
          API.getSubjects().catch(() => ({ subjects: [] })),
          API.getTimetable().catch(() => ({ timetable: [] }))
        ]);
        const bSubs = backendSubRes?.subjects || [];
        const bSlots = backendTtRes?.timetable || [];
        const bkSubs = backupData.subjects || [];
        const bkSlots = backupData.timetable || [];

        // If backup has subjects or timetable slots missing in backend, restore to backend!
        if (bSubs.length === 0 || bSlots.length === 0 || bkSubs.length > bSubs.length || bkSlots.length > bSlots.length || Object.keys(backupData.periodAttendance || {}).length > 0) {
          console.log('[Hydration] Syncing cloud/backup data to backend workspace...');
          await API.restoreCloudData(backupData);
        }
      } catch(e) {
        console.warn('Hydration sync check warning:', e.message);
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

  // Render Student Avatar
  const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name || 'Student')}`;
  const avatarUrl = p.avatar || defaultAvatar;

  const topAvatar = document.getElementById('top-student-avatar');
  if (topAvatar) topAvatar.src = avatarUrl;

  const settingsAvatar = document.getElementById('settings-avatar-preview');
  if (settingsAvatar) settingsAvatar.src = avatarUrl;

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

function syncCloudAndLocal(force = false) {
  if (!state.user) return;

  const storageKey = `college_os_backup_${state.user.email.toLowerCase()}`;
  const existingBackupRaw = localStorage.getItem(storageKey) || localStorage.getItem(`college_os_backup_${state.user.email}`);
  const isStateEmpty = (!state.subjects || state.subjects.length === 0) &&
                       (!state.timetable || state.timetable.length === 0) &&
                       (!state.tasks || state.tasks.length === 0);

  if (isStateEmpty && existingBackupRaw && !force) {
    try {
      const existing = JSON.parse(existingBackupRaw);
      if (existing.subjects && existing.subjects.length > 0) {
        console.log('[SafeSync] Retaining existing populated offline backup, skipping overwrite with empty state.');
        return;
      }
    } catch(e) {}
  }

  const exportData = {
    email: state.user.email,
    userId: state.user.id,
    firebaseUid: state.user.firebaseUid || (window.firebase && firebase.auth() && firebase.auth().currentUser ? firebase.auth().currentUser.uid : null),
    profile: state.user.profile,
    preferences: state.user.preferences,
    subjects: state.subjects || [],
    timetable: state.timetable || [],
    attendanceData: state.attendanceData || {},
    periodAttendance: state.periodAttendanceRecords || {},
    tasks: state.tasks || [],
    labs: state.labs || [],
    studyPlans: state.studyPlans || [],
    studySessions: state.studySessions || [],
    vaultFolders: state.vaultFolders || [],
    vaultFiles: state.vaultFiles || [],
    calendarEvents: state.calendarEvents || []
  };

  if (window.FirebaseSync) {
    window.FirebaseSync.syncUserData(state.user.id, exportData);
  }

  localStorage.setItem(storageKey, JSON.stringify(exportData));
  updateCloudSyncStatusBadge();
}

function persistOfflineImmediately() {
  if (!state.user) return;
  const storageKey = `college_os_backup_${state.user.email.toLowerCase()}`;
  const exportData = {
    email: state.user.email,
    userId: state.user.id,
    firebaseUid: state.user.firebaseUid || (window.firebase && firebase.auth() && firebase.auth().currentUser ? firebase.auth().currentUser.uid : null),
    profile: state.user.profile,
    preferences: state.user.preferences,
    subjects: state.subjects || [],
    timetable: state.timetable || [],
    attendanceData: state.attendanceData || {},
    periodAttendance: state.periodAttendanceRecords || {},
    tasks: state.tasks || [],
    labs: state.labs || [],
    studyPlans: state.studyPlans || [],
    studySessions: state.studySessions || [],
    vaultFolders: state.vaultFolders || [],
    vaultFiles: state.vaultFiles || [],
    calendarEvents: state.calendarEvents || []
  };
  localStorage.setItem(storageKey, JSON.stringify(exportData));
}

function recalculateLocalAttendance() {
  if (!state.subjects || state.subjects.length === 0) {
    updateAttendanceUIElements(0, 0, 100.0);
    return;
  }

  const defaultTarget = state.defaultAttendanceTarget || 75;

  state.subjects.forEach(sub => {
    let attended = 0;
    let total = 0;

    // Count all marked periods for this subject across all days
    Object.entries(state.periodAttendanceRecords || {}).forEach(([key, status]) => {
      if (key.includes(`_${sub.id}_period_`)) {
        if (status === 'Present') {
          attended++;
          total++;
        } else if (status === 'Absent') {
          total++;
        }
      }
    });

    sub.attended = attended;
    sub.total = total;
    const target = sub.targetAttendance || defaultTarget;
    const percentage = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 100.0;
    sub.percentage = percentage;
    sub.target = target;
    sub.isAtRisk = total > 0 && percentage < target;

    if (total > 0 && percentage >= target) {
      sub.safeToSkip = Math.floor((attended - (target / 100) * total) / (target / 100));
      sub.neededToReach = 0;
    } else if (total > 0) {
      sub.neededToReach = Math.ceil(((target / 100) * total - attended) / (1 - (target / 100)));
      sub.safeToSkip = 0;
    } else {
      sub.safeToSkip = 0;
      sub.neededToReach = 0;
    }
  });

  const totAttended = state.subjects.reduce((sum, s) => sum + (s.attended || 0), 0);
  const totConducted = state.subjects.reduce((sum, s) => sum + (s.total || 0), 0);
  const ovPercentage = totConducted > 0 ? Number(((totAttended / totConducted) * 100).toFixed(1)) : 100.0;

  state.attendanceData = {
    ...state.attendanceData,
    overall: {
      attended: totAttended,
      total: totConducted,
      percentage: ovPercentage
    },
    subjects: state.subjects
  };

  updateAttendanceUIElements(totAttended, totConducted, ovPercentage);
}

function updateAttendanceUIElements(attended, conducted, percentage) {
  // 1. Dashboard Total Attendance Metrics
  const dashPct = document.getElementById('metric-attendance-pct');
  if (dashPct) {
    dashPct.textContent = `${percentage}%`;
    dashPct.className = `text-3xl font-extrabold ${percentage >= 75 ? 'text-emerald-600' : 'text-red-600'}`;
  }
  const dashRatio = document.getElementById('metric-attendance-ratio');
  if (dashRatio) dashRatio.textContent = `${attended} / ${conducted} hours attended`;

  // 2. Timetable & Attendance Executive Banner
  const ttPct = document.getElementById('tt-overall-pct');
  if (ttPct) {
    ttPct.textContent = `${percentage}%`;
    ttPct.className = `text-3xl font-black ${percentage >= 75 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`;
  }
  const ttRatio = document.getElementById('tt-overall-ratio');
  if (ttRatio) ttRatio.textContent = `${attended} of ${conducted} classes attended`;

  const ttBadge = document.getElementById('tt-overall-badge');
  if (ttBadge) {
    if (conducted === 0) {
      ttBadge.textContent = 'Ready';
      ttBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20';
    } else if (percentage >= 75) {
      ttBadge.textContent = 'On Track (Safe)';
      ttBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
    } else {
      ttBadge.textContent = 'Attendance Low';
      ttBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20';
    }
  }

  const ttBunk = document.getElementById('tt-overall-bunk-status');
  const ttBunkSub = document.getElementById('tt-overall-bunk-sub');
  if (ttBunk) {
    if (conducted === 0) {
      ttBunk.textContent = 'No classes yet';
      if (ttBunkSub) ttBunkSub.textContent = 'record classes to track';
    } else if (percentage >= 75) {
      const safe = Math.floor((attended - 0.75 * conducted) / 0.75);
      ttBunk.textContent = `Safe to skip ${Math.max(0, safe)} hrs`;
      ttBunk.className = 'text-base font-extrabold text-blue-600 dark:text-blue-400 block mt-0.5';
      if (ttBunkSub) ttBunkSub.textContent = 'above 75% target';
    } else {
      const needed = Math.ceil((0.75 * conducted - attended) / 0.25);
      ttBunk.textContent = `Need ${Math.max(1, needed)} more classes`;
      ttBunk.className = 'text-base font-extrabold text-red-600 dark:text-red-400 block mt-0.5';
      if (ttBunkSub) ttBunkSub.textContent = 'consecutively to reach 75%';
    }
  }

  const ttSubCount = document.getElementById('tt-overall-subjects-count');
  if (ttSubCount) ttSubCount.textContent = `${state.subjects ? state.subjects.length : 0} Subjects`;
}

async function refreshAllData() {
  try {
    const [subRes, ttRes, attRes, periodRecRes, taskRes, labRes, planRes, studyRes, vaultFldRes, vaultFileRes, calRes, calPdfRes] = await Promise.all([
      API.getSubjects().catch(() => ({ subjects: state.subjects })),
      API.getTimetable().catch(() => ({ timetable: state.timetable })),
      API.getAttendance().catch(() => ({})),
      API.request('/api/attendance/period-records').catch(() => ({ records: state.periodAttendanceRecords })),
      API.getTasks().catch(() => ({ tasks: state.tasks })),
      API.getLabs().catch(() => ({ labs: state.labs })),
      API.getStudyPlans().catch(() => ({ plans: state.studyPlans })),
      API.getStudySessions().catch(() => ({ sessions: state.studySessions })),
      API.getFolders().catch(() => ({ folders: state.vaultFolders })),
      API.getFiles().catch(() => ({ files: state.vaultFiles })),
      API.getCalendar().catch(() => ({ events: state.calendarEvents })),
      API.getCalendarPdf().catch(() => ({ file: null }))
    ]);

    // Safeguard: do not let an empty array from a fresh cold-start backend wipe populated local state!
    if (subRes && Array.isArray(subRes.subjects) && (subRes.subjects.length > 0 || state.subjects.length === 0)) {
      state.subjects = subRes.subjects;
    }
    if (ttRes && Array.isArray(ttRes.timetable) && (ttRes.timetable.length > 0 || state.timetable.length === 0)) {
      state.timetable = ttRes.timetable;
    }
    if (periodRecRes && periodRecRes.records && Object.keys(periodRecRes.records).length > 0) {
      state.periodAttendanceRecords = { ...state.periodAttendanceRecords, ...periodRecRes.records };
    }
    state.holidayDays = ttRes?.holidayDays || state.holidayDays || ['Saturday', 'Sunday'];
    if (attRes) {
      state.attendanceData = attRes;
      state.defaultAttendanceTarget = attRes.defaultTarget || state.defaultAttendanceTarget || 75;
      state.customTargetsEnabled = attRes.customTargetsEnabled || false;
    }
    if (taskRes?.tasks) state.tasks = taskRes.tasks;
    if (labRes?.labs) state.labs = labRes.labs;
    if (planRes?.plans) state.studyPlans = planRes.plans;
    if (studyRes?.sessions) state.studySessions = studyRes.sessions;
    if (vaultFldRes?.folders) state.vaultFolders = vaultFldRes.folders;
    if (vaultFileRes?.files) state.vaultFiles = vaultFileRes.files;
    if (calRes?.events) state.calendarEvents = calRes.events;
    if (calPdfRes?.file) state.academicCalendarPdf = calPdfRes.file;

    // Sync settings UI inputs
    const prefGlobal = document.getElementById('pref-global-target');
    if (prefGlobal) prefGlobal.value = state.defaultAttendanceTarget;

    const prefCustomSwitch = document.getElementById('pref-custom-target-switch');
    if (prefCustomSwitch) prefCustomSwitch.checked = !!state.customTargetsEnabled;

    recalculateLocalAttendance();
    renderDashboard();
    populateSubjectSelects();
    updateDayHolidayBadges();

    // Cloud & Offline Backup Sync
    syncCloudAndLocal();
  } catch (err) {
    console.error('Error refreshing workspace data:', err);
  }
}

// -------------------------------------------------------------
// 1. DASHBOARD RENDERER
// -------------------------------------------------------------

function renderDashboard() {
  recalculateLocalAttendance();
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const dateEl = document.getElementById('dash-date-str');
  if (dateEl) dateEl.textContent = dateStr;

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const classesToday = (state.timetable || []).filter(s => (s.day || '').toLowerCase() === todayName.toLowerCase());

  const classesMetric = document.getElementById('metric-classes-today');
  if (classesMetric) classesMetric.textContent = classesToday.length;

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

  if (classesToday.length > 0) {
    const sortedToday = [...classesToday].sort((a, b) => (Number(a.periodNumber) || 0) - (Number(b.periodNumber) || 0));
    const nextClass = sortedToday[0];
    const nName = document.getElementById('next-class-name');
    if (nName) nName.textContent = nextClass.subjectName;
    const nRoom = document.getElementById('next-class-room');
    if (nRoom) nRoom.textContent = `(${nextClass.classroom || 'Lecture Hall'})`;
    const nProf = document.getElementById('next-class-prof');
    if (nProf) nProf.textContent = nextClass.faculty || 'Instructor';
  } else if (state.timetable && state.timetable.length > 0) {
    const firstCls = state.timetable[0];
    const nName = document.getElementById('next-class-name');
    if (nName) nName.textContent = firstCls.subjectName;
    const nRoom = document.getElementById('next-class-room');
    if (nRoom) nRoom.textContent = `(${firstCls.day} ${firstCls.startTime} - ${firstCls.classroom || 'Hall'})`;
    const nProf = document.getElementById('next-class-prof');
    if (nProf) nProf.textContent = firstCls.faculty || 'Instructor';
  } else {
    const nName = document.getElementById('next-class-name');
    if (nName) nName.textContent = 'No classes added yet';
    const nRoom = document.getElementById('next-class-room');
    if (nRoom) nRoom.textContent = '(Use Timetable to schedule)';
    const nProf = document.getElementById('next-class-prof');
    if (nProf) nProf.textContent = 'Schedule classes';
  }

  // Today's timeline on dashboard
  const timelineEl = document.getElementById('dash-timeline-list');
  if (timelineEl) {
    if (classesToday.length > 0) {
      const sortedClasses = [...classesToday].sort((a, b) => (Number(a.periodNumber) || 0) - (Number(b.periodNumber) || 0));
      timelineEl.innerHTML = sortedClasses.map(cls => {
        const slotKey = `${cls.day}_${cls.subjectId}_period_${cls.periodNumber}`;
        const attStatus = state.periodAttendanceRecords ? state.periodAttendanceRecords[slotKey] : undefined;
        const statusBadge = attStatus === 'Present' 
          ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">✓ Present</span>`
          : (attStatus === 'Absent' 
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200">✕ Absent</span>`
            : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Scheduled</span>`);

        return `
          <div class="p-4 rounded-2xl theme-subtle border theme-border flex items-center justify-between gap-3 hover:border-blue-500/30 transition">
            <div class="flex items-center gap-3">
              <div class="w-1.5 h-10 rounded-full" style="background: ${cls.color || '#2563EB'}"></div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold">${cls.subjectCode}: ${cls.subjectName}</span>
                  <span class="text-[10px] theme-card border theme-border px-2 py-0.5 rounded-md font-semibold">${cls.classroom || 'Hall'}</span>
                  ${statusBadge}
                </div>
                <div class="text-[11px] text-slate-500 font-inter mt-0.5">
                  Period ${cls.periodNumber || 1} • ${cls.startTime} - ${cls.endTime} • ${cls.faculty || 'Instructor'}
                </div>
              </div>
            </div>
            <button onclick="navigateTo('timetable'); selectDailySheetDay('${cls.day}')" class="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-bold font-inter transition active:scale-95">
              Mark Sheet →
            </button>
          </div>
        `;
      }).join('') + `
        <div class="pt-2 flex items-center justify-between">
          <span class="text-xs text-slate-500 font-inter">${classesToday.length} classes scheduled for today (${todayName})</span>
          <button onclick="openAddSlotForActiveDay('${todayName}')" class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-inter flex items-center gap-1.5 shadow-xs transition active:scale-95">
            <span class="material-symbols-outlined text-[16px]">add</span>
            <span>+ Add Class to Today</span>
          </button>
        </div>
      `;
    } else {
      timelineEl.innerHTML = `
        <div class="p-6 rounded-2xl theme-subtle border theme-border text-center space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mx-auto">
            <span class="material-symbols-outlined text-2xl">event_available</span>
          </div>
          <div>
            <h4 class="text-sm font-bold">No classes scheduled for today (${todayName})</h4>
            <p class="text-xs text-slate-500 font-inter mt-1">
              ${(state.timetable && state.timetable.length > 0) ? 'You have classes scheduled on other days of the week. You can also add classes to today.' : 'Add your subjects and schedule your daily periods to start tracking attendance.'}
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button onclick="openAddSlotForActiveDay('${todayName}')" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-inter flex items-center gap-1.5 shadow-xs transition active:scale-95">
              <span class="material-symbols-outlined text-[16px]">add</span>
              <span>+ Add Class to Today (${todayName})</span>
            </button>
            <button onclick="navigateTo('timetable')" class="px-4 py-2 rounded-xl theme-card border theme-border hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold font-inter transition">
              Open 7-Day Timetable & Sheet →
            </button>
          </div>
        </div>
      `;
    }
  }

  // Attendance summary on dashboard
  const attSummaryEl = document.getElementById('dash-attendance-summary');
  if (attSummaryEl) {
    if (!state.subjects || state.subjects.length === 0) {
      attSummaryEl.innerHTML = `
        <div class="p-5 text-center text-xs text-slate-400 font-inter space-y-2">
          <div>No course subjects added yet.</div>
          <button onclick="navigateTo('settings'); switchSettingsSubTab('subjects-catalog', document.querySelectorAll('.settings-subtab-btn')[1])" class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
            + Add Course Subjects in Settings
          </button>
        </div>
      `;
    } else {
      attSummaryEl.innerHTML = state.subjects.slice(0, 6).map(sub => {
        const pct = sub.percentage !== undefined ? sub.percentage : (sub.total > 0 ? Number(((sub.attended / sub.total) * 100).toFixed(1)) : 100.0);
        const target = sub.targetAttendance || state.defaultAttendanceTarget || 75;
        const isSafe = pct >= target;
        return `
          <div class="p-3.5 rounded-xl theme-subtle border theme-border flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background: ${sub.color || '#2563EB'}"></span>
                <span class="text-xs font-bold truncate">${sub.code}: ${sub.name}</span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[11px] text-slate-500 font-inter">${sub.attended || 0} / ${sub.total || 0} hrs attended</span>
                <span class="text-[10px] text-slate-400">• Goal: ${target}%</span>
              </div>
              <div class="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                <div class="h-full rounded-full ${isSafe ? 'bg-emerald-500' : 'bg-red-500'}" style="width: ${Math.min(100, pct)}%"></div>
              </div>
            </div>
            <div class="text-right font-inter shrink-0 pl-2">
              <span class="text-xs font-black ${isSafe ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}">${pct}%</span>
              <span class="text-[10px] block mt-0.5 ${isSafe ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-red-500 font-bold'}">
                ${isSafe ? `Safe: ${sub.safeToSkip || 0} hrs` : `Need ${sub.neededToReach || 1} hrs`}
              </span>
            </div>
          </div>
        `;
      }).join('');
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
  } else {
    document.querySelectorAll('.sheet-day-btn').forEach(b => {
      if (b.textContent.trim().startsWith(day.substring(0, 3))) {
        b.className = 'sheet-day-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-xs';
      }
    });
  }
  const dayTitle = document.getElementById('daily-sheet-day-title');
  if (dayTitle) dayTitle.textContent = day;
  const addBtnLabel = document.getElementById('btn-add-class-day-label');
  if (addBtnLabel) addBtnLabel.textContent = `Add Class to ${day}`;
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
  const [attRes, subRes] = await Promise.all([API.getAttendance(), API.getSubjects()]);
  state.attendanceData = attRes;
  state.subjects = subRes.subjects || [];
  renderDailyAttendanceSheet();
  renderTimetableMatrix();
  renderAttendanceAnalytics();
  renderDashboard();
  alert('Timetable and period attendance cleared.');
  syncCloudAndLocal();
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
      <div class="p-8 text-center text-xs text-slate-400 font-inter space-y-3">
        <div>No class periods scheduled for ${day}.</div>
        <button onclick="openAddSlotForActiveDay('${day}')" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition inline-flex items-center gap-1.5 shadow-xs active:scale-95">
          <span class="material-symbols-outlined text-[16px]">add</span>
          <span>+ Add Class to ${day}</span>
        </button>
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
    const groupKey = slot.subjectId || ('custom_' + (slot.subjectCode || slot.id));
    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        subjectId: slot.subjectId || groupKey,
        subjectCode: slot.subjectCode,
        subjectName: slot.subjectName,
        classroom: slot.classroom,
        faculty: slot.faculty,
        color: slot.color,
        slots: []
      };
    }
    grouped[groupKey].slots.push(slot);
  });

  // Sort periods in each group
  Object.values(grouped).forEach(g => {
    g.slots.sort((a, b) => (Number(a.periodNumber) || 0) - (Number(b.periodNumber) || 0));
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
  const prev = state.periodAttendanceRecords[slotKey];
  const next = isPresent ? 'Present' : 'Absent';

  // Toggle off if clicking the already active state
  if (prev === next) {
    delete state.periodAttendanceRecords[slotKey];
  } else {
    state.periodAttendanceRecords[slotKey] = next;
  }

  // Instant offline recalculation & local persistence
  recalculateLocalAttendance();
  persistOfflineImmediately();

  try {
    await API.markPeriod({ subjectId, dayKey, date: dayKey, periodNumber, isPresent: state.periodAttendanceRecords[slotKey] === 'Present' });
  } catch (e) {
    console.warn('Offline attendance mark queued:', e.message);
  }

  syncCloudAndLocal();
  renderDailyAttendanceSheet();
  renderDashboard();
  renderAttendanceAnalytics();
}

async function markAllPeriodsForDay(present) {
  const day = state.selectedSheetDay;
  const slotsForDay = state.timetable.filter(s => s.day.toLowerCase() === day.toLowerCase());

  const grouped = {};
  slotsForDay.forEach(slot => {
    const groupKey = slot.subjectId || ('custom_' + (slot.subjectCode || slot.id));
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(slot);
  });

  for (const [subId, subjectSlots] of Object.entries(grouped)) {
    for (let periodNum = 1; periodNum <= subjectSlots.length; periodNum++) {
      const slotKey = `${day}_${subId}_period_${periodNum}`;
      state.periodAttendanceRecords[slotKey] = present ? 'Present' : 'Absent';
      API.markPeriod({ subjectId: subId, date: day, periodNumber: periodNum, isPresent: present }).catch(() => {});
    }
  }

  recalculateLocalAttendance();
  persistOfflineImmediately();
  renderDailyAttendanceSheet();
  renderDashboard();
  renderAttendanceAnalytics();
  syncCloudAndLocal();
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
  state.timetable = state.timetable.filter(s => s.id !== id);
  persistOfflineImmediately();
  try {
    await API.deleteTimetableSlot(id);
  } catch(e) {
    console.warn('Offline slot delete queued:', e.message);
  }
  recalculateLocalAttendance();
  renderTimetableMatrix();
  renderDailyAttendanceSheet();
  renderDashboard();
  syncCloudAndLocal();
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
  
  const [attRes, subRes] = await Promise.all([
    API.getAttendance(),
    API.getSubjects()
  ]);
  state.attendanceData = attRes;
  state.subjects = subRes.subjects || [];
  
  syncCloudAndLocal();
  
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
  const [attRes, subRes] = await Promise.all([
    API.getAttendance(),
    API.getSubjects()
  ]);
  state.attendanceData = attRes;
  state.subjects = subRes.subjects || [];

  syncCloudAndLocal();

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

  const [attRes, subRes] = await Promise.all([
    API.getAttendance(),
    API.getSubjects()
  ]);
  state.attendanceData = attRes;
  state.subjects = subRes.subjects || [];
  state.defaultAttendanceTarget = globalTarget;
  state.customTargetsEnabled = customEnabled;
  
  syncCloudAndLocal();

  renderAttendanceAnalytics();
  renderDashboard();
  alert('Attendance target policy updated successfully.');
}

async function toggleCustomTargetsSwitch(checked) {
  state.customTargetsEnabled = checked;
  await API.setAttendanceTargetSettings({ customTargetsEnabled: checked });
  
  const [attRes, subRes] = await Promise.all([
    API.getAttendance(),
    API.getSubjects()
  ]);
  state.attendanceData = attRes;
  state.subjects = subRes.subjects || [];
  
  syncCloudAndLocal();
  
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
  syncCloudAndLocal();
}

async function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this college work?')) return;
  await API.deleteTask(id);
  state.tasks = state.tasks.filter(t => t.id !== id);
  renderTasks();
  renderDashboard();
  syncCloudAndLocal();
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
  syncCloudAndLocal();
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
  syncCloudAndLocal();
}

async function deleteStudySession(id) {
  await API.deleteStudySession(id);
  state.studySessions = state.studySessions.filter(s => s.id !== id);
  renderStudyPlanner();
  syncCloudAndLocal();
}

async function clearAllStudyLogs() {
  if (!confirm('Clear all study history logs?')) return;
  await API.clearAllStudySessions();
  state.studySessions = [];
  renderStudyPlanner();
  syncCloudAndLocal();
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
  ['student-profile', 'subjects-catalog', 'grade-calculator', 'unified-calendar', 'preferences-reset'].forEach(id => {
    const el = document.getElementById(`subtab-${id}`);
    if (el) el.classList.toggle('hidden', id !== tabId);
  });
  document.querySelectorAll('.settings-subtab-btn').forEach(b => {
    b.className = 'settings-subtab-btn px-4 py-2 rounded-xl theme-card border theme-border hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5';
  });
  btn.className = 'settings-subtab-btn px-4 py-2 rounded-xl bg-blue-600 text-white shadow-xs flex items-center gap-1.5';

  if (tabId === 'subjects-catalog') renderSettingsSubjects();
  if (tabId === 'grade-calculator') renderGradeCalculator();
  if (tabId === 'unified-calendar') renderCalendar();
}

function renderSettings() {
  renderUserProfile(state.user);
  renderSettingsSubjects();
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

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function handleSlotSubjectSelectionChange(val) {
  toggleCustomSlotSubject(val);
  if (val && val !== 'CUSTOM') {
    const sub = state.subjects.find(s => s.id === val);
    if (sub) {
      const roomInput = document.getElementById('slot-input-room');
      const facInput = document.getElementById('slot-input-faculty');
      if (roomInput && (!roomInput.value || roomInput.value === 'Lecture Hall')) {
        roomInput.value = sub.classroom || '';
      }
      if (facInput && (!facInput.value || facInput.value === 'Instructor')) {
        facInput.value = sub.faculty || '';
      }
    }
  }
}

function openQuickActionModal() { openModal('modal-quick-actions'); }
function openSearchModal() { openModal('modal-search'); document.getElementById('input-global-search').focus(); }
function openAddTaskModal() { openModal('modal-add-task'); }
function openAddSlotModal() { openAddSlotForActiveDay(); }
function openAddLabModal() { openModal('modal-add-lab'); }
function openAddStudyPlanModal() { openModal('modal-add-study-plan'); }
function openUploadVaultModal() { openModal('modal-upload-vault'); }
function openScannerModal() { openModal('modal-scanner'); }

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}
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
  const customSubjectName = subjectId === 'CUSTOM' ? (document.getElementById('slot-input-custom-name').value || '').trim() : null;
  const customSubjectCode = subjectId === 'CUSTOM' ? (document.getElementById('slot-input-custom-code').value || '').trim() : null;

  const periodNum = Number(document.getElementById('slot-input-period').value) || 1;
  const startTime = document.getElementById('slot-input-start-time').value || '08:30';
  const endTime = document.getElementById('slot-input-end-time').value || '09:30';
  let room = (document.getElementById('slot-input-room').value || '').trim();
  let faculty = (document.getElementById('slot-input-faculty').value || '').trim();

  let finalSubjectId = subjectId;
  let finalSubName = 'Course';
  let finalSubCode = 'SUB';
  let finalColor = '#2563EB';

  if (subjectId === 'CUSTOM') {
    if (!customSubjectName) {
      alert('Please enter a custom subject name.');
      return;
    }
    finalSubName = customSubjectName;
    finalSubCode = customSubjectCode || customSubjectName.substring(0, 4).toUpperCase();

    let matchedSub = state.subjects.find(s => s.name.toLowerCase() === customSubjectName.toLowerCase() || s.code.toLowerCase() === finalSubCode.toLowerCase());
    if (!matchedSub) {
      matchedSub = {
        id: 'sub_' + Date.now(),
        name: finalSubName,
        code: finalSubCode,
        faculty: faculty || 'Instructor',
        classroom: room || 'Lecture Hall',
        credits: 3,
        color: '#2563EB',
        targetAttendance: state.defaultAttendanceTarget || 75,
        attended: 0,
        total: 0
      };
      state.subjects.push(matchedSub);
    }
    finalSubjectId = matchedSub.id;
    finalColor = matchedSub.color || '#2563EB';
    if (!room) room = matchedSub.classroom || 'Lecture Hall';
    if (!faculty) faculty = matchedSub.faculty || 'Instructor';
  } else {
    const selectedSub = state.subjects.find(s => s.id === subjectId);
    if (selectedSub) {
      finalSubName = selectedSub.name;
      finalSubCode = selectedSub.code;
      finalColor = selectedSub.color || '#2563EB';
      if (!room) room = selectedSub.classroom || 'Lecture Hall';
      if (!faculty) faculty = selectedSub.faculty || 'Instructor';
    } else {
      if (!room) room = 'Lecture Hall';
      if (!faculty) faculty = 'Instructor';
    }
  }

  // 1. Immediately create local slot
  const newSlot = {
    id: 'tt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    subjectId: finalSubjectId,
    subjectName: finalSubName,
    subjectCode: finalSubCode,
    day,
    periodNumber: periodNum,
    startTime,
    endTime,
    classroom: room,
    faculty,
    color: finalColor,
    status: 'pending'
  };

  state.timetable.push(newSlot);
  persistOfflineImmediately();
  syncCloudAndLocal(true);

  closeModal('modal-add-slot');
  state.selectedSheetDay = day;
  selectDailySheetDay(day);
  recalculateLocalAttendance();
  renderDailyAttendanceSheet();
  renderTimetableMatrix();
  renderDashboard();
  if (window.showToast) window.showToast(`Class scheduled for ${day} successfully!`, 'success');

  // 2. Dispatch to API / Cloud in background
  try {
    const res = await API.createTimetableSlot({
      subjectId: finalSubjectId,
      customSubjectName,
      customSubjectCode,
      day,
      periodNumber: periodNum,
      startTime,
      endTime,
      classroom: room,
      faculty
    });
    if (res && res.slot && res.slot.id) {
      newSlot.id = res.slot.id;
      persistOfflineImmediately();
      syncCloudAndLocal(true);
    }
  } catch (err) {
    console.warn('Class slot saved locally; queued for cloud sync:', err.message);
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

  const res = await API.updateProfile({
    name,
    college,
    semester,
    major,
    studentId,
    avatar: state.user?.profile?.avatar
  });
  state.user = res.user;
  renderUserProfile(res.user);
  syncCloudAndLocal(true);
  alert('Profile changes saved successfully!');
}




// -------------------------------------------------------------
// PROFILE PICTURE & DATA MANAGEMENT HELPERS
// -------------------------------------------------------------

async function handleAvatarFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    alert('Image file is too large. Please select an image under 10MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const prevEl = document.getElementById('settings-avatar-preview');
    if (prevEl) prevEl.src = dataUrl;
    const topEl = document.getElementById('top-student-avatar');
    if (topEl) topEl.src = dataUrl;

    try {
      const res = await API.uploadAvatar(file);
      const newUrl = (res && res.avatarUrl) ? res.avatarUrl : dataUrl;
      if (!state.user.profile) state.user.profile = {};
      state.user.profile.avatar = newUrl;
      renderUserProfile(state.user);
      syncCloudAndLocal(true);
      alert('Profile picture uploaded and saved successfully!');
    } catch(err) {
      console.warn('Upload fallback to data URL:', err.message);
      const res = await API.updateProfile({ avatar: dataUrl });
      state.user = res.user;
      renderUserProfile(res.user);
      syncCloudAndLocal(true);
      alert('Profile picture saved successfully!');
    }
  };
  reader.readAsDataURL(file);
}

async function promptAvatarUrl() {
  const url = prompt('Enter public image URL for your profile avatar:');
  if (!url || !url.trim()) return;
  try {
    const res = await API.updateProfile({ avatar: url.trim() });
    state.user = res.user;
    renderUserProfile(res.user);
    syncCloudAndLocal(true);
    alert('Profile picture updated successfully!');
  } catch(err) {
    alert('Failed to update avatar: ' + err.message);
  }
}

async function resetToInitialAvatar() {
  if (!state.user) return;
  const name = state.user.profile?.name || 'Student';
  const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
  try {
    const res = await API.updateProfile({ avatar: defaultAvatar });
    state.user = res.user;
    renderUserProfile(res.user);
    syncCloudAndLocal(true);
    alert('Profile picture reset to initials.');
  } catch(err) {
    alert('Failed to reset avatar: ' + err.message);
  }
}

function updateCloudSyncStatusBadge() {
  const badge = document.getElementById('cloud-sync-status-badge');
  const notice = document.getElementById('firestore-rules-notice');
  if (!badge) return;

  if (window.FirebaseSync) {
    const status = window.FirebaseSync.getStatus();
    if (status.lastSyncStatus && status.lastSyncStatus.success === true) {
      badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0 flex items-center gap-1.5';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span><span>Cloud & Offline Synced</span>';
      if (notice) notice.classList.add('hidden');
    } else if (status.lastSyncStatus && status.lastSyncStatus.error) {
      const err = status.lastSyncStatus.error;
      badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0 flex items-center gap-1.5';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-blue-500"></span><span>Offline Storage Active</span>';
      if (notice && err.includes('permission')) {
        notice.classList.remove('hidden');
      }
    } else if (status.available) {
      badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0 flex items-center gap-1.5';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span><span>Cloud Connected</span>';
    } else {
      badge.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20 shrink-0 flex items-center gap-1.5';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-400"></span><span>Offline Only</span>';
    }
  }
}

window.addEventListener('cloud-sync-status', () => {
  updateCloudSyncStatusBadge();
});

async function manualSyncToCloud() {
  if (!state.user) return;
  syncCloudAndLocal(true);
  alert('Sync initiated! Data saved to offline storage and cloud.');
}

async function manualRestoreFromCloud() {
  if (!state.user) return;
  try {
    let backupData = null;
    if (window.FirebaseSync) {
      backupData = await window.FirebaseSync.loadUserData(state.user.id);
    }
    if (!backupData) {
      const storageKey = `college_os_backup_${state.user.email.toLowerCase()}`;
      const localCache = localStorage.getItem(storageKey) || localStorage.getItem(`college_os_backup_${state.user.email}`);
      if (localCache) backupData = JSON.parse(localCache);
    }
    if (backupData) {
      await API.restoreCloudData(backupData);
      await refreshAllData();
      alert('Workspace successfully restored from backup!');
    } else {
      alert('No previous backup found.');
    }
  } catch(err) {
    alert('Restore failed: ' + err.message);
  }
}

function exportDataBackupJson() {
  if (!state.user) return;
  const exportData = {
    profile: state.user.profile,
    preferences: state.user.preferences,
    subjects: state.subjects,
    timetable: state.timetable,
    attendanceData: state.attendanceData,
    periodAttendance: state.periodAttendanceRecords,
    tasks: state.tasks,
    labs: state.labs,
    studyPlans: state.studyPlans,
    studySessions: state.studySessions,
    vaultFolders: state.vaultFolders,
    vaultFiles: state.vaultFiles,
    calendarEvents: state.calendarEvents,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `college_os_backup_${state.user.email.split('@')[0]}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importDataBackupJson(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.subjects && !data.timetable && !data.profile) {
      throw new Error('Invalid backup file format.');
    }
    await API.restoreCloudData(data);
    await refreshAllData();
    syncCloudAndLocal(true);
    alert('Workspace backup successfully imported and restored!');
  } catch(err) {
    alert('Failed to import backup: ' + err.message);
  }
  event.target.value = '';
}

// -------------------------------------------------------------
// COURSE SUBJECTS CATALOG (SETTINGS & TIMETABLE MASTER)
// -------------------------------------------------------------

function renderSettingsSubjects() {
  const container = document.getElementById('settings-subjects-list');
  if (!container) return;

  if (!state.subjects || state.subjects.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 text-center text-xs text-slate-400 font-inter border-2 border-dashed theme-border rounded-3xl flex flex-col items-center justify-center gap-3">
        <span class="material-symbols-outlined text-4xl text-blue-500">menu_book</span>
        <div>
          <h4 class="font-bold text-sm text-slate-700 dark:text-slate-200">No Course Subjects Added Yet</h4>
          <p class="text-xs text-slate-500 mt-1">Add all your semester courses here once. They will appear in your Timetable to schedule on each day.</p>
        </div>
        <button onclick="openAddSubjectModal()" class="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs hover:bg-blue-700 transition">
          + Add Your First Course Subject
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.subjects.map(sub => {
    const color = sub.color || '#2563EB';
    const attended = sub.attended || 0;
    const total = sub.total || 0;
    const pct = total > 0 ? ((attended / total) * 100).toFixed(1) : '100.0';
    const target = sub.targetAttendance || 75;
    const isAtRisk = total > 0 && Number(pct) < target;

    return `
      <div class="theme-card p-5 rounded-2xl border theme-border shadow-xs hover:border-blue-500/30 transition flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3.5 rounded-full ring-2 ring-white/20" style="background: ${color}"></span>
              <span class="text-xs font-mono font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">${sub.code}</span>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="openAddSubjectModal('${sub.id}')" title="Edit Subject" class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition">
                <span class="material-symbols-outlined text-base">edit</span>
              </button>
              <button onclick="deleteSubject('${sub.id}')" title="Delete Subject" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
                <span class="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          </div>
          <h3 class="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1">${sub.name}</h3>
          <div class="space-y-1 font-inter text-xs text-slate-500">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[15px] text-slate-400">person</span>
              <span>${sub.faculty || 'Instructor TBD'}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[15px] text-slate-400">location_on</span>
              <span>${sub.classroom || 'Main Lecture Hall'}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[15px] text-slate-400">school</span>
              <span>${sub.credits || 3} Credits • Target: ${target}%</span>
            </div>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t theme-border">
          <div class="flex items-center justify-between text-xs font-inter mb-1.5">
            <span class="text-slate-500">Attendance:</span>
            <span class="font-bold ${isAtRisk ? 'text-red-600' : 'text-emerald-600'}">${attended}/${total} hrs (${pct}%)</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div class="${isAtRisk ? 'bg-red-500' : 'bg-emerald-500'} h-full rounded-full transition-all" style="width: ${Math.min(100, Number(pct))}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddSubjectModal(subjectId = null) {
  const form = document.querySelector('#modal-add-subject form');
  if (form) form.reset();

  const titleEl = document.getElementById('modal-subject-title');
  const btnEl = document.getElementById('btn-save-subject-modal');
  const idInput = document.getElementById('subject-input-id');

  if (subjectId) {
    const sub = state.subjects.find(s => s.id === subjectId);
    if (sub) {
      if (titleEl) titleEl.textContent = 'Edit Course Subject';
      if (btnEl) btnEl.textContent = 'Update Subject';
      if (idInput) idInput.value = sub.id;
      document.getElementById('subject-input-name').value = sub.name || '';
      document.getElementById('subject-input-code').value = sub.code || '';
      document.getElementById('subject-input-credits').value = sub.credits || 3;
      document.getElementById('subject-input-faculty').value = sub.faculty || '';
      document.getElementById('subject-input-classroom').value = sub.classroom || '';
      document.getElementById('subject-input-target').value = sub.targetAttendance || 75;
      document.getElementById('subject-input-color').value = sub.color || '#2563EB';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Add Course Subject';
    if (btnEl) btnEl.textContent = 'Save Subject to Catalog';
    if (idInput) idInput.value = '';
    document.getElementById('subject-input-credits').value = 4;
    document.getElementById('subject-input-target').value = 75;
    document.getElementById('subject-input-color').value = '#2563EB';
  }

  openModal('modal-add-subject');
}

async function handleSaveSubjectForm(e) {
  e.preventDefault();
  const id = document.getElementById('subject-input-id').value;
  const name = document.getElementById('subject-input-name').value.trim();
  const code = document.getElementById('subject-input-code').value.trim();
  const credits = Number(document.getElementById('subject-input-credits').value) || 3;
  const faculty = document.getElementById('subject-input-faculty').value.trim() || 'Instructor';
  const classroom = document.getElementById('subject-input-classroom').value.trim() || 'Lecture Hall';
  const targetAttendance = Number(document.getElementById('subject-input-target').value) || 75;
  const color = document.getElementById('subject-input-color').value || '#2563EB';

  if (!name || !code) {
    alert('Subject Name and Code are required.');
    return;
  }

  const payload = { name, code, credits, faculty, classroom, targetAttendance, color };

  if (id) {
    // 1. Update in local state immediately (offline support!)
    const idx = state.subjects.findIndex(s => s.id === id);
    if (idx !== -1) {
      state.subjects[idx] = { ...state.subjects[idx], ...payload };
    }
    // Also update any timetable slots with this subject
    state.timetable.forEach(t => {
      if (t.subjectId === id) {
        t.subjectName = name;
        t.subjectCode = code;
        t.color = color;
      }
    });
    persistOfflineImmediately();

    try {
      await API.updateSubject(id, payload);
    } catch(err) {
      console.warn('Subject update queued offline:', err.message);
    }
  } else {
    // 1. Create new subject locally immediately
    const newSub = {
      id: 'sub_' + Date.now(),
      ...payload,
      attended: 0,
      total: 0
    };
    state.subjects.push(newSub);
    persistOfflineImmediately();

    try {
      const res = await API.createSubject(payload);
      if (res && res.subject) {
        newSub.id = res.subject.id;
      }
    } catch(err) {
      console.warn('Subject creation queued offline:', err.message);
    }
  }

  closeModal('modal-add-subject');
  populateSubjectSelects();
  recalculateLocalAttendance();
  persistOfflineImmediately();
  syncCloudAndLocal();

  renderSettingsSubjects();
  renderDailyAttendanceSheet();
  renderTimetableMatrix();
  renderDashboard();
  renderAttendanceAnalytics();
  alert(id ? 'Course subject updated successfully!' : 'Course subject added to catalog!');
}

async function deleteSubject(subjectId) {
  if (!confirm('Are you sure you want to remove this subject? Associated timetable classes and attendance marks will also be removed.')) return;

  // 1. Remove locally immediately (100% offline support!)
  state.subjects = state.subjects.filter(s => s.id !== subjectId);
  state.timetable = state.timetable.filter(t => t.subjectId !== subjectId);
  
  // Clean attendance records
  Object.keys(state.periodAttendanceRecords || {}).forEach(key => {
    if (key.includes(`_${subjectId}_period_`)) {
      delete state.periodAttendanceRecords[key];
    }
  });

  populateSubjectSelects();
  recalculateLocalAttendance();
  persistOfflineImmediately();

  try {
    await API.deleteSubject(subjectId);
  } catch(err) {
    console.warn('Subject deletion queued offline:', err.message);
  }

  syncCloudAndLocal();
  renderSettingsSubjects();
  renderDailyAttendanceSheet();
  renderTimetableMatrix();
  renderDashboard();
  renderAttendanceAnalytics();
}

function openAddSlotForActiveDay(targetDay) {
  const day = targetDay || state.selectedSheetDay || 'Monday';
  state.selectedSheetDay = day;
  const daySelect = document.getElementById('slot-input-day');
  if (daySelect) daySelect.value = day;

  populateSubjectSelects();

  // Find next period on that day
  const daySlots = (state.timetable || []).filter(s => (s.day || '').toLowerCase() === day.toLowerCase());
  const maxPeriod = daySlots.reduce((max, s) => Math.max(max, Number(s.periodNumber) || 0), 0);
  const nextPeriod = maxPeriod + 1;
  const periodInput = document.getElementById('slot-input-period');
  if (periodInput) periodInput.value = nextPeriod;

  // Auto timings for period
  const defaultTimes = {
    1: ['08:30', '09:30'],
    2: ['09:30', '10:30'],
    3: ['10:45', '11:45'],
    4: ['11:45', '12:45'],
    5: ['13:30', '14:30'],
    6: ['14:30', '15:30'],
    7: ['15:30', '16:30'],
    8: ['16:30', '17:30']
  };
  const times = defaultTimes[nextPeriod] || ['09:00', '10:00'];
  const startInput = document.getElementById('slot-input-start-time');
  const endInput = document.getElementById('slot-input-end-time');
  if (startInput) startInput.value = times[0];
  if (endInput) endInput.value = times[1];

  const subjSelect = document.getElementById('slot-input-subject');
  if (subjSelect) {
    if (state.subjects && state.subjects.length > 0) {
      if (!subjSelect.value || subjSelect.value === 'CUSTOM') {
        subjSelect.value = state.subjects[0].id;
      }
      const curSub = state.subjects.find(s => s.id === subjSelect.value);
      if (curSub) {
        const roomInput = document.getElementById('slot-input-room');
        const facInput = document.getElementById('slot-input-faculty');
        if (roomInput) roomInput.value = curSub.classroom || '';
        if (facInput) facInput.value = curSub.faculty || '';
      }
    }
    toggleCustomSlotSubject(subjSelect.value);
  }

  openModal('modal-add-slot');
}
