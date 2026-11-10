// ============ API CONFIGURATION ============
const API_BASE_URL = "https://examguard-8rxe.onrender.com";
const token = localStorage.getItem('adminToken') || '';

// ============ STATE ============
let currentReport = null;
let verificationHistory = [];
let schools = [];
let sessions = [];
let terms = [];
let schoolTerms = [];
let unreadMessages = 0;
let unreadTickets = 0;
let sessionsRequestId = 0;
let termsRequestId = 0;

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
  setupEventListeners();
  setupFormValidation();
  loadInitialData();

  if (window.innerWidth <= 900) {
    const toggleButton = document.getElementById('toggleSidebarBtn');
    if (toggleButton) toggleButton.style.display = 'flex';
  }
});

function initializeApp() {
  const userName = localStorage.getItem('userName') || 'User';
  const userRole = localStorage.getItem('userRole') || 'Institution';

  document.getElementById('userNameSidebar').textContent = userName;
  document.getElementById('userRoleSidebar').textContent = userRole;
}

function setupEventListeners() {
  document.getElementById('verificationForm')
    .addEventListener('submit', handleVerification);

  const schoolSelect = document.getElementById('schoolName');
  if (schoolSelect) {
    schoolSelect.addEventListener('change', async function() {
      updateSchoolInfo();
      await loadSessions(this.value);
    });
  }

  document.querySelectorAll('.form-input, .form-select').forEach(field => {
    field.addEventListener('input', function() {
      const errorEl = document.getElementById(`${this.id}-error`);
      if (errorEl) {
        this.classList.remove('error');
        errorEl.classList.remove('show');
      }
    });
  });

  document.getElementById('session').addEventListener('change', function() {
    loadTerms(this.value);
  });
}

function setupFormValidation() {
  document.getElementById('regNo').addEventListener('input', function() {
    this.value = this.value.toUpperCase();
  });

  document.getElementById('scratchCard').addEventListener('input', function() {
    this.value = this.value.toUpperCase();
  });
}

async function loadInitialData() {
  try {
    showLoading(true);
    await loadSchools();
    await prefillVerificationFormFromUrl();
    await loadVerificationHistory();
  } catch (error) {
    console.error('Error loading initial data:', error);
  } finally {
    showLoading(false);
  }
}

// ============ PUBLIC SCHOOL / ACADEMIC OPTIONS ============
async function loadSchools() {
  try {
    // The schools endpoint is public; do not send a possibly absent admin token.
    const response = await fetch(`${API_BASE_URL}/api/schools`);

    if (!response.ok) {
      throw new Error(`Failed to load schools: ${response.status}`);
    }

    const responseData = await response.json();
    schools = Array.isArray(responseData.data) ? responseData.data : [];
    populateSchoolDropdown();
  } catch (error) {
    console.error('Error loading schools:', error);
    showAlert('error', 'Could not load schools. Please refresh the page.');
  }
}

function populateSchoolDropdown() {
  const schoolSelect = document.getElementById('schoolName');

  if (!Array.isArray(schools)) {
    console.error('Schools is not an array:', schools);
    return;
  }

  while (schoolSelect.options.length > 1) {
    schoolSelect.remove(1);
  }

  schools.forEach(school => {
    const option = document.createElement('option');
    option.value = school._id || school.id || school.schoolId;
    option.textContent = school.schoolName || school.name;
    schoolSelect.appendChild(option);
  });
}

function normalizeQueryValue(value) {
  return String(value || '').trim().toLowerCase();
}

function findMatchingItem(items, candidates) {
  const values = candidates
    .filter(value => value !== undefined && value !== null && String(value).trim())
    .map(normalizeQueryValue);

  return items.find(item => {
    const itemValues = [
      item._id,
      item.id,
      item.schoolId,
      item.publicSchoolId,
      item.code,
      item.name,
      item.schoolName
    ]
      .filter(value => value !== undefined && value !== null && String(value).trim())
      .map(normalizeQueryValue);

    return values.some(value => itemValues.includes(value));
  });
}

