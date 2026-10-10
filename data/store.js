const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const STORE_PATH = process.env.VERCEL ? path.join('/tmp', 'store.json') : path.join(__dirname, 'store.json');

// Default Seed Data for Student "Elena Rostova"
function createDemoStudent(hashedPassword) {
  return {
    id: 'user_elena_demo',
    email: 'elena@collegeos.edu',
    password: hashedPassword,
    profile: {
      name: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      college: 'Institute of Advanced Engineering & Technology',
      studentId: 'CS-2024-8842',
      semester: 'Semester 5 (Fall 2026)',
      major: 'Computer Science & Engineering',
      batch: '2024 - 2028',
      cgpa: 3.84,
      targetCgpa: 3.90,
      totalCredits: 92,
      bio: 'Junior CSE student specializing in Distributed Systems & AI. Maintaining >85% attendance across core engineering labs.'
    },
    preferences: {
      theme: 'light',
      defaultAttendanceTarget: 75,
      customSubjectTargetsEnabled: false,
      holidayDays: ['Saturday', 'Sunday'],
      gradingScale: '10-point', // '10-point' or '4-point'
      notifications: {
        upcomingClasses: true,
        assignmentDeadlines: true,
        labReminders: true,
        attendanceWarnings: true,
        leadTimeMinutes: 30
      }
    },
    academicCalendarPdf: null,
    periodAttendance: {},
    subjects: [
      {
        id: 'sub_chem',
        code: 'CHEM 101',
        name: 'Chemistry',
        faculty: 'Prof. Vance',
        classroom: 'Hall B-204',
        credits: 4,
        semester: 1,
        color: '#2563EB',
        targetAttendance: 75,
        attended: 0,
        total: 0
      },
      {
        id: 'sub_elec',
        code: 'EC 102',
        name: 'Electronics',
        faculty: 'Prof. Marcus Chen',
        classroom: 'Hall C-102',
        credits: 3,
        semester: 1,
        color: '#10B981',
        targetAttendance: 75,
        attended: 0,
        total: 0
      },
      {
        id: 'sub_ee',
        code: 'EE 103',
        name: 'Electrical',
        faculty: 'Prof. Sarah Jenkins',
        classroom: 'Auditorium 2',
        credits: 3,
        semester: 1,
        color: '#F59E0B',
        targetAttendance: 75,
        attended: 0,
        total: 0
      },
      {
        id: 'sub_graph',
        code: 'ME 104',
        name: 'Graphics',
        faculty: 'Prof. Robert Miller',
        classroom: 'CAD Studio 4',
        credits: 3,
        semester: 1,
        color: '#8B5CF6',
        targetAttendance: 75,
        attended: 0,
        total: 0
      },
      {
        id: 'sub_python',
        code: 'CS 105',
        name: 'Python',
        faculty: 'Dr. Alistair Ross',
        classroom: 'Comp Lab 1',
        credits: 4,
        semester: 1,
        color: '#06B6D4',
        targetAttendance: 75,
        attended: 0,
        total: 0
      },
      {
        id: 'sub_phys',
        code: 'PH 106',
        name: 'Physics',
        faculty: 'Dr. Emily Clark',
        classroom: 'Science Hall 3',
        credits: 4,
        semester: 1,
        color: '#EC4899',
        targetAttendance: 75,
        attended: 0,
        total: 0
      }
    ],
    timetable: [],
    attendanceHistory: [],
    tasks: [
      {
        id: 'task_1',
        title: 'B-Tree Indexing Implementation Report',
        type: 'Assignment',
        subjectId: 'sub_cs502',
        dueDate: '2026-10-16',
        priority: 'High',
        status: 'Pending',
        description: 'Complete the write-up on B+ tree page splits and concurrency locking mechanisms.'
      },
      {
        id: 'task_2',
        title: 'Bellman-Ford & Dijkstra Benchmark Analysis',
        type: 'Homework',
        subjectId: 'sub_cs501',
        dueDate: '2026-10-18',
        priority: 'Medium',
        status: 'Pending',
        description: 'Compare asymptotic complexity vs cache locality performance on synthetic dense graphs.'
      },
      {
        id: 'task_3',
        title: 'Virtual Memory Pager Simulator (xv6)',
        type: 'Project',
        subjectId: 'sub_cs503',
        dueDate: '2026-10-24',
        priority: 'High',
        status: 'Upcoming',
        description: 'Implement lazy page allocation and COW (Copy-On-Write) fork in xv6 kernel.'
      },
      {
        id: 'task_4',
        title: 'TCP Reno vs Cubic Flow Simulation',
        type: 'Academic Task',
        subjectId: 'sub_cs504',
        dueDate: '2026-10-12',
        priority: 'High',
        status: 'Completed',
        description: 'Simulated packet loss rate against window scaling in ns-3.'
      },
      {
        id: 'task_5',
        title: 'Technical Whitepaper on Ethical AI Guardrails',
        type: 'Assignment',
        subjectId: 'sub_hs501',
        dueDate: '2026-10-11',
        priority: 'Low',
        status: 'Completed',
        description: 'Case analysis of automated grading systems and accountability frameworks.'
      }
    ],
    labs: [
      {
        id: 'lab_1',
        title: 'Lab 04: Multi-Threaded Cache-Oblivious Matrix Multiplier',
        subjectId: 'sub_cs505l',
        sessionDate: '2026-10-15',
        deadline: '2026-10-19',
        status: 'In Progress',
        recordStatus: 'Pending Sign-off',
        description: 'Benchmarking AVX-512 vectorization vs pthread tiles.'
      },
      {
        id: 'lab_2',
        title: 'Lab 03: Linux Shared Memory Semaphore Ring Buffer',
        subjectId: 'sub_cs505l',
        sessionDate: '2026-10-08',
        deadline: '2026-10-12',
        status: 'Completed',
        recordStatus: 'Verified by Instructor',
        description: 'Circular queue implementation with lock-free atomic CAS.'
      },
      {
        id: 'lab_3',
        title: 'Lab 02: Socket-Level HTTP/2 Multiplexer',
        subjectId: 'sub_cs504',
        sessionDate: '2026-09-30',
        deadline: '2026-10-04',
        status: 'Completed',
        recordStatus: 'Verified by Instructor',
        description: 'Stream prioritization and HPACK header decoding test.'
      }
    ],
    studyPlans: [
      {
        id: 'sp_1',
        title: 'Daily Deep Work: Algorithmic Geometry & Red-Black Trees',
        subjectId: 'sub_cs501',
        targetMinutes: 120,
        completedMinutes: 90,
        date: '2026-10-10',
        status: 'Active'
      },
      {
        id: 'sp_2',
        title: 'xv6 Paging Revision for Midterms',
        subjectId: 'sub_cs503',
        targetMinutes: 90,
        completedMinutes: 90,
        date: '2026-10-09',
        status: 'Completed'
      }
    ],
    studySessions: [
      { id: 'sess_1', subjectId: 'sub_cs501', durationMinutes: 50, date: '2026-10-10', notes: 'Dynamic Programming Intervals' },
      { id: 'sess_2', subjectId: 'sub_cs501', durationMinutes: 40, date: '2026-10-10', notes: 'Graph Coloring theorems' },
      { id: 'sess_3', subjectId: 'sub_cs503', durationMinutes: 60, date: '2026-10-09', notes: 'TLB shootdown mechanics' },
      { id: 'sess_4', subjectId: 'sub_cs502', durationMinutes: 45, date: '2026-10-08', notes: 'PostgreSQL WAL recovery internals' }
    ],
    gpaHistory: [
      { semester: 1, sgpa: 3.75, credits: 22, passed: true },
      { semester: 2, sgpa: 3.80, credits: 24, passed: true },
      { semester: 3, sgpa: 3.82, credits: 23, passed: true },
      { semester: 4, sgpa: 3.88, credits: 23, passed: true }
    ],
    vaultFolders: [
      { id: 'fld_syllabus', name: 'Official Syllabi', parentId: null, icon: 'book' },
      { id: 'fld_notes', name: 'Lecture Transcripts & Notes', parentId: null, icon: 'description' },
      { id: 'fld_labs', name: 'Lab Manuals & Reports', parentId: null, icon: 'science' },
      { id: 'fld_scanned', name: 'Scanned Exam Solutions', parentId: null, icon: 'document_scanner' }
    ],
    vaultFiles: [
      {
        id: 'file_1',
        name: 'CS501_Advanced_Algorithms_Syllabus_2026.pdf',
        folderId: 'fld_syllabus',
        size: '1.4 MB',
        type: 'application/pdf',
        uploadDate: '2026-09-02',
        url: '/uploads/sample_syllabus.pdf',
        isTrash: false
      },
      {
        id: 'file_2',
        name: 'Database_Index_Structures_Summary.pdf',
        folderId: 'fld_notes',
        size: '3.8 MB',
        type: 'application/pdf',
        uploadDate: '2026-10-05',
        url: '/uploads/sample_notes.pdf',
        isTrash: false
      },
      {
        id: 'file_3',
        name: 'Operating_Systems_xv6_Lab_Manual.pdf',
        folderId: 'fld_labs',
        size: '5.2 MB',
        type: 'application/pdf',
        uploadDate: '2026-09-18',
        url: '/uploads/sample_lab_manual.pdf',
        isTrash: false
      },
      {
        id: 'file_4',
        name: 'Scanned_Calculus_Practice_Set.pdf',
        folderId: 'fld_scanned',
        size: '2.1 MB',
        type: 'application/pdf',
        uploadDate: '2026-10-08',
        url: '/uploads/sample_scanned.pdf',
        isTrash: false
      }
    ],
    notifications: [
      {
        id: 'notif_1',
        title: 'Attendance Alert: CS 504 at 72.4%',
        message: 'Your attendance in Computer Networks is below the 75% mandatory threshold. You need 2 consecutive attendances to recover.',
        type: 'warning',
        timestamp: '1 hour ago',
        read: false
      },
      {
        id: 'notif_2',
        title: 'Upcoming Lab Submission in 4 days',
        message: 'Lab 04: Multi-Threaded Cache-Oblivious Matrix Multiplier is due on Monday, Oct 19.',
        type: 'info',
        timestamp: '3 hours ago',
        read: false
      },
      {
        id: 'notif_3',
        title: 'Next Class in 35 mins',
        message: 'Advanced Algorithms (Hall B-204) with Prof. Vance starts at 09:30 AM.',
        type: 'calendar',
        timestamp: 'Just now',
        read: false
      }
    ]
  };
}

