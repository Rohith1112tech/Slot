/**
 * ========================================================
 * NEXUS ARENA - Google Apps Script Backend Webhook
 * ========================================================
 * Deploy this as a Web App:
 * 1. Open Google Sheets (create a sheet named "TournamentSlots")
 * 2. Extensions > Apps Script
 * 3. Paste this code into Code.gs
 * 4. Click 'Deploy' > 'New deployment'
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web app URL and paste it into the NEXUS ARENA Admin Panel!
 */

const SHEET_NAME = 'TournamentSlots';
const TOTAL_SLOTS = 12;

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Slot Number', 'Team Name', 'IGL Name', 'Is Booked', 'Last Updated', 'Action History']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    
    // Seed 12 slots
    for (let i = 1; i <= TOTAL_SLOTS; i++) {
      sheet.appendRow([i, '', '', 'FALSE', new Date().toISOString(), 'INITIALIZED']);
    }
  }
  return sheet;
}

/**
 * GET: Returns all 12 slots as JSON
 */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getRange(2, 1, TOTAL_SLOTS, 4).getValues();
    
    const slots = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      slots.push({
        slotNumber: Number(row[0] || i + 1),
        teamName: String(row[1] || ''),
        iglName: String(row[2] || ''),
        isBooked: String(row[3]).toUpperCase() === 'TRUE' || row[3] === true
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      totalSlots: slots.length,
      slots: slots
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST: Updates a slot on Claim, Edit, Clear, Manual Assign, or Reset
 * Payload: { slotNumber, teamName, iglName, actionType, timestamp }
 */
function doPost(e) {
  try {
    const contents = e.postData.contents;
    const payload = JSON.parse(contents);
    const sheet = getOrCreateSheet();

    const slotNumber = Number(payload.slotNumber);
    const teamName = payload.teamName || '';
    const iglName = payload.iglName || '';
    const actionType = payload.actionType || 'UNKNOWN';
    const timestamp = payload.timestamp || new Date().toISOString();

    if (actionType === 'RESET_ALL') {
      // Clear all 12 slots
      for (let i = 1; i <= TOTAL_SLOTS; i++) {
        const rowIndex = i + 1;
        sheet.getRange(rowIndex, 2, 1, 5).setValues([['', '', 'FALSE', timestamp, 'RESET_ALL']]);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        actionType: 'RESET_ALL',
        message: 'All 12 slots have been reset'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (slotNumber < 1 || slotNumber > TOTAL_SLOTS) {
      throw new Error('Invalid slotNumber: ' + slotNumber);
    }

    const rowIndex = slotNumber + 1; // +1 for header row
    const isBooked = (actionType === 'CLEAR') ? 'FALSE' : 'TRUE';

    // Update row: [Team Name, IGL Name, Is Booked, Last Updated, Action History]
    sheet.getRange(rowIndex, 2, 1, 5).setValues([[
      actionType === 'CLEAR' ? '' : teamName,
      actionType === 'CLEAR' ? '' : iglName,
      isBooked,
      timestamp,
      actionType
    ]]);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      slotNumber: slotNumber,
      isBooked: isBooked === 'TRUE',
      actionType: actionType,
      updatedAt: timestamp
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