function setSelectToItem(selectId, item, nameKeys = ['name']) {
  const select = document.getElementById(selectId);
  if (!select || !item) return false;

  const itemId = item._id || item.id || item.schoolId;
  const itemName = nameKeys.map(key => item[key]).find(Boolean);

  const option = Array.from(select.options).find(option =>
    normalizeQueryValue(option.value) === normalizeQueryValue(itemId) ||
    normalizeQueryValue(option.textContent) === normalizeQueryValue(itemName) ||
    normalizeQueryValue(option.dataset.termName) === normalizeQueryValue(itemName) ||
    normalizeQueryValue(option.dataset.className) === normalizeQueryValue(itemName)
  );

  if (!option) return false;
  select.value = option.value;
  return true;
}

function setSelectToQueryValue(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select || !value) return false;

  const normalizedValue = normalizeQueryValue(value);
  const option = Array.from(select.options).find(item =>
    normalizeQueryValue(item.value) === normalizedValue ||
    normalizeQueryValue(item.textContent) === normalizedValue ||
    normalizeQueryValue(item.dataset.className) === normalizedValue
  );

  if (!option) return false;
  select.value = option.value;
  return true;
}

async function prefillVerificationFormFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const schoolId = params.get('schoolId');
  const schoolName = params.get('schoolName');
  const regNo = params.get('regNo');
  const sessionValue = params.get('session') || params.get('sessionId');
  const termValue = params.get('term') || params.get('termName') || params.get('termId');
  const classValue =
    params.get('class') ||
    params.get('className') ||
    params.get('classLevel') ||
    params.get('classLevelId');

  const schoolSelect = document.getElementById('schoolName');
  let selectedSchool = null;

  if (schoolId || schoolName) {
    selectedSchool = findMatchingItem(schools, [schoolId, schoolName]);

    if (selectedSchool) {
      schoolSelect.value =
        selectedSchool._id ||
        selectedSchool.id ||
        selectedSchool.schoolId;
      updateSchoolInfo();
      await loadSessions(schoolSelect.value);
    }
  } else if (schoolSelect.value) {
    await loadSessions(schoolSelect.value);
  }

  if (regNo) {
    document.getElementById('regNo').value = regNo.trim();
  }

  if (sessionValue) {
    const session = findMatchingItem(sessions, [sessionValue]);

    if (session && setSelectToItem('session', session)) {
      await loadTerms(session._id || session.id);

      if (termValue) {
        const term = findMatchingItem(terms, [termValue]);
        if (term) setSelectToItem('term', term);
      }
    }
  }

  if (classValue) {
    setSelectToQueryValue('classLevel', classValue);
  }

  const purpose = params.get('verificationPurpose');
  if (purpose) {
    const purposeSelect = document.getElementById('verificationPurpose');
    const option = Array.from(purposeSelect.options).find(item =>
      normalizeQueryValue(item.value) === normalizeQueryValue(purpose) ||
      normalizeQueryValue(item.textContent) === normalizeQueryValue(purpose)
    );
    if (option) purposeSelect.value = option.value;
  }

  const institutionName = params.get('institutionName');
  if (institutionName) {
    document.getElementById('institutionName').value = institutionName;
  }
}

function clearSessionAndTermSelections() {
  const sessionSelect = document.getElementById('session');
  const termSelect = document.getElementById('term');

  while (sessionSelect.options.length > 1) {
    sessionSelect.remove(1);
  }
  sessionSelect.value = '';

  while (termSelect.options.length > 1) {
    termSelect.remove(1);
  }
  termSelect.value = '';

  sessions = [];
  terms = [];
  schoolTerms = [];
}

async function loadSessions(schoolId) {
  const requestId = ++sessionsRequestId;
  ++termsRequestId;
  clearSessionAndTermSelections();

  if (!schoolId) return;

  try {
    const params = new URLSearchParams({ schoolId });
    const response = await fetch(
      `${API_BASE_URL}/api/res/public-academics?${params.toString()}`
    );

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error || `Request failed: ${response.status}`);
    }

    // Ignore stale responses if the user changed schools while loading.
    if (requestId !== sessionsRequestId) return;

    sessions = Array.isArray(responseData.data?.sessions)
      ? responseData.data.sessions
      : [];
    schoolTerms = Array.isArray(responseData.data?.terms)
      ? responseData.data.terms
      : [];

    const sessionSelect = document.getElementById('session');

    sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session._id || session.id;
      option.textContent = session.name;
      sessionSelect.appendChild(option);
    });

    if (sessions.length === 0) {
      console.warn('No sessions returned for the selected school.');
    }
  } catch (error) {
    console.error('Error loading public school academics:', error);
    showAlert('warning', 'Could not load sessions and terms for this school.');
  }
}

