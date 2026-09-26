const { app } = require('electron');
const { initDatabase } = require('../src/main/database/connection');
const { IssuesRepo } = require('../src/main/database/repositories/issues');

app.whenReady().then(async () => {
  try {
    await initDatabase();
    
    // Find issue
    const issues = await IssuesRepo.getAll({ search: 'ISS-1063' });
    console.log(`Found ${issues.length} issues`);
    
    const issue = issues.find(i => i.issue_id === 'ISS-1063');
    if (issue) {
      console.log('Deleting issue', issue.id);
      await IssuesRepo.deleteIssue(issue.id);
      console.log('Deleted successfully');
    } else {
      console.log('Issue ISS-1063 not found.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    app.quit();
  }
});
