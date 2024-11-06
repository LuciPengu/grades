chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateGrades") {
      chrome.storage.local.set({ grades: request.grades });
    }
  });
  