async function loadTerms(sessionId) {
  const requestId = ++termsRequestId;
  const termSelect = document.getElementById('term');

  terms = [];
  while (termSelect.options.length > 1) {
    termSelect.remove(1);
  }
  termSelect.value = '';

  if (!sessionId) return;

  terms = schoolTerms.filter(term =>
    String(term.sessionId) === String(sessionId)
  );

  if (requestId === termsRequestId) {
    populateTermDropdown();
  }
}

function populateTermDropdown() {
  const termSelect = document.getElementById('term');

  while (termSelect.options.length > 1) {
    termSelect.remove(1);
  }

  if (!Array.isArray(terms) || terms.length === 0) {
    console.warn('No terms available for the selected session.');
    return;
  }

  terms.forEach(term => {
    const option = document.createElement('option');
    option.value = term._id || term.id;
    option.textContent = term.name;
    option.dataset.termName = term.name;
    termSelect.appendChild(option);
  });
}

// Class options are already present in institutional.html. Keep them local:
// the protected academic class-level endpoint is not used on this public page.

// ============ VERIFICATION HISTORY ============
async function loadVerificationHistory() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/verification-history`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Failed to load history');

    const responseData = await response.json();
    verificationHistory = responseData.data || responseData.history || [];
    updateHistoryBadge();
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

function updateHistoryBadge() {
  const badge = document.getElementById('historyBadge');
  if (badge) {
    badge.textContent = verificationHistory.length;
  }
}

// ============ VERIFICATION FUNCTION ============
async function handleVerification(event) {
  event.preventDefault();

  if (!validateForm()) return;

  document.querySelector('.two-column').classList.remove('report-visible');

  const schoolId = document.getElementById('schoolName').value;
  const regNo = document.getElementById('regNo').value.trim();
  const scratchCard = document.getElementById('scratchCard').value.trim();
  const sessionId = document.getElementById('session').value;

  const termSelect = document.getElementById('term');
  const termOption = termSelect.options[termSelect.selectedIndex];
  const termName = termOption.dataset.termName || termOption.text;

  const classSelect = document.getElementById('classLevel');
  const classOption = classSelect.options[classSelect.selectedIndex];
  const className = classOption.dataset.className || classOption.text;

  const verificationPurpose = document.getElementById('verificationPurpose').value;
  const institutionName = document.getElementById('institutionName').value.trim();
  const submitBtn = document.getElementById('submitBtn');

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Verifying...';

    const response = await fetch(`${API_BASE_URL}/api/res/verify-student-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        schoolId,
        regNo,
        scratchCard,
        sessionId,
        termName,
        className,
        verificationPurpose,
        institutionName
      })
    });

    const data = await response.json();

    if (response.ok && data.verified) {
      currentReport = data.data;
      displayReport(currentReport);
      showAlert('success', `Report for ${currentReport.studentName} verified successfully!`);
      addToHistory(currentReport);

      setTimeout(() => {
        document.getElementById('reportCard')
          .scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else {
      showAlert(
        'error',
        data.message || 'Verification failed. Please check your details and try again.'
      );
    }
  } catch (error) {
    console.error('Verification error:', error);
    showAlert('error', 'An error occurred during verification. Please try again later.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Verify Report';
  }
}

function validateForm() {
  let isValid = true;
  const fields = [
    'schoolName',
    'regNo',
    'scratchCard',
    'session',
    'term',
    'classLevel',
    'verificationPurpose',
    'institutionName'
  ];

  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);

    if (!field.value.trim()) {
      field.classList.add('error');
      if (errorEl) {
        errorEl.textContent = 'This field is required';
        errorEl.classList.add('show');
      }
      isValid = false;
    }
  });

  return isValid;
}

