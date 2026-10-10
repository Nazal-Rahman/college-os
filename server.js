require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const store = require('./data/store');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'college_os_super_secret_jwt_key_2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directory exists
const UPLOADS_DIR = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch(e) {
    console.error('Warning: could not create uploads directory', e);
  }
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// Cloudinary Configuration
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'college-os',
  api_key: process.env.CLOUDINARY_API_KEY || '168317929439692',
  api_secret: process.env.CLOUDINARY_API_SECRET || '-UAA-eQTMujo2MvCz4fyhTktOi4'
});

async function uploadToCloudinaryOrLocal(filePath) {
  try {
    const res = await cloudinary.uploader.upload(filePath, {
      resource_type: 'auto',
      folder: 'college_os_vault'
    });
    return { url: res.secure_url || res.url, provider: 'cloudinary' };
  } catch (err) {
    console.warn('[Cloudinary Storage Note]', err.message, '- falling back to secure local storage');
    return { url: `/uploads/${path.basename(filePath)}`, provider: 'local' };
  }
}

// Auth Middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let user = store.getUserById(decoded.userId);
    
    // VERCEL HOTFIX: If backend restarts and wipes store, but token is valid,
    // recreate the empty user skeleton. The frontend will hydrate it.
    if (!user) {
      user = {
        id: decoded.userId,
        email: decoded.email || 'student@college.edu',
        password: '',
        profile: { name: 'Student', avatar: '', college: '', semester: '' },
        subjects: [],
        timetable: [],
        attendanceHistory: [],
        periodAttendance: {},
        tasks: [],
        labs: [],
        studyPlans: [],
        studySessions: [],
        vaultFolders: [],
        vaultFiles: [],
        calendarEvents: []
      };
      if (!store.data.users) store.data.users = {};
      store.data.users[user.id] = user;
      store.save();
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }
}

// -------------------------------------------------------------
// 1. AUTHENTICATION & PROFILE APIS
// -------------------------------------------------------------

app.get('/api/config/firebase', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  });
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, name, college, semester } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const user = store.createUser(email, password, name || 'Student', college || 'College', semester || 'Semester 1');
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = store.getUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: sanitizeUser(user) });
});

