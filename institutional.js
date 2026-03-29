    // ============ API CONFIGURATION ============
    const API_BASE_URL = "https://examguard-8rxe.onrender.com";
    const token = localStorage.getItem('adminToken') || '';

    // ============ STATE ============
    let currentReport = null;
    let verificationHistory = [];
    let schools = [];
    let sessions = [];
    let terms = [];
    let classLevels = [];
    let unreadMessages = 0;
    let unreadTickets = 0;

    // ============ INITIALIZATION ============
    document.addEventListener('DOMContentLoaded', function() {
      initializeApp();
      setupEventListeners();
      setupFormValidation();
      loadInitialData();
      
      // Show sidebar toggle on mobile
      if (window.innerWidth <= 900) {
        document.getElementById('toggleSidebarBtn').style.display = 'flex';
      }
    });

    function initializeApp() {
      // Set user info from localStorage
      const userName = localStorage.getItem('userName') || 'User';
      const userRole = localStorage.getItem('userRole') || 'Institution';
      
      document.getElementById('userNameSidebar').textContent = userName;
      document.getElementById('userRoleSidebar').textContent = userRole;
    }

    function setupEventListeners() {
      document.getElementById('verificationForm').addEventListener('submit', handleVerification);
      
      // Clear form errors on input
      document.querySelectorAll('.form-input, .form-select').forEach(field => {
        field.addEventListener('input', function() {
          const errorEl = document.getElementById(this.id + '-error');
          if (errorEl) {
            this.classList.remove('error');
            errorEl.classList.remove('show');
          }
        });
      });

      // Load terms and class levels when session is selected
      document.getElementById('session').addEventListener('change', function() {
        loadTerms(this.value);
        loadClassLevels(this.value);
      });
    }

    function setupFormValidation() {
      // Real-time validation
      document.getElementById('regNo').addEventListener('input', function() {
        this.value = this.value.toUpperCase();
      });

      document.getElementById('scratchCard').addEventListener('input', function() {
        this.value = this.value.toUpperCase();
      });
    }

    // ============ LOAD INITIAL DATA ============
    async function loadInitialData() {
      try {
        showLoading(true);
        
        // Load schools
        await loadSchools();
        
        // Load sessions
        await loadSessions();
        
        // Load verification history
        await loadVerificationHistory();
        
        showLoading(false);
      } catch (error) {
        console.error('Error loading initial data:', error);
        showLoading(false);
      }
    }

    async function loadSchools() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/schools`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to load schools');
        
        const responseData = await response.json();
        
        // Extract schools array from the response wrapper
        schools = responseData.data || [];
        populateSchoolDropdown();
      } catch (error) {
        console.error('Error loading schools:', error);
        showAlert('error', 'Could not load schools. Please refresh the page.');
      }
    }

    function populateSchoolDropdown() {
      const schoolSelect = document.getElementById('schoolName');
      
      // Ensure schools is an array
      if (!Array.isArray(schools)) {
        console.error('Schools is not an array:', schools);
        return;
      }
      
      schools.forEach(school => {
        const option = document.createElement('option');
        option.value = school._id || school.id;
        option.textContent = school.schoolName || school.name;
        schoolSelect.appendChild(option);
      });
    }

    async function loadSessions() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/academics/sessions`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error('Sessions API Response:', response.status, response.statusText);
          throw new Error(`Failed to load sessions: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log('Sessions Response:', responseData);
        
        // Extract sessions array from the response
        let sessionsList = [];
        
        if (Array.isArray(responseData)) {
          // Direct array response
          sessionsList = responseData;
        } else if (responseData.data && Array.isArray(responseData.data)) {
          // Wrapped in data property
          sessionsList = responseData.data;
        } else if (responseData.sessions && Array.isArray(responseData.sessions)) {
          // Wrapped in sessions property
          sessionsList = responseData.sessions;
        }
        
        console.log('Parsed Sessions:', sessionsList);
        
        sessions = sessionsList;
        const sessionSelect = document.getElementById('session');
        
        if (!sessionSelect) {
          console.error('Session select element not found');
          return;
        }
        
        // Clear existing options (keep the default)
        while (sessionSelect.options.length > 1) {
          sessionSelect.remove(1);
        }
        
        if (sessionsList.length === 0) {
          console.warn('No sessions returned from API');
          return;
        }
        
        sessionsList.forEach(session => {
          const option = document.createElement('option');
          option.value = session._id || session.id;
          option.textContent = session.name;
          sessionSelect.appendChild(option);
          console.log('Added session option:', session.name);
        });
        
      } catch (error) {
        console.error('Error loading sessions:', error);
        showAlert('warning', 'Could not load sessions. Please contact support.');
      }
    }

    async function loadTerms(sessionId) {
      try {
        if (!sessionId) {
          // Clear terms if no session selected
          terms = [];
          populateTermDropdown();
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/academics/terms?sessionId=${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error('Terms API Response:', response.status, response.statusText);
          throw new Error(`Failed to load terms: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log('Terms Response:', responseData);
        
        // Extract terms array from the response
        let termsList = [];
        
        if (Array.isArray(responseData)) {
          termsList = responseData;
        } else if (responseData.data && Array.isArray(responseData.data)) {
          termsList = responseData.data;
        } else if (responseData.terms && Array.isArray(responseData.terms)) {
          termsList = responseData.terms;
        }
        
        console.log('Parsed Terms:', termsList);
        
        terms = termsList;
        populateTermDropdown();
        
      } catch (error) {
        console.error('Error loading terms:', error);
        showAlert('warning', 'Could not load terms. Please contact support.');
      }
    }

    function populateTermDropdown() {
      const termSelect = document.getElementById('term');
      
      // Clear existing options (keep the default)
      while (termSelect.options.length > 1) {
        termSelect.remove(1);
      }
      
      if (!Array.isArray(terms) || terms.length === 0) {
        console.warn('No terms to populate');
        return;
      }
      
      terms.forEach(term => {
        const option = document.createElement('option');
        // Store the term ID as value (for reference), but we'll extract the name when submitting
        option.value = term._id || term.id;
        option.textContent = term.name;
        option.dataset.termName = term.name; // Store term name in data attribute
        termSelect.appendChild(option);
        console.log('Added term option:', term.name);
      });
    }

    async function loadClassLevels(sessionId) {
      try {
        if (!sessionId) {
          // Clear class levels if no session selected
          classLevels = [];
          populateClassLevelDropdown();
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/academics/class-levels?sessionId=${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error('Class Levels API Response:', response.status, response.statusText);
          throw new Error(`Failed to load class levels: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log('Class Levels Response:', responseData);
        
        // Extract class levels array from the response
        let classLevelsList = [];
        
        if (Array.isArray(responseData)) {
          classLevelsList = responseData;
        } else if (responseData.data && Array.isArray(responseData.data)) {
          classLevelsList = responseData.data;
        } else if (responseData.classLevels && Array.isArray(responseData.classLevels)) {
          classLevelsList = responseData.classLevels;
        }
        
        console.log('Parsed Class Levels:', classLevelsList);
        
        classLevels = classLevelsList;
        populateClassLevelDropdown();
        
      } catch (error) {
        console.error('Error loading class levels:', error);
        showAlert('warning', 'Could not load class levels. Please contact support.');
      }
    }

    function populateClassLevelDropdown() {
      const classSelect = document.getElementById('classLevel');
      
      // Clear existing options (keep the default)
      while (classSelect.options.length > 1) {
        classSelect.remove(1);
      }
      
      if (!Array.isArray(classLevels) || classLevels.length === 0) {
        console.warn('No class levels to populate');
        return;
      }
      
      classLevels.forEach(classLevel => {
        const option = document.createElement('option');
        option.value = classLevel._id || classLevel.id;
        option.textContent = classLevel.name;
        option.dataset.className = classLevel.name; // Store class name in data attribute
        classSelect.appendChild(option);
        console.log('Added class level option:', classLevel.name);
      });
    }

    async function loadVerificationHistory() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/verification-history`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to load history');
        
        const responseData = await response.json();
        
        // Extract history array from the response wrapper
        verificationHistory = responseData.data || responseData.history || [];
        updateHistoryBadge();
      } catch (error) {
        console.error('Error loading history:', error);
      }
    }

    function updateHistoryBadge() {
      const badge = document.getElementById('historyBadge');
      if (verificationHistory.length > 0) {
        badge.textContent = verificationHistory.length;
      }
    }

    // ============ VERIFICATION FUNCTION ============
    async function handleVerification(event) {
      event.preventDefault();

      if (!validateForm()) {
        return;
      }
document.querySelector('.two-column').classList.remove('report-visible');

      const schoolId = document.getElementById('schoolName').value;
      const regNo = document.getElementById('regNo').value.trim();
      const scratchCard = document.getElementById('scratchCard').value.trim();
      const sessionId = document.getElementById('session').value;
      
      // Get term name from the selected option's data attribute
      const termSelect = document.getElementById('term');
      const termOption = termSelect.options[termSelect.selectedIndex];
      const termName = termOption.dataset.termName || termOption.text;
      
      // Get class name from the selected option's data attribute
      const classSelect = document.getElementById('classLevel');
      const classOption = classSelect.options[classSelect.selectedIndex];
      const className = classOption.dataset.className || classOption.text;
      
      const verificationPurpose = document.getElementById('verificationPurpose').value;
      const institutionName = document.getElementById('institutionName').value.trim();

      try {
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Verifying...';

        const response = await fetch(`${API_BASE_URL}/api/res/verify-student-report`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            schoolId,
            regNo,
            scratchCard,
            sessionId,
            termName, // Send term name instead of ID
            className, // Send class name instead of ID
            verificationPurpose,
            institutionName
          })
        });

        const data = await response.json();

        if (response.ok && data.verified) {
          currentReport = data.data;
          displayReport(currentReport);
          showAlert('success', `Report for ${currentReport.studentName} verified successfully!`);
          
          // Add to history
          addToHistory(currentReport);
          
          // Scroll to report
          setTimeout(() => {
            document.getElementById('reportCard').scrollIntoView({ behavior: 'smooth' });
          }, 300);
        } else {
          showAlert('error', data.message || 'Verification failed. Please check your details and try again.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        showAlert('error', 'An error occurred during verification. Please try again later.');
      } finally {
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Verify Report';
      }
    }

    function validateForm() {
      let isValid = true;
      const fields = ['schoolName', 'regNo', 'scratchCard', 'session', 'term', 'classLevel', 'verificationPurpose', 'institutionName'];

      fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const errorEl = document.getElementById(fieldId + '-error');
        
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
    // ============ DISPLAY REPORT ============
    function displayReport(data) {
       document.querySelector('.two-column').classList.add('report-visible');
  
  document.getElementById('reportEmpty').style.display = 'none';
  document.getElementById('reportCard').style.display = 'block';

      // Convert string values to numbers
      const totalScore = parseFloat(data.totalScore) || 0;
      const averageScore = parseFloat(data.averageScore) || 0;

      // Header
      document.getElementById('reportStudentName').textContent = data.studentName;
      document.getElementById('reportRegNo').textContent = `REG: ${data.regNo}`;
      document.getElementById('reportSchoolName').textContent = `School: ${data.school.name}`;
      document.getElementById('reportYear').textContent = `Session: ${data.session.name}`;

      // Summary
      document.getElementById('reportTerm').textContent = data.term.name;
      document.getElementById('reportClass').textContent = data.classLevel.name;
      document.getElementById('reportTotalScore').textContent = totalScore.toFixed(2);
      document.getElementById('reportAverageScore').textContent = averageScore.toFixed(2);
      
      // Calculate highest score from subjects
      let highestScore = 0;
      if (data.subjects && data.subjects.length > 0) {
        highestScore = Math.max(...data.subjects.map(s => parseFloat(s.total) || 0));
      }
      document.getElementById('reportHighestScore').textContent = highestScore.toFixed(2);
      
      const gradeEl = document.getElementById('reportGrade');
      gradeEl.textContent = data.overallGrade;
      gradeEl.className = `info-item-value grade grade-${data.overallGrade.toLowerCase()}`;

      // Subjects
      const tableBody = document.getElementById('subjectsTableBody');
      tableBody.innerHTML = '';
      
      if (!data.subjects || data.subjects.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-light);">No subject data</td></tr>';
      } else {
        data.subjects.forEach(subject => {
          const row = document.createElement('tr');
          const total = parseFloat(subject.total) || 0;
          const ca1 = subject.ca1 || '-';
          const ca2 = subject.ca2 || '-';
          const midterm = subject.midterm || '-';
          const exam = subject.exam || '-';
          
          row.innerHTML = `
            <td class="subject-name">${subject.name}</td>
            <td class="score">${ca1}</td>
            <td class="score">${ca2}</td>
            <td class="score">${midterm}</td>
            <td class="score">${exam}</td>
            <td class="score score-total">${total.toFixed(2)}</td>
            <td style="text-align: center;"><span class="grade-badge grade-${(subject.grade || 'f').toLowerCase()}">${subject.grade}</span></td>
            
          `;
          tableBody.appendChild(row);
        });
      }

      // Skills
      if (data.skills) {
        document.getElementById('skillsPunctuality').textContent = data.skills.punctuality || '-';
        document.getElementById('skillsObedience').textContent = data.skills.obedience || '-';
        document.getElementById('skillsHonesty').textContent = data.skills.honesty || '-';
        document.getElementById('skillsCleanliness').textContent = data.skills.cleanliness || '-';
        document.getElementById('skillsInitiative').textContent = data.skills.initiative || '-';
        document.getElementById('skillsCooperation').textContent = data.skills.cooperation || '-';
      }

      // Attendance
      if (data.attendance) {
        document.getElementById('attendancePresent').textContent = data.attendance.present || '-';
        document.getElementById('attendanceAbsent').textContent = data.attendance.absent || '-';
        const rate = parseFloat(data.attendance.rate) || 0;
        document.getElementById('attendanceRate').textContent = rate.toFixed(1) + '%';
      }

      // Comments
      if (data.teacherComment) {
        document.getElementById('teacherComment').textContent = data.teacherComment.comment;
        document.getElementById('teacherName').innerHTML = `<strong>Teacher:</strong> ${data.teacherComment.teacherName}`;
      }

      if (data.principalRemark) {
        document.getElementById('principalRemark').textContent = data.principalRemark.remark;
        document.getElementById('principalName').innerHTML = `<strong>Principal:</strong> ${data.principalRemark.principalName}`;
      }

      // Verification Info
      document.getElementById('reportVerificationCode').textContent = data.verificationCode;
      document.getElementById('reportIssueDate').textContent = new Date(data.issueDate).toLocaleDateString();
    }

    // ============ ALERT FUNCTION ============
    function showAlert(type, message) {
      document.querySelectorAll('.alert').forEach(alert => {
        alert.classList.remove('show');
      });

      const alertEl = document.getElementById(type + 'Alert');
      if (!alertEl) return;

      const messageEl = alertEl.querySelector('[id$="Message"]');
      if (messageEl) {
        messageEl.textContent = message;
      }

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
          
          // Add user message
          const userMsg = document.createElement('div');
          userMsg.className = 'chat-message user';
          userMsg.innerHTML = `
            <div class="chat-avatar">You</div>
            <div class="chat-bubble">${message}</div>
          `;
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
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to load tickets');

        const responseData = await response.json();
        
        // Extract tickets array from the response wrapper
        const tickets = responseData.data || responseData.tickets || [];
        const ticketsContainer = document.getElementById('ticketsContainer');
        
        if (tickets.length === 0) {
          ticketsContainer.innerHTML = '<p style="text-align: center; color: var(--text-light);">No tickets yet</p>';
          return;
        }

        ticketsContainer.innerHTML = tickets.map(ticket => `
          <div class="ticket-item">
            <div class="ticket-header">
              <div class="ticket-id">#${ticket.id}</div>
              <div class="ticket-status ${ticket.status.toLowerCase()}">${ticket.status}</div>
            </div>
            <div class="ticket-title">${ticket.subject}</div>
            <div class="ticket-meta">Created: ${new Date(ticket.createdAt).toLocaleDateString()} | Category: ${ticket.category}</div>
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
          body: JSON.stringify({
            subject,
            category,
            priority,
            description
          })
        });

        if (response.ok) {
          showAlert('success', 'Support ticket created successfully!');
          closeCreateTicketModal();
          document.getElementById('ticketForm').reset();
          loadTickets();
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
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to load schools');

        const responseData = await response.json();
        
        // Extract schools list from the response wrapper
        const schoolsList = responseData.data || responseData.schools || [];
        const container = document.getElementById('schoolsContactList');

        container.innerHTML = schoolsList.map(school => `
          <div style="background: var(--bg-lighter); padding: 16px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid var(--accent);">
            <div style="font-weight: 800; color: var(--primary); margin-bottom: 8px;">${school.schoolName || school.name}</div>
            <div style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 4px;">
              <i class="fas fa-phone"></i> ${school.phone}
            </div>
            <div style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 8px;">
              <i class="fas fa-envelope"></i> ${school.email}
            </div>
            <div style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 12px;">
              <i class="fas fa-map-marker-alt"></i> ${school.address || school.city}
            </div>
            <a href="tel:${school.phone}" class="header-btn" style="font-size: 0.85rem; padding: 6px 12px;">
              <i class="fas fa-phone"></i> Call
            </a>
            <a href="mailto:${school.email}" class="header-btn" style="font-size: 0.85rem; padding: 6px 12px; margin-left: 4px;">
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
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const responseData = await response.json();
          
          // Extract settings from the response wrapper
          const settings = responseData.data || responseData.settings || responseData;
          
          document.getElementById('settingsInstitution').value = settings.institutionName || '';
          document.getElementById('settingsEmail').value = settings.email || '';
          document.getElementById('settingsPhone').value = settings.phone || '';
          document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled !== false;
        }
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
        }
      } catch (error) {
        console.error('Error saving settings:', error);
        showAlert('error', 'Failed to save settings');
      }
    }

    // ============ UTILITY FUNCTIONS ============
    function showLoading(show) {
      document.getElementById('loadingOverlay').classList.toggle('active', show);
    }

    function switchPage(pageName, element) {
      // Hide all pages
      document.getElementById('verifyPage').style.display = 'none';
      document.getElementById('historyPage').style.display = 'none';

      // Show selected page
      document.getElementById(pageName + 'Page').style.display = 'block';

      // Update active nav item
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
      });
      element.classList.add('active');

      // Update header
      const titles = {
        verify: { title: 'Verify Student Report', subtitle: 'Search and verify academic credentials' },
        history: { title: 'Verification History', subtitle: 'View your past verification requests' }
      };

      document.getElementById('pageTitle').textContent = titles[pageName]?.title || 'ExamGuard';
      document.getElementById('pageSubtitle').textContent = titles[pageName]?.subtitle || '';
    }

    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('active');
    }

    function updateSchoolInfo() {
      const schoolId = document.getElementById('schoolName').value;
      const school = schools.find(s => (s._id || s.id) === schoolId);
      if (school) {
        console.log('Selected school:', school);
      }
    }

    async function addToHistory(report) {
      try {
        await fetch(`${API_BASE_URL}/api/verification-history`, {
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

        loadVerificationHistory();
      } catch (error) {
        console.error('Error saving to history:', error);
      }
    }

    function printReport() {
      window.print();
    }

    function downloadReport() {
      if (!currentReport) return;

      const content = `
STUDENT ACADEMIC REPORT - VERIFICATION CERTIFICATE
====================================================
School: ${currentReport.school.name}
Student: ${currentReport.studentName}
Registration: ${currentReport.regNo}
Session: ${currentReport.session.name}
Term: ${currentReport.term.name}
Class: ${currentReport.classLevel.name}

ACADEMIC PERFORMANCE
====================
Total Score: ${currentReport.totalScore.toFixed(2)}
Average: ${(currentReport.totalScore / currentReport.subjects.length).toFixed(2)}
Grade: ${currentReport.overallGrade}

VERIFICATION
=============
Code: ${currentReport.verificationCode}
Date: ${new Date().toLocaleDateString()}
Status: VERIFIED

This is an electronically verified document from ExamGuard.
`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${currentReport.regNo}_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showAlert('success', 'Report downloaded successfully!');
    }

    function shareReport() {
      if (!currentReport) return;

      const shareUrl = `${window.location.origin}?verify=${currentReport.verificationCode}`;

      if (navigator.share) {
        navigator.share({
          title: `${currentReport.studentName}'s Report`,
          text: `Verified academic report for ${currentReport.studentName}`,
          url: shareUrl
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

    // Close modals on escape
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
          modal.classList.remove('active');
        });
      }
    });

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', function(event) {
        if (event.target === this) {
          this.classList.remove('active');
        }
      });
    });