// ============ DISPLAY REPORT ============
function displayReport(data) {
  document.querySelector('.two-column').classList.add('report-visible');
  document.getElementById('reportEmpty').style.display = 'none';
  document.getElementById('reportCard').style.display = 'block';

  const totalScore = parseFloat(data.totalScore) || 0;
  const averageScore = parseFloat(data.averageScore) || 0;

  document.getElementById('reportStudentName').textContent = data.studentName;
  document.getElementById('reportRegNo').textContent = `REG: ${data.regNo}`;
  document.getElementById('reportSchoolName').textContent = `School: ${data.school.name}`;
  document.getElementById('reportYear').textContent = `Session: ${data.session.name}`;

  document.getElementById('reportTerm').textContent = data.term.name;
  document.getElementById('reportClass').textContent = data.classLevel.name;
  document.getElementById('reportTotalScore').textContent = totalScore.toFixed(2);
  document.getElementById('reportAverageScore').textContent = averageScore.toFixed(2);

  const highestScore = data.subjects?.length
    ? Math.max(...data.subjects.map(subject => parseFloat(subject.total) || 0))
    : 0;
  document.getElementById('reportHighestScore').textContent = highestScore.toFixed(2);

  const gradeEl = document.getElementById('reportGrade');
  gradeEl.textContent = data.overallGrade;
  gradeEl.className = `info-item-value grade grade-${String(data.overallGrade || '').toLowerCase()}`;

  const tableBody = document.getElementById('subjectsTableBody');
  tableBody.innerHTML = '';

  if (!data.subjects || data.subjects.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-light);">No subject data</td></tr>';
  } else {
    data.subjects.forEach(subject => {
      const row = document.createElement('tr');
      const total = parseFloat(subject.total) || 0;

      row.innerHTML = `
        <td class="subject-name">${subject.name || '-'}</td>
        <td class="score">${subject.ca1 ?? '-'}</td>
        <td class="score">${subject.ca2 ?? '-'}</td>
        <td class="score">${subject.midterm ?? '-'}</td>
        <td class="score">${subject.exam ?? '-'}</td>
        <td class="score score-total">${total.toFixed(2)}</td>
        <td style="text-align:center;">
          <span class="grade-badge grade-${String(subject.grade || 'f').toLowerCase()}">
            ${subject.grade || '-'}
          </span>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  if (data.skills) {
    document.getElementById('skillsPunctuality').textContent = data.skills.punctuality || '-';
    document.getElementById('skillsObedience').textContent = data.skills.obedience || '-';
    document.getElementById('skillsHonesty').textContent = data.skills.honesty || '-';
    document.getElementById('skillsCleanliness').textContent = data.skills.cleanliness || '-';
    document.getElementById('skillsInitiative').textContent = data.skills.initiative || '-';
    document.getElementById('skillsCooperation').textContent = data.skills.cooperation || '-';
  }

  if (data.attendance) {
    document.getElementById('attendancePresent').textContent = data.attendance.present || '-';
    document.getElementById('attendanceAbsent').textContent = data.attendance.absent || '-';
    const rate = parseFloat(data.attendance.rate) || 0;
    document.getElementById('attendanceRate').textContent = `${rate.toFixed(1)}%`;
  }

  if (data.teacherComment) {
    document.getElementById('teacherComment').textContent =
      data.teacherComment.comment || '-';
    document.getElementById('teacherName').innerHTML =
      `<strong>Teacher:</strong> ${data.teacherComment.teacherName || 'Unknown'}`;
  }

  if (data.principalRemark) {
    document.getElementById('principalRemark').textContent =
      data.principalRemark.remark || '-';
    document.getElementById('principalName').innerHTML =
      `<strong>Principal:</strong> ${data.principalRemark.principalName || 'Unknown'}`;
  }

  document.getElementById('reportVerificationCode').textContent =
    data.verificationCode || '-';
  document.getElementById('reportIssueDate').textContent =
    data.issueDate ? new Date(data.issueDate).toLocaleDateString() : '-';
}

// ============ ALERT FUNCTION ============
function showAlert(type, message) {
  document.querySelectorAll('.alert').forEach(alert => {
    alert.classList.remove('show');
  });

  const alertEl = document.getElementById(`${type}Alert`);
  if (!alertEl) return;

  const messageEl = alertEl.querySelector('[id$="Message"]');
  if (messageEl) messageEl.textContent = message;

  alertEl.classList.add('show');

  setTimeout(() => {
    alertEl.classList.remove('show');
  }, 6000);
}

// ============ MODAL FUNCTIONS ============
function openChatModal() {
  document.getElementById('chatModal').classList.add('active');
}

function closeChatModal() {
  document.getElementById('chatModal').classList.remove('active');
}

function openTicketsModal() {
  document.getElementById('ticketsModal').classList.add('active');
  loadTickets();
}

function closeTicketsModal() {
  document.getElementById('ticketsModal').classList.remove('active');
}

function openCreateTicketModal() {
  document.getElementById('createTicketModal').classList.add('active');
}

function closeCreateTicketModal() {
  document.getElementById('createTicketModal').classList.remove('active');
}

function openContactModal() {
  document.getElementById('contactModal').classList.add('active');
  loadSchoolsContact();
}

function closeContactModal() {
  document.getElementById('contactModal').classList.remove('active');
}

function openSettingsModal() {
  document.getElementById('settingsModal').classList.add('active');
  loadSettings();
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

function openNotifications() {
  showAlert('info', 'You have no new notifications');
}

// ============ CHAT FUNCTIONS ============
async function sendMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  if (!message) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });

    if (response.ok) {
      const messagesContainer = document.getElementById('chatMessages');
      const userMsg = document.createElement('div');
      userMsg.className = 'chat-message user';
      userMsg.innerHTML = `
        <div class="chat-avatar">You</div>
        <div class="chat-bubble"></div>
      `;
      userMsg.querySelector('.chat-bubble').textContent = message;
      messagesContainer.appendChild(userMsg);

      chatInput.value = '';
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showAlert('error', 'Failed to send message');
  }
}

// ============ TICKET FUNCTIONS ============
async function loadTickets() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/support-tickets`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to load tickets');

    const responseData = await response.json();
    const tickets = responseData.data || responseData.tickets || [];
    const ticketsContainer = document.getElementById('ticketsContainer');

    if (tickets.length === 0) {
      ticketsContainer.innerHTML =
        '<p style="text-align:center;color:var(--text-light);">No tickets yet</p>';
      return;
    }

    ticketsContainer.innerHTML = tickets.map(ticket => `
      <div class="ticket-item">
        <div class="ticket-header">
          <div class="ticket-id">#${ticket.id}</div>
          <div class="ticket-status ${String(ticket.status || '').toLowerCase()}">${ticket.status || ''}</div>
        </div>
        <div class="ticket-title">${ticket.subject || ''}</div>
        <div class="ticket-meta">
          Created: ${ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : '-'}
          | Category: ${ticket.category || '-'}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading tickets:', error);
  }
}

async function submitTicket(event) {
  event.preventDefault();

  const subject = document.getElementById('ticketSubject').value;
  const category = document.getElementById('ticketCategory').value;
  const priority = document.getElementById('ticketPriority').value;
  const description = document.getElementById('ticketDescription').value;

  try {
    const response = await fetch(`${API_BASE_URL}/api/support-tickets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ subject, category, priority, description })
    });

    if (response.ok) {
      showAlert('success', 'Support ticket created successfully!');
      closeCreateTicketModal();
      document.getElementById('ticketForm').reset();
      loadTickets();
    } else {
      showAlert('error', 'Failed to create support ticket.');
    }
  } catch (error) {
    console.error('Error submitting ticket:', error);
    showAlert('error', 'Failed to create ticket');
  }
}