class Store {
  constructor() {
    this.data = { users: {} };
    this.init();
  }

  init() {
    if (fs.existsSync(STORE_PATH)) {
      try {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        this.data = JSON.parse(raw);
        if (!this.data.users) this.data.users = {};
      } catch (e) {
        console.error('Failed reading store.json, reinitializing:', e.message);
        this.seedDemo();
      }
    } else {
      this.seedDemo();
    }
  }

  seedDemo() {
    this.data = {
      users: {}
    };
    this.save();
  }

  save() {
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving store.json:', e);
    }
  }

  getUserByEmail(email) {
    const normalized = (email || '').trim().toLowerCase();
    return Object.values(this.data.users).find(u => (u.email || '').toLowerCase() === normalized);
  }

  getUserById(id) {
    return this.data.users[id] || null;
  }

  createUser(email, password, name = 'Student', college = 'College', semester = 'Semester 1') {
    const normalized = (email || '').trim().toLowerCase();
    if (this.getUserByEmail(normalized)) {
      throw new Error('An account with this email already exists.');
    }
    const id = 'usr_' + Buffer.from(normalized).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    let hash = password;
    if (!password.startsWith('fb_auth_')) {
      const salt = bcrypt.genSaltSync(10);
      hash = bcrypt.hashSync(password, salt);
    }
    
    // Create new blank academic workspace with templates
    const newUser = {
      id,
      email: normalized,
      password: hash,
      profile: {
        name,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
        college,
        studentId: 'STU-' + Math.floor(1000 + Math.random() * 9000),
        semester,
        major: 'General Studies',
        batch: '2026 - 2030',
        cgpa: 0.0,
        targetCgpa: 4.0,
        totalCredits: 0,
        bio: 'Student at ' + college
      },
      preferences: {
        theme: 'light',
        defaultAttendanceTarget: 75,
        customSubjectTargetsEnabled: false,
        holidayDays: ['Saturday', 'Sunday'],
        gradingScale: '10-point',
        notifications: {
          upcomingClasses: true,
          assignmentDeadlines: true,
          labReminders: true,
          attendanceWarnings: true,
          leadTimeMinutes: 30
        }
      },
      academicCalendarPdf: null,
      periodAttendance: {},
      subjects: [],
      timetable: [],
      attendanceHistory: [],
      tasks: [],
      labs: [],
      studyPlans: [],
      studySessions: [],
      gpaHistory: [],
      vaultFolders: [
        { id: 'fld_notes_' + id, name: 'Lecture Notes', parentId: null, icon: 'description' },
        { id: 'fld_syllabus_' + id, name: 'Syllabus & Calendars', parentId: null, icon: 'book' }
      ],
      vaultFiles: [],
      notifications: [
        {
          id: 'notif_welcome_' + id,
          title: 'Welcome to College OS!',
          message: 'Your personal academic workspace is ready. Start by adding your courses and timetable slots.',
          type: 'info',
          timestamp: 'Just now',
          read: false
        }
      ]
    };

    this.data.users[id] = newUser;
    this.save();
    return newUser;
  }

  pruneOldStudySessions(user) {
    if (!user || !user.studySessions) return;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    user.studySessions = user.studySessions.filter(s => (s.date || '') >= oneWeekAgo);
    this.save();
  }

  clearTimetableAndAttendance(userId) {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');
    user.timetable = [];
    user.attendanceHistory = [];
    user.periodAttendance = {};
    if (user.subjects) {
      user.subjects.forEach(s => {
        s.attended = 0;
        s.total = 0;
      });
    }
    this.save();
    return user;
  }

  factoryResetUser(userId) {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');
    user.subjects = [];
    user.timetable = [];
    user.attendanceHistory = [];
    user.tasks = [];
    user.labs = [];
    user.studyPlans = [];
    user.studySessions = [];
    user.gpaHistory = [];
    user.vaultFolders = [
      { id: 'fld_notes_' + userId, name: 'Lecture Notes', parentId: null, icon: 'description' },
      { id: 'fld_syllabus_' + userId, name: 'Syllabus & Calendars', parentId: null, icon: 'book' }
    ];
    user.vaultFiles = [];
    user.calendarEvents = [];
    user.preferences = {
      theme: 'dark',
      defaultAttendanceTarget: 75,
      gradingScale: '10-point',
      notifications: {
        upcomingClasses: true,
        assignmentDeadlines: true,
        labReminders: true,
        attendanceWarnings: true,
        leadTimeMinutes: 30
      }
    };
    this.save();
    return user;
  }

  updateUserData(userId, updaterFn) {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');
    updaterFn(user);
    this.save();
    return user;
  }
}

module.exports = new Store();