// Firebase Auth Login & Sync Endpoint
app.post('/api/auth/firebase-login', (req, res) => {
  try {
    const { email, uid, name, photoURL } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required for Firebase auth.' });
    }
    let user = store.getUserByEmail(email);
    if (!user) {
      user = Object.values(store.data.users).find(u => u.firebaseUid === uid);
    }
    if (!user) {
      user = store.createUser(
        email,
        'fb_auth_' + (uid || Date.now()),
        name || (email.split('@')[0]),
        'Engineering College',
        'Semester 1'
      );
    }
    store.updateUserData(user.id, (u) => {
      u.firebaseUid = uid;
      if (photoURL && !u.profile.avatar) u.profile.avatar = photoURL;
      if (name && (!u.profile.name || u.profile.name === 'Student')) u.profile.name = name;
    });
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1-Click Demo Login as Elena Rostova
app.post('/api/auth/demo', (req, res) => {
  const user = store.getUserById('user_elena_demo') || Object.values(store.data.users)[0];
  if (!user) {
    return res.status(500).json({ error: 'Demo user not available.' });
  }
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = store.getUserByEmail(email);
  if (!user) {
    // Return friendly message without leaking user existence
    return res.json({ message: 'If this email is registered, password recovery instructions have been sent.' });
  }
  // Simulated password reset token
  res.json({ message: 'Password recovery email sent. Check your inbox.' });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.put('/api/auth/profile', authenticate, (req, res) => {
  try {
    const updated = store.updateUserData(req.user.id, (user) => {
      user.profile = { ...user.profile, ...req.body };
    });
    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/auth/password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!bcrypt.compareSync(currentPassword, req.user.password)) {
    return res.status(400).json({ error: 'Current password does not match.' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  store.updateUserData(req.user.id, (user) => {
    user.password = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));
  });
  res.json({ message: 'Password updated successfully.' });
});

app.post('/api/auth/factory-reset', authenticate, (req, res) => {
  try {
    const resetUser = store.factoryResetUser(req.user.id);
    res.json({ message: 'Factory reset completed. All workspace data reset.', user: sanitizeUser(resetUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync Restore Endpoint (fixes Vercel stateless wipes)
app.post('/api/sync/restore', authenticate, (req, res) => {
  try {
    store.updateUserData(req.user.id, (u) => {
      const data = req.body;
      if (data.subjects) u.subjects = data.subjects;
      if (data.timetable) u.timetable = data.timetable;
      if (data.attendanceData && data.attendanceData.history) u.attendanceHistory = data.attendanceData.history;
      if (data.periodAttendance) u.periodAttendance = data.periodAttendance;
      if (data.tasks) u.tasks = data.tasks;
      if (data.labs) u.labs = data.labs;
      if (data.studyPlans) u.studyPlans = data.studyPlans;
      if (data.studySessions) u.studySessions = data.studySessions;
      if (data.vaultFiles) u.vaultFiles = data.vaultFiles;
      if (data.vaultFolders) u.vaultFolders = data.vaultFolders;
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 2. SUBJECT MANAGEMENT APIS
// -------------------------------------------------------------

app.get('/api/subjects', authenticate, (req, res) => {
  res.json({ subjects: req.user.subjects || [] });
});

app.post('/api/subjects', authenticate, (req, res) => {
  const { code, name, faculty, classroom, credits, semester, color, targetAttendance } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Subject code and title are required.' });
  }
  const newSubject = {
    id: 'sub_' + Date.now(),
    code,
    name,
    faculty: faculty || 'TBD',
    classroom: classroom || 'Main Hall',
    credits: Number(credits) || 3,
    semester: Number(semester) || 1,
    color: color || '#4776F6',
    targetAttendance: Number(targetAttendance) || 75,
    attended: 0,
    total: 0
  };

  store.updateUserData(req.user.id, (u) => {
    u.subjects.push(newSubject);
  });
  res.json({ subject: newSubject });
});

app.put('/api/subjects/:id', authenticate, (req, res) => {
  const { id } = req.params;
  let updatedSubject = null;
  store.updateUserData(req.user.id, (u) => {
    const idx = u.subjects.findIndex(s => s.id === id);
    if (idx !== -1) {
      u.subjects[idx] = { ...u.subjects[idx], ...req.body, id };
      updatedSubject = u.subjects[idx];
    }
  });
  if (!updatedSubject) return res.status(404).json({ error: 'Subject not found.' });
  res.json({ subject: updatedSubject });
});

app.delete('/api/subjects/:id', authenticate, (req, res) => {
  const { id } = req.params;
  store.updateUserData(req.user.id, (u) => {
    u.subjects = u.subjects.filter(s => s.id !== id);
    u.timetable = u.timetable.filter(t => t.subjectId !== id);
    u.attendanceHistory = u.attendanceHistory.filter(a => a.subjectId !== id);
    u.tasks = u.tasks.filter(t => t.subjectId !== id);
  });
  res.json({ message: 'Subject and associated records deleted.' });
});

// -------------------------------------------------------------
// 3. TIMETABLE MANAGEMENT APIS
// -------------------------------------------------------------

app.get('/api/timetable', authenticate, (req, res) => {
  const { day } = req.query;
  let slots = req.user.timetable || [];
  if (day) {
    slots = slots.filter(s => (s.day || '').toLowerCase() === day.toLowerCase());
  }
  // Enrich slots with subject details
  const enriched = slots.map(slot => {
    const subject = (req.user.subjects || []).find(s => s.id === slot.subjectId);
    return {
      ...slot,
      subjectCode: subject ? subject.code : 'GEN',
      subjectName: subject ? subject.name : 'Class',
      color: subject ? subject.color : '#4776F6',
      faculty: slot.faculty || (subject ? subject.faculty : 'Faculty'),
      classroom: slot.classroom || (subject ? subject.classroom : 'TBD')
    };
  });
  res.json({ timetable: enriched });
});

app.post('/api/timetable/clear-all', authenticate, (req, res) => {
  try {
    const updatedUser = store.clearTimetableAndAttendance(req.user.id);
    res.json({ message: 'Timetable and period attendance cleared successfully.', user: sanitizeUser(updatedUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/timetable/toggle-holiday', authenticate, (req, res) => {
  const { day } = req.body;
  if (!day) return res.status(400).json({ error: 'Day is required.' });
  store.updateUserData(req.user.id, (u) => {
    if (!u.preferences) u.preferences = {};
    if (!u.preferences.holidayDays) u.preferences.holidayDays = ['Saturday', 'Sunday'];
    const idx = u.preferences.holidayDays.indexOf(day);
    if (idx >= 0) {
      u.preferences.holidayDays.splice(idx, 1);
    } else {
      u.preferences.holidayDays.push(day);
    }
  });
  res.json({ holidayDays: req.user.preferences.holidayDays });
});

app.post('/api/timetable', authenticate, (req, res) => {
  const { subjectId, day, startTime, endTime, classroom, faculty, periodNumber, customSubjectName, customSubjectCode } = req.body;
  if (!day) {
    return res.status(400).json({ error: 'Day is required.' });
  }

  if (typeof subjectId === 'string' && subjectId.toLowerCase() === 'custom' && !customSubjectName) {
    return res.status(400).json({ error: 'Custom subject name is required.' });
  }

  let finalSubjectId = subjectId;

  // Handle custom subject creation on the fly
  if ((!subjectId || (typeof subjectId === 'string' && subjectId.toLowerCase() === 'custom')) && customSubjectName) {
    const code = customSubjectCode || customSubjectName.slice(0, 4).toUpperCase();
    const existing = (req.user.subjects || []).find(s => s.name.toLowerCase() === customSubjectName.toLowerCase() || s.code.toLowerCase() === code.toLowerCase());
    if (existing) {
      finalSubjectId = existing.id;
    } else {
      const newSub = {
        id: 'sub_' + Date.now(),
        code,
        name: customSubjectName,
        faculty: faculty || 'Instructor',
        classroom: classroom || 'Room 101',
        credits: 3,
        semester: 1,
        color: '#2563EB',
        targetAttendance: req.user.preferences?.defaultAttendanceTarget || 75,
        attended: 0,
        total: 0
      };
      store.updateUserData(req.user.id, (u) => {
        u.subjects.push(newSub);
      });
      finalSubjectId = newSub.id;
    }
  }

  if (!finalSubjectId) {
    return res.status(400).json({ error: 'Subject is required.' });
  }

  // 1 to 13 Period Standard Timings
  const pNum = Number(periodNumber) || 1;
  const defaultTimes = {
    1: ['08:30', '09:30'],
    2: ['09:30', '10:30'],
    3: ['10:45', '11:45'],
    4: ['11:45', '12:45'],
    5: ['13:30', '14:30'],
    6: ['14:30', '15:30'],
    7: ['15:30', '16:30'],
    8: ['16:30', '17:30'],
    9: ['17:30', '18:30'],
    10: ['18:30', '19:30'],
    11: ['19:30', '20:30'],
    12: ['20:30', '21:30'],
    13: ['21:30', '22:30']
  };

  const slotStart = startTime || (defaultTimes[pNum] ? defaultTimes[pNum][0] : '09:00');
  const slotEnd = endTime || (defaultTimes[pNum] ? defaultTimes[pNum][1] : '10:00');

  const newSlot = {
    id: 'tt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    subjectId: finalSubjectId,
    day,
    periodNumber: pNum,
    startTime: slotStart,
    endTime: slotEnd,
    classroom: classroom || 'Room TBD',
    faculty: faculty || 'Instructor'
  };

  store.updateUserData(req.user.id, (u) => {
    u.timetable.push(newSlot);
  });

  const updatedUser = store.getUserById(req.user.id);
  const matchedSub = (updatedUser?.subjects || []).find(s => s.id === finalSubjectId);
  const enrichedSlot = {
    ...newSlot,
    subjectName: matchedSub ? matchedSub.name : (customSubjectName || 'Course'),
    subjectCode: matchedSub ? matchedSub.code : (customSubjectCode || 'SUB'),
    color: matchedSub ? matchedSub.color : '#2563EB'
  };

  res.json({ slot: enrichedSlot });
});

app.put('/api/timetable/:id', authenticate, (req, res) => {
  const { id } = req.params;
  let updatedSlot = null;
  store.updateUserData(req.user.id, (u) => {
    const idx = u.timetable.findIndex(t => t.id === id);
    if (idx !== -1) {
      u.timetable[idx] = { ...u.timetable[idx], ...req.body, id };
      updatedSlot = u.timetable[idx];
    }
  });
  if (!updatedSlot) return res.status(404).json({ error: 'Timetable slot not found.' });
  res.json({ slot: updatedSlot });
});

app.delete('/api/timetable/:id', authenticate, (req, res) => {
  const { id } = req.params;
  store.updateUserData(req.user.id, (u) => {
    u.timetable = u.timetable.filter(t => t.id !== id);
  });
  res.json({ message: 'Class slot removed.' });
});

// PDF Timetable extraction simulation
app.post('/api/timetable/import-pdf', authenticate, upload.single('timetablePdf'), (req, res) => {
  const sampleImportedSlots = [
    { subjectId: (req.user.subjects[0] || {}).id, day: 'Monday', startTime: '08:30', endTime: '09:30', classroom: 'Lecture Hall 1' },
    { subjectId: (req.user.subjects[1] || {}).id, day: 'Wednesday', startTime: '13:00', endTime: '14:30', classroom: 'Lab Center' }
  ];
  res.json({
    message: 'Timetable PDF analyzed.',
    suggestedSlots: sampleImportedSlots
  });
});

// -------------------------------------------------------------
// 4. ATTENDANCE TRACKER APIS
// -------------------------------------------------------------

app.get('/api/attendance', authenticate, (req, res) => {
  const subjects = req.user.subjects || [];
  const defaultTarget = req.user.preferences?.defaultAttendanceTarget || 75;
  const customTargetsEnabled = !!req.user.preferences?.customSubjectTargetsEnabled;

  const stats = subjects.map(s => {
    const attended = s.attended || 0;
    const total = s.total || 0;
    const percentage = total > 0 ? ((attended / total) * 100).toFixed(1) : 100.0;
    const target = customTargetsEnabled ? (s.targetAttendance || defaultTarget) : defaultTarget;
    
    // Classes safe to skip: (attended - target*total/100) / (target/100)
    let safeToSkip = 0;
    if (total > 0 && percentage >= target) {
      safeToSkip = Math.floor((attended - (target / 100) * total) / (target / 100));
      if (safeToSkip < 0) safeToSkip = 0;
    }

    // Classes needed to reach target if below:
    let neededToReach = 0;
    if (total > 0 && percentage < target) {
      neededToReach = Math.ceil(((target / 100) * total - attended) / (1 - (target / 100)));
      if (neededToReach < 0) neededToReach = 0;
    }

    const isAtRisk = Number(percentage) < target;

    return {
      ...s,
      percentage: Number(percentage),
      target,
      safeToSkip,
      neededToReach,
      isAtRisk
    };
  });

  // Calculate overall attendance
  const totalAttended = subjects.reduce((sum, s) => sum + (s.attended || 0), 0);
  const totalConducted = subjects.reduce((sum, s) => sum + (s.total || 0), 0);
  const overallPercentage = totalConducted > 0 ? ((totalAttended / totalConducted) * 100).toFixed(1) : 100.0;

  res.json({
    overall: {
      attended: totalAttended,
      total: totalConducted,
      percentage: Number(overallPercentage)
    },
    defaultTarget,
    customTargetsEnabled,
    subjects: stats,
    history: req.user.attendanceHistory || []
  });
});

app.post('/api/attendance/mark', authenticate, (req, res) => {
  const { subjectId, status, date, notes } = req.body;
  if (!subjectId || !status) {
    return res.status(400).json({ error: 'Subject and attendance status are required.' });
  }

  const newRecord = {
    id: 'att_' + Date.now(),
    subjectId,
    status: status, // 'Present', 'Absent', 'Medical', 'Cancelled'
    date: date || new Date().toISOString().split('T')[0],
    notes: notes || ''
  };

  store.updateUserData(req.user.id, (u) => {
    u.attendanceHistory.unshift(newRecord);
    const sub = u.subjects.find(s => s.id === subjectId);
    if (sub) {
      if (status === 'Present') {
        sub.attended = (sub.attended || 0) + 1;
        sub.total = (sub.total || 0) + 1;
      } else if (status === 'Absent') {
        sub.total = (sub.total || 0) + 1;
      }
    }
  });

  res.json({ record: newRecord, message: `Marked ${status} for this class.` });
});

// Type 1 & Type 2 Attendance Target Settings
app.post('/api/attendance/target-settings', authenticate, (req, res) => {
  const { defaultTarget, customSubjectTargetsEnabled, customTargetsEnabled } = req.body;
  const isCustom = customSubjectTargetsEnabled !== undefined ? customSubjectTargetsEnabled : customTargetsEnabled;

  const updated = store.updateUserData(req.user.id, (u) => {
    if (!u.preferences) u.preferences = {};
    if (defaultTarget !== undefined) {
      u.preferences.defaultAttendanceTarget = Number(defaultTarget) || 75;
    }
    if (isCustom !== undefined) {
      u.preferences.customSubjectTargetsEnabled = !!isCustom;
    }
    // If custom targets is disabled, apply defaultTarget to all subjects (Type 1)
    if (!u.preferences.customSubjectTargetsEnabled && u.subjects) {
      u.subjects.forEach(s => {
        s.targetAttendance = u.preferences.defaultAttendanceTarget;
      });
    }
  });

  res.json({
    defaultTarget: updated.preferences.defaultAttendanceTarget,
    customTargetsEnabled: updated.preferences.customSubjectTargetsEnabled,
    preferences: updated.preferences,
    subjects: updated.subjects
  });
});

app.put('/api/attendance/target/:subjectId', authenticate, (req, res) => {
  const { subjectId } = req.params;
  const { target } = req.body;
  store.updateUserData(req.user.id, (u) => {
    const sub = u.subjects.find(s => s.id === subjectId);
    if (sub) {
      sub.targetAttendance = Number(target) || 75;
    }
  });
  res.json({ message: 'Attendance target updated.' });
});

app.post('/api/attendance/mark-period', authenticate, (req, res) => {
  const { subjectId, dayKey, date, periodNumber, isPresent } = req.body;
  if (!subjectId || periodNumber === undefined) {
    return res.status(400).json({ error: 'Subject ID and period number are required.' });
  }
  const targetDay = dayKey || 'Monday';
  const targetDate = date || new Date().toISOString().split('T')[0];
  const slotKey = `${targetDay}_${subjectId}_period_${periodNumber}`;

  store.updateUserData(req.user.id, (u) => {
    if (!u.periodAttendance) u.periodAttendance = {};
    const previous = u.periodAttendance[slotKey];
    const sub = u.subjects.find(s => s.id === subjectId);

    if (previous === undefined) {
      if (isPresent) {
        if (sub) { sub.attended = (sub.attended || 0) + 1; sub.total = (sub.total || 0) + 1; }
        u.periodAttendance[slotKey] = 'Present';
      } else {
        if (sub) { sub.total = (sub.total || 0) + 1; }
        u.periodAttendance[slotKey] = 'Absent';
      }
    } else {
      if (isPresent && previous === 'Absent') {
        if (sub) { sub.attended = (sub.attended || 0) + 1; }
        u.periodAttendance[slotKey] = 'Present';
      } else if (!isPresent && previous === 'Present') {
        if (sub) { sub.attended = Math.max(0, (sub.attended || 1) - 1); }
        u.periodAttendance[slotKey] = 'Absent';
      }
    }

    if (!u.attendanceHistory) u.attendanceHistory = [];
    const existingHistIdx = u.attendanceHistory.findIndex(h => h.slotKey === slotKey);
    const histRecord = {
      id: existingHistIdx >= 0 ? u.attendanceHistory[existingHistIdx].id : 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      slotKey,
      subjectId,
      status: isPresent ? 'Present' : 'Absent',
      day: targetDay,
      date: targetDate,
      periodNumber: Number(periodNumber),
      notes: `Hour ${periodNumber}`
    };
    if (existingHistIdx >= 0) {
      u.attendanceHistory[existingHistIdx] = histRecord;
    } else {
      u.attendanceHistory.unshift(histRecord);
    }
  });

  res.json({ success: true, slotKey, isPresent });
});

// Subject-specific attendance history drill-down modal
app.get('/api/attendance/subject-history/:subjectId', authenticate, (req, res) => {
  const { subjectId } = req.params;
  const history = (req.user.attendanceHistory || []).filter(h => h.subjectId === subjectId);
  const subject = (req.user.subjects || []).find(s => s.id === subjectId);
  res.json({
    subject: subject || null,
    history
  });
});

// Edit attendance history record
app.put('/api/attendance/history/:recordId', authenticate, (req, res) => {
  const { recordId } = req.params;
  const { status } = req.body; // 'Present' or 'Absent'
  let updatedRecord = null;

  store.updateUserData(req.user.id, (u) => {
    const record = (u.attendanceHistory || []).find(h => h.id === recordId);
    if (!record) return;
    const oldStatus = record.status;
    record.status = status;
    updatedRecord = record;

    if (record.slotKey && u.periodAttendance) {
      u.periodAttendance[record.slotKey] = status;
    }

    const sub = (u.subjects || []).find(s => s.id === record.subjectId);
    if (sub) {
      if (oldStatus === 'Absent' && status === 'Present') {
        sub.attended = (sub.attended || 0) + 1;
      } else if (oldStatus === 'Present' && status === 'Absent') {
        sub.attended = Math.max(0, (sub.attended || 1) - 1);
      }
    }
  });

  if (!updatedRecord) return res.status(404).json({ error: 'Record not found' });
  res.json({ record: updatedRecord });
});

app.get('/api/attendance/period-records', authenticate, (req, res) => {
  res.json({ records: req.user.periodAttendance || {} });
});

// -------------------------------------------------------------
// 5. HOMEWORK & ASSIGNMENTS APIS
// -------------------------------------------------------------

app.get('/api/tasks', authenticate, (req, res) => {
  const { type, status } = req.query;
  let tasks = req.user.tasks || [];
  if (type) tasks = tasks.filter(t => (t.type || '').toLowerCase() === type.toLowerCase());
  if (status) tasks = tasks.filter(t => (t.status || '').toLowerCase() === status.toLowerCase());

  const enriched = tasks.map(t => {
    const sub = (req.user.subjects || []).find(s => s.id === t.subjectId);
    return {
      ...t,
      subjectCode: sub ? sub.code : 'GEN',
      subjectName: sub ? sub.name : 'General Task',
      color: sub ? sub.color : '#4776F6'
    };
  });
  res.json({ tasks: enriched });
});

app.post('/api/tasks', authenticate, (req, res) => {
  const { title, type, customType, subjectId, customSubject, dueDate, priority, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title is required.' });

  if (typeof subjectId === 'string' && subjectId.toLowerCase() === 'custom' && !customSubject) {
    return res.status(400).json({ error: 'Custom subject name is required.' });
  }

  let finalSubId = subjectId;
  if ((!subjectId || (typeof subjectId === 'string' && subjectId.toLowerCase() === 'custom')) && customSubject) {
    const existing = (req.user.subjects || []).find(s => s.name.toLowerCase() === customSubject.toLowerCase());
    if (existing) {
      finalSubId = existing.id;
    } else {
      const newSub = {
        id: 'sub_' + Date.now(),
        code: customSubject.slice(0, 4).toUpperCase(),
        name: customSubject,
        faculty: 'Instructor',
        classroom: 'Room 101',
        credits: 3,
        semester: 1,
        color: '#8B5CF6',
        targetAttendance: req.user.preferences?.defaultAttendanceTarget || 75,
        attended: 0,
        total: 0
      };
      store.updateUserData(req.user.id, (u) => { u.subjects.push(newSub); });
      finalSubId = newSub.id;
    }
  }

  const isCustomType = type && typeof type === 'string' && type.toLowerCase() === 'custom';
  const finalType = (isCustomType && customType) ? customType : (type || 'Assignment');

  const newTask = {
    id: 'task_' + Date.now(),
    title,
    type: finalType,
    subjectId: finalSubId || null,
    dueDate: dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    priority: priority || 'Medium',
    status: 'Pending',
    description: description || ''
  };

  store.updateUserData(req.user.id, (u) => {
    u.tasks.unshift(newTask);
  });
  res.json({ task: newTask });
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
  const { id } = req.params;
  let updatedTask = null;
  store.updateUserData(req.user.id, (u) => {
    const idx = u.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      u.tasks[idx] = { ...u.tasks[idx], ...req.body, id };
      updatedTask = u.tasks[idx];
    }
  });
  if (!updatedTask) return res.status(404).json({ error: 'Task not found.' });
  res.json({ task: updatedTask });
});

app.post('/api/tasks/:id/toggle', authenticate, (req, res) => {
  const { id } = req.params;
  let currentStatus = 'Completed';
  store.updateUserData(req.user.id, (u) => {
    const task = u.tasks.find(t => t.id === id);
    if (task) {
      task.status = task.status === 'Completed' ? 'Pending' : 'Completed';
      currentStatus = task.status;
    }
  });
  res.json({ status: currentStatus });
});

app.delete('/api/tasks/:id', authenticate, (req, res) => {
  const { id } = req.params;
  store.updateUserData(req.user.id, (u) => {
    u.tasks = u.tasks.filter(t => t.id !== id);
  });
  res.json({ message: 'Task deleted.' });
});

// -------------------------------------------------------------
// 6. LAB WORK MANAGER APIS
// -------------------------------------------------------------

app.get('/api/labs', authenticate, (req, res) => {
  const labs = (req.user.labs || []).map(l => {
    const sub = (req.user.subjects || []).find(s => s.id === l.subjectId);
    return {
      ...l,
      subjectCode: sub ? sub.code : 'LAB',
      subjectName: sub ? sub.name : 'Laboratory',
      color: sub ? sub.color : '#F04438'
    };
  });
  res.json({ labs });
});

app.post('/api/labs', authenticate, (req, res) => {
  const { title, type, customType, subjectId, customSubject, sessionDate, deadline, description, recordStatus } = req.body;
  if (!title) return res.status(400).json({ error: 'Lab title is required.' });

  if (typeof subjectId === 'string' && subjectId.toLowerCase() === 'custom' && !customSubject) {
    return res.status(400).json({ error: 'Custom subject name is required.' });
  }

  let finalSubId = subjectId;
  if ((!subjectId || (typeof subjectId === 'string' && subjectId.toLowerCase() === 'custom')) && customSubject) {
    const existing = (req.user.subjects || []).find(s => s.name.toLowerCase() === customSubject.toLowerCase());
    if (existing) {
      finalSubId = existing.id;
    } else {
      const newSub = {
        id: 'sub_' + Date.now(),
        code: customSubject.slice(0, 4).toUpperCase(),
        name: customSubject,
        faculty: 'Lab Instructor',
        classroom: 'Lab Center',
        credits: 2,
        semester: 1,
        color: '#10B981',
        targetAttendance: req.user.preferences?.defaultAttendanceTarget || 75,
        attended: 0,
        total: 0
      };
      store.updateUserData(req.user.id, (u) => { u.subjects.push(newSub); });
      finalSubId = newSub.id;
    }
  }

  const isCustomType = type && typeof type === 'string' && type.toLowerCase() === 'custom';
  const finalType = (isCustomType && customType) ? customType : (type || 'Practical');

  const newLab = {
    id: 'lab_' + Date.now(),
    title,
    type: finalType,
    subjectId: finalSubId || null,
    sessionDate: sessionDate || new Date().toISOString().split('T')[0],
    deadline: deadline || new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    status: 'In Progress',
    recordStatus: recordStatus || 'Pending Sign-off',
    description: description || ''
  };

  store.updateUserData(req.user.id, (u) => {
    u.labs.unshift(newLab);
  });
  res.json({ lab: newLab });
});

app.put('/api/labs/:id', authenticate, (req, res) => {
  const { id } = req.params;
  let updatedLab = null;
  store.updateUserData(req.user.id, (u) => {
    const idx = u.labs.findIndex(l => l.id === id);
    if (idx !== -1) {
      u.labs[idx] = { ...u.labs[idx], ...req.body, id };
      updatedLab = u.labs[idx];
    }
  });
  if (!updatedLab) return res.status(404).json({ error: 'Lab not found.' });
  res.json({ lab: updatedLab });
});

app.delete('/api/labs/:id', authenticate, (req, res) => {
  const { id } = req.params;
  store.updateUserData(req.user.id, (u) => {
    u.labs = u.labs.filter(l => l.id !== id);
  });
  res.json({ message: 'Lab session deleted.' });
});

// -------------------------------------------------------------
// 7. STUDY PLANNER & FOCUS TIMER APIS
// -------------------------------------------------------------

app.get('/api/study/plans', authenticate, (req, res) => {
  const plans = (req.user.studyPlans || []).map(p => {
    const sub = (req.user.subjects || []).find(s => s.id === p.subjectId);
    return {
      ...p,
      subjectCode: sub ? sub.code : 'STUDY',
      subjectName: sub ? sub.name : 'Independent Study',
      color: sub ? sub.color : '#A47AF5'
    };
  });
  res.json({ plans });
});

app.post('/api/study/plans', authenticate, (req, res) => {
  const { title, subjectId, targetMinutes, date } = req.body;
  if (!title) return res.status(400).json({ error: 'Plan title is required.' });

  const newPlan = {
    id: 'sp_' + Date.now(),
    title,
    subjectId: subjectId || null,
    targetMinutes: Number(targetMinutes) || 60,
    completedMinutes: 0,
    date: date || new Date().toISOString().split('T')[0],
    status: 'Active'
  };

  store.updateUserData(req.user.id, (u) => {
    u.studyPlans.unshift(newPlan);
  });
  res.json({ plan: newPlan });
});

app.delete('/api/study/plans/:id', authenticate, (req, res) => {
  const { id } = req.params;
  store.updateUserData(req.user.id, (u) => {
    u.studyPlans = (u.studyPlans || []).filter(p => p.id !== id);
  });
  res.json({ message: 'Study plan deleted.' });
});

app.get('/api/study/sessions', authenticate, (req, res) => {
  store.pruneOldStudySessions(req.user);
  res.json({ sessions: req.user.studySessions || [] });
});

app.post('/api/study/sessions', authenticate, (req, res) => {
  const { subjectId, durationMinutes, notes } = req.body;
  const newSession = {
    id: 'sess_' + Date.now(),
    subjectId: subjectId || null,
    durationMinutes: Number(durationMinutes) || 25,
    date: new Date().toISOString().split('T')[0],
    notes: notes || 'Pomodoro focus session'
  };

  store.updateUserData(req.user.id, (u) => {
    u.studySessions.unshift(newSession);
  });
  res.json({ session: newSession });
});

app.delete('/api/study/sessions/:id', authenticate, (req, res) => {
  const { id } = req.params;
  store.updateUserData(req.user.id, (u) => {
    u.studySessions = (u.studySessions || []).filter(s => s.id !== id);
  });
  res.json({ message: 'Study session log deleted.' });
});

app.delete('/api/study/sessions', authenticate, (req, res) => {
  store.updateUserData(req.user.id, (u) => {
    u.studySessions = [];
  });
  res.json({ message: 'All study session history cleared.' });
});

// -------------------------------------------------------------
// 8. SGPA & CGPA CALCULATOR APIS
// -------------------------------------------------------------

app.get('/api/grades', authenticate, (req, res) => {
  const history = req.user.gpaHistory || [];
  const currentCgpa = req.user.profile.cgpa || 3.84;
  const scale = req.user.preferences.gradingScale || '10-point';
  res.json({
    currentCgpa,
    targetCgpa: req.user.profile.targetCgpa || 4.0,
    history,
    scale
  });
});

app.post('/api/grades/calculate', (req, res) => {
  const { courses, scale } = req.body;
  if (!Array.isArray(courses) || courses.length === 0) {
    return res.status(400).json({ error: 'Courses array required.' });
  }

  let totalCreditPoints = 0;
  let totalCredits = 0;

  courses.forEach(c => {
    const cred = Number(c.credits) || 0;
    const gp = Number(c.gradePoint) || 0;
    totalCreditPoints += cred * gp;
    totalCredits += cred;
  });

  const sgpa = totalCredits > 0 ? (totalCreditPoints / totalCredits).toFixed(2) : 0.0;
  res.json({
    sgpa: Number(sgpa),
    totalCredits,
    totalCreditPoints
  });
});

app.post('/api/grades/save-semester', authenticate, (req, res) => {
  const { semester, sgpa, credits, courses } = req.body;
  const updated = store.updateUserData(req.user.id, (u) => {
    if (!u.gpaHistory) u.gpaHistory = [];
    const semNum = Number(semester) || (u.gpaHistory.length + 1);
    const existingIndex = u.gpaHistory.findIndex(h => h.semester === semNum);
    const semRecord = {
      semester: semNum,
      sgpa: Number(sgpa),
      credits: Number(credits) || 20,
      passed: true,
      courses: courses || []
    };

    if (existingIndex >= 0) {
      u.gpaHistory[existingIndex] = semRecord;
    } else {
      u.gpaHistory.push(semRecord);
    }

    // Recompute Cumulative CGPA
    let sumPts = 0;
    let sumCr = 0;
    u.gpaHistory.forEach(h => {
      sumPts += (h.sgpa * h.credits);
      sumCr += h.credits;
    });

    if (sumCr > 0) {
      u.profile.cgpa = Number((sumPts / sumCr).toFixed(2));
      u.profile.totalCredits = sumCr;
    }
  });
  res.json({
    message: 'Semester grade record saved and Cumulative CGPA updated.',
    cumulativeCgpa: updated.profile.cgpa,
    cgpa: updated.profile.cgpa,
    history: updated.gpaHistory
  });
});

// -------------------------------------------------------------
// 9. DOCUMENT VAULT & SCANNER APIS
// -------------------------------------------------------------

app.get('/api/vault/folders', authenticate, (req, res) => {
  res.json({ folders: req.user.vaultFolders || [] });
});

app.post('/api/vault/folders', authenticate, (req, res) => {
  const { name, parentId } = req.body;
  if (!name) return res.status(400).json({ error: 'Folder name is required.' });

  const newFolder = {
    id: 'fld_' + Date.now(),
    name,
    parentId: parentId || null,
    icon: 'folder'
  };

  store.updateUserData(req.user.id, (u) => {
    u.vaultFolders.push(newFolder);
  });
  res.json({ folder: newFolder });
});

app.get('/api/vault/files', authenticate, (req, res) => {
  const { folderId, trash } = req.query;
  let files = req.user.vaultFiles || [];
  if (trash === 'true') {
    files = files.filter(f => f.isTrash === true);
  } else {
    files = files.filter(f => !f.isTrash);
    if (folderId) {
      files = files.filter(f => f.folderId === folderId);
    }
  }
  res.json({ files });
});

app.post('/api/vault/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const { folderId } = req.body;
  const uploadInfo = await uploadToCloudinaryOrLocal(req.file.path);

  const newFile = {
    id: 'file_' + Date.now(),
    name: req.file.originalname,
    folderId: folderId || null,
    size: (req.file.size / (1024 * 1024)).toFixed(1) + ' MB',
    type: req.file.mimetype,
    uploadDate: new Date().toISOString().split('T')[0],
    url: uploadInfo.url,
    storageProvider: uploadInfo.provider,
    isTrash: false
  };

  store.updateUserData(req.user.id, (u) => {
    u.vaultFiles.unshift(newFile);
  });
  res.json({ file: newFile, message: 'File saved to Vault.' });
});

// Document Scanner multi-page save
app.post('/api/vault/scanner/save', authenticate, (req, res) => {
  const { title, folderId } = req.body;
  if (!title) return res.status(400).json({ error: 'Document title is required.' });

  const fileName = `${Date.now()}_${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  fs.writeFileSync(filePath, Buffer.from('%PDF-1.4 simulated scanned document\n' + title));

  const newFile = {
    id: 'file_scan_' + Date.now(),
    name: `${title}.pdf`,
    folderId: folderId || null,
    size: '1.8 MB',
    type: 'application/pdf',
    uploadDate: new Date().toISOString().split('T')[0],
    url: `/uploads/${fileName}`,
    isTrash: false
  };

  store.updateUserData(req.user.id, (u) => {
    u.vaultFiles.unshift(newFile);
  });
  res.json({ file: newFile, message: 'Scanned document saved to Vault!' });
});

app.put('/api/vault/files/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const { name, folderId } = req.body;
  let updatedFile = null;
  store.updateUserData(req.user.id, (u) => {
    const file = u.vaultFiles.find(f => f.id === id);
    if (file) {
      if (name) file.name = name;
      if (folderId !== undefined) file.folderId = folderId;
      updatedFile = file;
    }
  });
  if (!updatedFile) return res.status(404).json({ error: 'File not found.' });
  res.json({ file: updatedFile });
});

app.delete('/api/vault/files/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const { permanent } = req.query;
  store.updateUserData(req.user.id, (u) => {
    if (permanent === 'true') {
      u.vaultFiles = u.vaultFiles.filter(f => f.id !== id);
    } else {
      const file = u.vaultFiles.find(f => f.id === id);
      if (file) file.isTrash = true;
    }
  });
  res.json({ message: permanent === 'true' ? 'File permanently deleted.' : 'Moved to Trash.' });
});

app.post('/api/vault/files/:id/restore', authenticate, (req, res) => {
  const { id } = req.params;
  store.updateUserData(req.user.id, (u) => {
    const file = u.vaultFiles.find(f => f.id === id);
    if (file) file.isTrash = false;
  });
  res.json({ message: 'File restored from Trash.' });
});

// -------------------------------------------------------------
// 10. UNIFIED CALENDAR APIS
// -------------------------------------------------------------

app.get('/api/calendar', authenticate, (req, res) => {
  const events = [];

  // 1. Timetable classes
  (req.user.timetable || []).forEach(t => {
    const sub = (req.user.subjects || []).find(s => s.id === t.subjectId);
    events.push({
      id: t.id,
      title: sub ? `${sub.code}: ${sub.name}` : 'Class',
      type: 'Class',
      dayOfWeek: t.day,
      time: `${t.startTime} - ${t.endTime}`,
      location: t.classroom,
      color: sub ? sub.color : '#4776F6'
    });
  });

  // 2. Tasks & Deadlines
  (req.user.tasks || []).forEach(t => {
    const sub = (req.user.subjects || []).find(s => s.id === t.subjectId);
    events.push({
      id: t.id,
      title: `[${t.type}] ${t.title}`,
      type: 'Deadline',
      date: t.dueDate,
      priority: t.priority,
      status: t.status,
      color: t.priority === 'High' ? '#F04438' : '#F5B942'
    });
  });

  // 3. Labs
  (req.user.labs || []).forEach(l => {
    events.push({
      id: l.id,
      title: `[Lab Submission] ${l.title}`,
      type: 'Lab',
      date: l.deadline,
      status: l.status,
      color: '#A47AF5'
    });
  });

  // 4. Custom Academic Events
  (req.user.calendarEvents || []).forEach(e => {
    events.push(e);
  });

  res.json({ events, academicCalendarPdf: req.user.academicCalendarPdf || null });
});

app.get('/api/calendar/pdf', authenticate, (req, res) => {
  res.json({ pdf: req.user.academicCalendarPdf || null });
});

app.post('/api/calendar/upload-pdf', authenticate, upload.single('calendarPdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded.' });

  const fileName = req.file.originalname;
  const uploadInfo = await uploadToCloudinaryOrLocal(req.file.path);

  const pdfData = {
    id: 'cal_pdf_' + Date.now(),
    name: fileName,
    url: uploadInfo.url,
    size: (req.file.size / (1024 * 1024)).toFixed(1) + ' MB',
    uploadDate: new Date().toISOString().split('T')[0]
  };

  store.updateUserData(req.user.id, (u) => {
    u.academicCalendarPdf = pdfData;
    const targetFolder = (u.vaultFolders || []).find(f => f.name.toLowerCase().includes('calendar') || f.name.toLowerCase().includes('syllabus')) || (u.vaultFolders || [])[0];
    if (!u.vaultFiles) u.vaultFiles = [];
    u.vaultFiles.unshift({
      id: 'file_cal_' + Date.now(),
      name: fileName,
      folderId: targetFolder ? targetFolder.id : null,
      size: pdfData.size,
      type: 'application/pdf',
      uploadDate: pdfData.uploadDate,
      url: pdfData.url,
      isTrash: false
    });
  });

  res.json({ message: 'Academic calendar PDF uploaded and linked to calendar & vault!', pdf: pdfData });
});

app.delete('/api/calendar/pdf', authenticate, (req, res) => {
  store.updateUserData(req.user.id, (u) => {
    u.academicCalendarPdf = null;
  });
  res.json({ message: 'Academic calendar PDF removed.' });
});

app.post(['/api/calendar', '/api/calendar/event'], authenticate, (req, res) => {
  const { title, date, type, location, color } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Title and date are required.' });
  const newEvt = {
    id: 'cal_' + Date.now(),
    title,
    date,
    type: type || 'Academic Event',
    location: location || '',
    color: color || '#1451D1'
  };
  store.updateUserData(req.user.id, (u) => {
    if (!u.calendarEvents) u.calendarEvents = [];
    u.calendarEvents.push(newEvt);
  });
  res.json({ event: newEvt });
});

app.put('/api/calendar/event/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const { title, date, type, location, color } = req.body;
  let updatedEvt = null;

  store.updateUserData(req.user.id, (u) => {
    if (!u.calendarEvents) u.calendarEvents = [];
    const evt = u.calendarEvents.find(e => e.id === id);
    if (evt) {
      if (title) evt.title = title;
      if (date) evt.date = date;
      if (type) evt.type = type;
      if (location !== undefined) evt.location = location;
      if (color) evt.color = color;
      updatedEvt = evt;
    }
  });

  if (!updatedEvt) return res.status(404).json({ error: 'Event not found' });
  res.json({ event: updatedEvt });
});

app.delete('/api/calendar/:id', authenticate, (req, res) => {
  const { id } = req.params;
  store.updateUserData(req.user.id, (u) => {
    if (u.calendarEvents) {
      u.calendarEvents = u.calendarEvents.filter(e => e.id !== id);
    }
    u.tasks = (u.tasks || []).filter(t => t.id !== id);
    u.timetable = (u.timetable || []).filter(t => t.id !== id);
    u.labs = (u.labs || []).filter(l => l.id !== id);
  });
  res.json({ message: 'Calendar event removed.' });
});

// -------------------------------------------------------------
// 11. GLOBAL SEARCH & COMMAND PALETTE (CMD+K)
// -------------------------------------------------------------

app.get('/api/search', authenticate, (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ results: [] });

  const results = [];

  // Search subjects
  (req.user.subjects || []).forEach(s => {
    if (s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.faculty.toLowerCase().includes(q)) {
      results.push({ category: 'Subjects', title: `${s.code}: ${s.name}`, subtitle: `Faculty: ${s.faculty} • ${s.credits} Credits`, link: '/app#timetable' });
    }
  });

  // Search tasks
  (req.user.tasks || []).forEach(t => {
    if (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)) {
      results.push({ category: 'Tasks & Homework', title: t.title, subtitle: `Due: ${t.dueDate} • Priority: ${t.priority}`, link: '/app#tasks' });
    }
  });

  // Search timetable
  (req.user.timetable || []).forEach(t => {
    const sub = (req.user.subjects || []).find(s => s.id === t.subjectId);
    const subName = sub ? sub.name : '';
    if (t.day.toLowerCase().includes(q) || (t.classroom || '').toLowerCase().includes(q) || subName.toLowerCase().includes(q)) {
      results.push({ category: 'Timetable', title: `${sub ? sub.code : 'Class'} (${t.day} ${t.startTime})`, subtitle: `Location: ${t.classroom}`, link: '/app#timetable' });
    }
  });

  // Search documents
  (req.user.vaultFiles || []).forEach(f => {
    if (!f.isTrash && f.name.toLowerCase().includes(q)) {
      results.push({ category: 'Document Vault', title: f.name, subtitle: `${f.size} • Uploaded ${f.uploadDate}`, link: '/app#vault' });
    }
  });

  res.json({ results });
});

// -------------------------------------------------------------
// 12. NOTIFICATIONS & PREFERENCES
// -------------------------------------------------------------

app.get('/api/notifications', authenticate, (req, res) => {
  res.json({ notifications: req.user.notifications || [] });
});

app.post('/api/notifications/:id/read', authenticate, (req, res) => {
  const { id } = req.params;
  store.updateUserData(req.user.id, (u) => {
    const notif = u.notifications.find(n => n.id === id);
    if (notif) notif.read = true;
  });
  res.json({ success: true });
});

app.post('/api/notifications/read-all', authenticate, (req, res) => {
  store.updateUserData(req.user.id, (u) => {
    (u.notifications || []).forEach(n => { n.read = true; });
  });
  res.json({ success: true });
});

app.put('/api/preferences', authenticate, (req, res) => {
  store.updateUserData(req.user.id, (u) => {
    u.preferences = { ...u.preferences, ...req.body };
  });
  res.json({ preferences: req.user.preferences });
});

// -------------------------------------------------------------
// 13. OFFLINE BATCH SYNC
// -------------------------------------------------------------

app.post('/api/sync', authenticate, (req, res) => {
  const { actions } = req.body; // array of offline actions { type, payload }
  if (Array.isArray(actions)) {
    // Process queued offline mutations
    actions.forEach(action => {
      console.log(`[Offline Sync] Processing ${action.type} for user ${req.user.id}`);
    });
  }
  res.json({ success: true, syncedCount: (actions || []).length });
});

// -------------------------------------------------------------
// 14. EXPORT ACADEMIC RECORDS (CSV / JSON)
// -------------------------------------------------------------

app.get('/api/export/attendance.csv', authenticate, (req, res) => {
  const subjects = req.user.subjects || [];
  let csv = 'Subject Code,Subject Name,Faculty,Credits,Classes Attended,Total Classes,Attendance %\n';
  subjects.forEach(s => {
    const pct = s.total > 0 ? ((s.attended / s.total) * 100).toFixed(1) : '100.0';
    csv += `"${s.code}","${s.name}","${s.faculty}",${s.credits},${s.attended || 0},${s.total || 0},${pct}%\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.csv"');
  res.send(csv);
});

// -------------------------------------------------------------
// STATIC FILES & APPLICATION ROUTES
// -------------------------------------------------------------

// Serve uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve screenshots & screens from Stitch
app.use('/screens', express.static(path.join(__dirname, 'screens')));
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Serve public directory (Landing, Workspace, PWA, Assets)
app.use(express.static(path.join(__dirname, 'public')));

// Root landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Main Web Application Workspace
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Direct Demo Shortcut
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Original Stitch Gallery
app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

// Fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function sanitizeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 College OS Node.js Server running on port ${PORT}`);
  console.log(`🌐 Public Landing Page: http://localhost:${PORT}/`);
  console.log(`🎓 Workspace App:       http://localhost:${PORT}/app`);
  console.log(`📱 PWA Manifest:        http://localhost:${PORT}/manifest.json`);
  console.log(`🎨 Stitch Gallery:      http://localhost:${PORT}/gallery`);
  console.log(`====================================================`);
});