// ============ SCHOOL CONTACT FUNCTIONS ============
async function loadSchoolsContact() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schools-contact`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to load schools');

    const responseData = await response.json();
    const schoolsList = responseData.data || responseData.schools || [];
    const container = document.getElementById('schoolsContactList');

    container.innerHTML = schoolsList.map(school => `
      <div style="background:var(--bg-lighter);padding:16px;border-radius:10px;margin-bottom:12px;border-left:4px solid var(--accent);">
        <div style="font-weight:800;color:var(--primary);margin-bottom:8px;">
          ${school.schoolName || school.name || ''}
        </div>
        <div style="font-size:.9rem;color:var(--text-light);margin-bottom:4px;">
          <i class="fas fa-phone"></i> ${school.phone || ''}
        </div>
        <div style="font-size:.9rem;color:var(--text-light);margin-bottom:8px;">
          <i class="fas fa-envelope"></i> ${school.email || ''}
        </div>
        <div style="font-size:.9rem;color:var(--text-light);margin-bottom:12px;">
          <i class="fas fa-map-marker-alt"></i> ${school.address || school.city || ''}
        </div>
        <a href="tel:${school.phone || ''}" class="header-btn" style="font-size:.85rem;padding:6px 12px;">
          <i class="fas fa-phone"></i> Call
        </a>
        <a href="mailto:${school.email || ''}" class="header-btn" style="font-size:.85rem;padding:6px 12px;margin-left:4px;">
          <i class="fas fa-envelope"></i> Email
        </a>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading schools:', error);
  }
}

