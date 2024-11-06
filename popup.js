document.addEventListener('DOMContentLoaded', () => {
  const loadingElement = document.getElementById('loading');
  const resultsElement = document.getElementById('results');
  const errorElement = document.getElementById('error');
  const notOnCanvas = document.getElementById('not-on-canvas');
  
  // Get current tab and check for Canvas grades page
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab.url.includes('instructure.com/courses/') || !tab.url.includes('/grades')) {
      notOnCanvas.style.display = 'block';
      loadingElement.style.display = 'none';
      return;
    }

    // Get stored grades
    chrome.storage.local.get('grades', (data) => {
      if (data.grades) {
        displayResults(data.grades);
        setupEventListeners();
      } else {
        errorElement.textContent = 'Waiting for grade calculations to complete...';
        errorElement.style.display = 'block';
      }
      loadingElement.style.display = 'none';
    });
  });
});

function setupEventListeners() {
  // Use event delegation for group toggles
  document.querySelector('.grade-groups').addEventListener('click', (e) => {
    const groupHeader = e.target.closest('.group-header');
    if (groupHeader) {
      const section = groupHeader.closest('.group-section');
      const content = section.querySelector('.assignments-list');
      const icon = section.querySelector('.toggle-icon');
      
      if (content.style.display === 'block') {
        content.style.display = 'none';
        section.classList.remove('active');
      } else {
        content.style.display = 'block';
        section.classList.add('active');
      }
    }
  });
}

function displayResults(results) {
  const resultsElement = document.getElementById('results');
  const lastUpdated = new Date().toLocaleTimeString();
  
  let html = `
    <div class="summary">
      <h3>Current Grade</h3>
      <div class="grade-pill">${results.finalWeightedGrade.toFixed(2)}%</div>
      <div class="update-time">Last updated: ${lastUpdated}</div>
      <div class="stats">
        <div class="stat">
          <span class="label">Total</span>
          <span class="value">${results.grades.length}</span>
        </div>
        <div class="stat">
          <span class="label">Submitted</span>
          <span class="value">${results.grades.filter(g => g.isSubmitted).length}</span>
        </div>
        <div class="stat">
          <span class="label">Missing</span>
          <span class="value">${results.grades.filter(g => !g.isSubmitted).length}</span>
        </div>
      </div>
    </div>

    <div class="breakdown">
      <h3>Grade Breakdown</h3>
      <div class="grade-groups">
  `;

  // Group assignments by their group
  const assignmentsByGroup = {};
  results.grades.forEach(assignment => {
    if (!assignmentsByGroup[assignment.group]) {
      assignmentsByGroup[assignment.group] = [];
    }
    assignmentsByGroup[assignment.group].push(assignment);
  });

  for (const group in results.groupTotals) {
    const { earned, possible } = results.groupTotals[group];
    if (possible > 0) {
      const groupWeight = results.weightGroups[group];
      const groupScore = (earned / possible) * 100;
      const weightedScore = groupScore * groupWeight;
      const assignments = assignmentsByGroup[group] || [];
      const groupId = `group-${group.replace(/\s+/g, '-')}`;

      html += `
        <div class="group-section">
          <div class="group-header">
            <div class="group-summary">
              <span class="group-name">${group}</span>
              <span class="group-stats">
                ${groupScore.toFixed(2)}% x ${(groupWeight * 100).toFixed(0)}% = ${weightedScore.toFixed(2)}
              </span>
            </div>
            <span class="toggle-icon">v</span>
          </div>
          <div class="assignments-list" id="${groupId}">
            <table class="assignments-table">
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
      `;

      assignments.forEach(assignment => {
        const score = assignment.earned !== null 
          ? `${assignment.earned}/${assignment.possible} (${((assignment.earned/assignment.possible) * 100).toFixed(2)}%)`
          : '-';
        
        html += `
          <tr class="${assignment.isSubmitted ? 'submitted' : 'missing'}">
            <td>${assignment.name}</td>
            <td>${score}</td>
            <td>${assignment.status || (assignment.isSubmitted ? 'submitted' : 'missing')}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  html += `
      </div>
    </div>
  `;

  resultsElement.innerHTML = html;
  resultsElement.style.display = 'block';
}