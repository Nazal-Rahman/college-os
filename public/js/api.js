// College OS API Client with Offline-First Local Storage

const API = {
  getToken() {
    return localStorage.getItem('college_os_token');
  },
  setToken(token) {
    if (token) localStorage.setItem('college_os_token', token);
    else localStorage.removeItem('college_os_token');
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('college_os_user') || 'null');
    } catch (e) {
      return null;
    }
  },
  setUser(user) {
    if (user) localStorage.setItem('college_os_user', JSON.stringify(user));
    else localStorage.removeItem('college_os_user');
  },
  logout() {
    this.setToken(null);
    this.setUser(null);
    window.location.href = '/';
  },

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(endpoint, { ...options, headers });
      if (res.status === 401) {
        // Token expired or invalid
        if (window.location.pathname.startsWith('/app')) {
          this.setToken(null);
          this.setUser(null);
          window.location.href = '/';
        }
        throw new Error('Unauthorized');
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    } catch (err) {
      // Offline fallback queueing for POST / PUT / DELETE
      if (!navigator.onLine && options.method && options.method !== 'GET') {
        this.queueOfflineAction(endpoint, options);
        if (window.showToast) window.showToast('Offline: Action queued for cloud sync.', 'info');
        return { offline: true, success: true };
      }
      throw err;
    }
  },

  queueOfflineAction(endpoint, options) {
    const queue = JSON.parse(localStorage.getItem('college_os_offline_queue') || '[]');
    queue.push({ endpoint, options, timestamp: Date.now() });
    localStorage.setItem('college_os_offline_queue', JSON.stringify(queue));
  },

  async syncOfflineQueue() {
    const raw = localStorage.getItem('college_os_offline_queue');
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (!queue.length) return;

    try {
      await this.request('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ actions: queue })
      });
      localStorage.removeItem('college_os_offline_queue');
      console.log(`[Sync] ${queue.length} offline actions synchronized.`);
    } catch (e) {
      console.warn('[Sync] Offline queue sync pending:', e.message);
    }
  },

  // Auth Methods
  async login(email, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(res.token);
    this.setUser(res.user);
    return res;
  },

  async register(data) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.token);
    this.setUser(res.user);
    return res;
  },

  async demoLogin() {
    const res = await this.request('/api/auth/demo', { method: 'POST' });
    this.setToken(res.token);
    this.setUser(res.user);
    return res;
  },

  async getMe() {
    const res = await this.request('/api/auth/me');
    this.setUser(res.user);
    return res.user;
  },

  async updateProfile(profile) {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profile)
    });
  },

  async firebaseLogin(firebaseUser) {
    const res = await this.request('/api/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({
        email: firebaseUser.email,
        uid: firebaseUser.uid,
        name: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL
      })
    });
    this.setToken(res.token);
    this.setUser(res.user);
    return res;
  },

  async restoreCloudData(data) {
    return this.request('/api/sync/restore', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Subjects
  getSubjects() { return this.request('/api/subjects'); },
  createSubject(data) { return this.request('/api/subjects', { method: 'POST', body: JSON.stringify(data) }); },
  deleteSubject(id) { return this.request(`/api/subjects/${id}`, { method: 'DELETE' }); },

  // Timetable
  getTimetable(day) { return this.request(`/api/timetable${day ? '?day=' + day : ''}`); },
  createTimetableSlot(data) { return this.request('/api/timetable', { method: 'POST', body: JSON.stringify(data) }); },
  deleteTimetableSlot(id) { return this.request(`/api/timetable/${id}`, { method: 'DELETE' }); },
  clearTimetableAll() { return this.request('/api/timetable/clear-all', { method: 'POST' }); },
  toggleHolidayDay(day) { return this.request('/api/timetable/toggle-holiday', { method: 'POST', body: JSON.stringify({ day }) }); },

  // Attendance
  getAttendance() { return this.request('/api/attendance'); },
  markAttendance(data) { return this.request('/api/attendance/mark', { method: 'POST', body: JSON.stringify(data) }); },
  markPeriod(data) { return this.request('/api/attendance/mark-period', { method: 'POST', body: JSON.stringify(data) }); },
  getSubjectHistory(subjectId) { return this.request(`/api/attendance/subject-history/${subjectId}`); },
  updateHistoryRecord(recordId, status) { return this.request(`/api/attendance/history/${recordId}`, { method: 'PUT', body: JSON.stringify({ status }) }); },
  setAttendanceTargetSettings(data) { return this.request('/api/attendance/target-settings', { method: 'POST', body: JSON.stringify(data) }); },
  setAttendanceTarget(subjectId, target) { return this.request(`/api/attendance/target/${subjectId}`, { method: 'PUT', body: JSON.stringify({ target }) }); },

  // Tasks & Homework
  getTasks(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/tasks${q ? '?' + q : ''}`);
  },
  createTask(data) { return this.request('/api/tasks', { method: 'POST', body: JSON.stringify(data) }); },
  toggleTask(id) { return this.request(`/api/tasks/${id}/toggle`, { method: 'POST' }); },
  deleteTask(id) { return this.request(`/api/tasks/${id}`, { method: 'DELETE' }); },

  // Labs
  getLabs() { return this.request('/api/labs'); },
  createLab(data) { return this.request('/api/labs', { method: 'POST', body: JSON.stringify(data) }); },
  deleteLab(id) { return this.request(`/api/labs/${id}`, { method: 'DELETE' }); },

  // Study & Focus Timer
  getStudyPlans() { return this.request('/api/study/plans'); },
  createStudyPlan(data) { return this.request('/api/study/plans', { method: 'POST', body: JSON.stringify(data) }); },
  deleteStudyPlan(id) { return this.request(`/api/study/plans/${id}`, { method: 'DELETE' }); },
  getStudySessions() { return this.request('/api/study/sessions'); },
  logStudySession(data) { return this.request('/api/study/sessions', { method: 'POST', body: JSON.stringify(data) }); },
  deleteStudySession(id) { return this.request(`/api/study/sessions/${id}`, { method: 'DELETE' }); },
  clearAllStudySessions() { return this.request('/api/study/sessions', { method: 'DELETE' }); },

  // Grades (SGPA/CGPA)
  getGrades() { return this.request('/api/grades'); },
  calculateSgpa(courses, scale) { return this.request('/api/grades/calculate', { method: 'POST', body: JSON.stringify({ courses, scale }) }); },
  saveSemester(data) { return this.request('/api/grades/save-semester', { method: 'POST', body: JSON.stringify(data) }); },
  saveSemesterGrade(data) { return this.saveSemester(data); },

  // Vault & Scanner
  getFolders() { return this.request('/api/vault/folders'); },
  createFolder(data) { return this.request('/api/vault/folders', { method: 'POST', body: JSON.stringify(data) }); },
  getFiles(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/vault/files${q ? '?' + q : ''}`);
  },
  uploadFile(formData) { return this.request('/api/vault/upload', { method: 'POST', body: formData }); },
  saveScannedDoc(data) { return this.request('/api/vault/scanner/save', { method: 'POST', body: JSON.stringify(data) }); },
  deleteFile(id, permanent = false) { return this.request(`/api/vault/files/${id}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' }); },
  restoreFile(id) { return this.request(`/api/vault/files/${id}/restore`, { method: 'POST' }); },

  // Calendar
  getCalendar() { return this.request('/api/calendar'); },
  getCalendarPdf() { return this.request('/api/calendar/pdf'); },
  uploadCalendarPdf(formData) { return this.request('/api/calendar/upload-pdf', { method: 'POST', body: formData }); },
  deleteCalendarPdf() { return this.request('/api/calendar/pdf', { method: 'DELETE' }); },
  createCalendarEvent(data) { return this.request('/api/calendar/event', { method: 'POST', body: JSON.stringify(data) }); },
  updateCalendarEvent(id, data) { return this.request(`/api/calendar/event/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  deleteCalendarEvent(id) { return this.request(`/api/calendar/${id}`, { method: 'DELETE' }); },

  // Global Search
  search(q) { return this.request(`/api/search?q=${encodeURIComponent(q)}`); },

  // Notifications
  getNotifications() { return this.request('/api/notifications'); },
  readNotification(id) { return this.request(`/api/notifications/${id}/read`, { method: 'POST' }); },
  readAllNotifications() { return this.request('/api/notifications/read-all', { method: 'POST' }); },

  // Factory Reset
  factoryReset() { return this.request('/api/auth/factory-reset', { method: 'POST' }); }
};

window.API = API;
window.syncOfflineQueue = () => API.syncOfflineQueue();