// ============ SETTINGS FUNCTIONS ============
async function loadSettings() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user-settings`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return;

    const responseData = await response.json();
    const settings = responseData.data || responseData.settings || responseData;

    document.getElementById('settingsInstitution').value = settings.institutionName || '';
    document.getElementById('settingsEmail').value = settings.email || '';
    document.getElementById('settingsPhone').value = settings.phone || '';
    document.getElementById('notificationsEnabled').checked =
      settings.notificationsEnabled !== false;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  const settings = {
    institutionName: document.getElementById('settingsInstitution').value,
    email: document.getElementById('settingsEmail').value,
    phone: document.getElementById('settingsPhone').value,
    notificationsEnabled: document.getElementById('notificationsEnabled').checked
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/user-settings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });

    if (response.ok) {
      showAlert('success', 'Settings saved successfully!');
      closeSettingsModal();
    } else {
      showAlert('error', 'Failed to save settings.');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showAlert('error', 'Failed to save settings');
  }
}

// ============ UTILITY FUNCTIONS ============
function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.toggle('active', show);
}

function switchPage(pageName, element) {
  document.getElementById('verifyPage').style.display = 'none';
  document.getElementById('historyPage').style.display = 'none';
  document.getElementById(`${pageName}Page`).style.display = 'block';

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  if (element) element.classList.add('active');

  const titles = {
    verify: {
      title: 'Verify Student Report',
      subtitle: 'Search and verify academic credentials'
    },
    history: {
      title: 'Verification History',
      subtitle: 'View your past verification requests'
    }
  };

  document.getElementById('pageTitle').textContent =
    titles[pageName]?.title || 'ExamGuard';

  const subtitle = document.getElementById('pageSubtitle');
  if (subtitle) {
    subtitle.textContent = titles[pageName]?.subtitle || '';
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('active');
}

function updateSchoolInfo() {
  const schoolId = document.getElementById('schoolName').value;
  const school = schools.find(item =>
    String(item._id || item.id || item.schoolId) === String(schoolId)
  );

  if (school) console.log('Selected school:', school);
}

async function addToHistory(report) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/verification-history`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        studentName: report.studentName,
        regNo: report.regNo,
        schoolId: report.school._id || report.school.id,
        verificationCode: report.verificationCode
      })
    });

    if (response.ok) loadVerificationHistory();
  } catch (error) {
    console.error('Error saving to history:', error);
  }
}

function printReport() {
  window.print();
}

function downloadReport() {
  if (!currentReport) return;

  const subjects = Array.isArray(currentReport.subjects)
    ? currentReport.subjects
    : [];
  const totalScore = parseFloat(currentReport.totalScore) || 0;
  const average = subjects.length
    ? totalScore / subjects.length
    : 0;

  const content = `
STUDENT ACADEMIC REPORT - VERIFICATION CERTIFICATE
====================================================
School: ${currentReport.school?.name || ''}
Student: ${currentReport.studentName || ''}
Registration: ${currentReport.regNo || ''}
Session: ${currentReport.session?.name || ''}
Term: ${currentReport.term?.name || ''}
Class: ${currentReport.classLevel?.name || ''}

ACADEMIC PERFORMANCE
====================
Total Score: ${totalScore.toFixed(2)}
Average: ${average.toFixed(2)}
Grade: ${currentReport.overallGrade || ''}

VERIFICATION
=============
Code: ${currentReport.verificationCode || ''}
Date: ${new Date().toLocaleDateString()}
Status: VERIFIED

This is an electronically verified document from ExamGuard.
`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Report_${currentReport.regNo || 'student'}_${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(link);

  showAlert('success', 'Report downloaded successfully!');
}

function shareReport() {
  if (!currentReport) return;

  const shareUrl =
    `${window.location.origin}?verify=${encodeURIComponent(currentReport.verificationCode || '')}`;

  if (navigator.share) {
    navigator.share({
      title: `${currentReport.studentName}'s Report`,
      text: `Verified academic report for ${currentReport.studentName}`,
      url: shareUrl
    }).catch(error => {
      console.error('Error sharing report:', error);
    });
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = shareUrl;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showAlert('success', 'Report link copied to clipboard!');
  }
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.clear();
    window.location.href = '/login';
  }
}

// Close modals on Escape.
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});

// Close modals when clicking outside.
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', function(event) {
    if (event.target === this) {
      this.classList.remove('active');
    }
  });
});
