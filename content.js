let lastCalculation = null;
let observerTimer = null;

// Create a MutationObserver to watch for grade changes
const observer = new MutationObserver((mutations) => {
  // Debounce the calculation to avoid multiple rapid updates
  clearTimeout(observerTimer);
  observerTimer = setTimeout(calculateAndStoreGrades, 500);
});

function startObserving() {
  const gradesContainer = document.querySelector('#grades_summary');
  if (gradesContainer) {
    observer.observe(gradesContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    // Initial calculation
    calculateAndStoreGrades();
  }
}

function calculateAndStoreGrades() {
  const results = getAssignmentDetails();
  
  // Only update if the grades have changed
  if (JSON.stringify(results) !== JSON.stringify(lastCalculation)) {
    lastCalculation = results;
    chrome.storage.local.set({ grades: results });
  }
}

function getAssignmentDetails() {
  // Get assignment group weights with better parsing
  const weightGroups = {};
  const weightTable = document.querySelector('div[aria-label="Assignment Weights"] table.summary tbody');
  
  if (weightTable) {
      weightTable.querySelectorAll('tr:not(:last-child)').forEach(row => {
          const groupName = row.querySelector('th').textContent.trim();
          const weightText = row.querySelector('td').textContent.trim();
          const weight = parseFloat(weightText.replace('%', '')) / 100;
          
          // Extract the base group name without the weight info
          const baseGroupName = groupName.trim();
          if (weight > 0) {
              weightGroups[baseGroupName] = weight;
              console.log(`Found weight group: "${baseGroupName}" with weight ${weight}`);
          }
      });
  }
  
  // Get graded assignments
  const assignments = document.querySelectorAll('tr.student_assignment.assignment_graded.editable');
  const grades = [];
  const groupTotals = {};  // Track totals for each group
  
  // Initialize group totals
  for (const group in weightGroups) {
      groupTotals[group] = {
          earned: 0,
          possible: 0,
          assignments: []
      };
  }
  
  assignments.forEach(row => {
      try {
          // Get assignment name and group info
          const titleCell = row.querySelector('th.title');
          const name = titleCell?.querySelector('a')?.textContent.trim() || 'Unknown Assignment';
          // Extract group name from the context, handling multiple formats
          const contextElement = titleCell?.querySelector('.context');
          const contextText = contextElement?.textContent.trim() || '';
          // The group name is usually before the first | character
          const groupName = contextText.split('|')[0].trim();
          
          // Get score details
          const scoreCell = row.querySelector('td.assignment_score');
          const gradeSpan = scoreCell?.querySelector('.tooltip .grade')?.lastChild?.textContent.trim();
          const totalSpan = scoreCell?.querySelector('.tooltip > span:last-child')?.textContent.trim();
          const status = scoreCell?.querySelector('.submission_status')?.textContent.trim();
          
          // Extract the numbers
          const earned = gradeSpan === '-' ? null : parseFloat(gradeSpan);
          const possible = parseFloat(totalSpan?.replace('/ ', ''));
          
          if (!isNaN(possible)) {
              const assignmentData = {
                  name,
                  earned,
                  possible,
                  group: groupName,
                  status,
                  isSubmitted: status !== 'unsubmitted'
              };
              
              grades.push(assignmentData);
              
              // Debug logging for group matching
              console.log(`Assignment "${name}":`);
              console.log(`  Group name from Canvas: "${groupName}"`);
              console.log(`  Has weight group match: ${weightGroups.hasOwnProperty(groupName)}`);
              
              // Add to group totals if submitted
              if (earned !== null && weightGroups.hasOwnProperty(groupName)) {
                  groupTotals[groupName].earned += earned;
                  groupTotals[groupName].possible += possible;
                  groupTotals[groupName].assignments.push(assignmentData);
              }
          }
          
      } catch (error) {
          console.error('Error processing row:', error);
      }
  });
  
  // Calculate weighted grade
  let weightedTotal = 0;
  let weightedPossible = 0;
  
  console.log('\nGrade Breakdown by Group:');
  for (const group in groupTotals) {
      const { earned, possible, assignments } = groupTotals[group];
      if (possible > 0) {
          const groupWeight = weightGroups[group];
          const groupScore = (earned / possible) * 100;
          const weightedScore = groupScore * groupWeight;
          weightedTotal += weightedScore;
          weightedPossible += groupWeight;
          
          console.log(`${group}:`);
          console.log(`  Raw Score: ${groupScore.toFixed(2)}%`);
          console.log(`  Weight: ${(groupWeight * 100).toFixed(0)}%`);
          console.log(`  Weighted Score: ${weightedScore.toFixed(2)}`);
          console.log(`  Assignments: ${assignments.length}`);
      }
  }
  
  // Calculate final weighted grade
  const finalWeightedGrade = weightedPossible > 0 ? 
      (weightedTotal / weightedPossible) : 0;
  
  console.log('\nSummary:');
  console.log('Total graded assignments:', grades.length);
  console.log('Submitted assignments:', grades.filter(g => g.isSubmitted).length);
  console.log('Missing assignments:', grades.filter(g => !g.isSubmitted).length);
  console.log('Final Weighted Grade:', finalWeightedGrade.toFixed(2) + '%');
  
  // Debug output
  console.log('\nDetailed Group Data:');
  console.log('Weight Groups:', weightGroups);
  console.log('Group Totals:', groupTotals);
  
  return {
      grades,
      groupTotals,
      weightGroups,
      finalWeightedGrade
  };
}
// Start observing when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
}