/**
 * Sheets.gs — Google Sheets CRUD operations (repository layer).
 *
 * All direct SpreadsheetApp calls are isolated here.
 * Business logic in other files should only call these functions.
 */

// ============================================================
// Helpers
// ============================================================

function getSheet_(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    // Auto-create sheet if it doesn't exist
    sheet = ss.insertSheet(sheetName);
    // Write header row
    const headers = COLUMNS[sheetName];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

function getAllData_(sheetName) {
  const sheet = getSheet_(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // only header or empty
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, idx) => { row[h] = data[i][idx]; });
    rows.push(row);
  }
  return rows;
}

function findRowByColumn_(sheetName, columnName, value) {
  const sheet = getSheet_(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return -1;
  const headers = data[0];
  const colIdx = headers.indexOf(columnName);
  if (colIdx === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(value)) {
      return i + 1; // 1-based row number for Sheets API
    }
  }
  return -1;
}

function rowToObject_(sheetName, rowNum) {
  const sheet = getSheet_(sheetName);
  const headers = COLUMNS[sheetName];
  const row = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

// ============================================================
// Public CRUD API
// ============================================================

/**
 * Get all rows from a sheet as an array of objects.
 */
function sheetGetAll(sheetName) {
  return getAllData_(sheetName);
}

/**
 * Find a row by column value and return it as an object, or null.
 */
function sheetFindOne(sheetName, columnName, value) {
  const rowNum = findRowByColumn_(sheetName, columnName, value);
  if (rowNum === -1) return null;
  return rowToObject_(sheetName, rowNum);
}

/**
 * Insert a new row. `data` is an object with column-value pairs.
 * Returns the inserted row as an object.
 */
function sheetInsert(sheetName, data) {
  const sheet = getSheet_(sheetName);
  const headers = COLUMNS[sheetName];
  const row = headers.map(h => data[h] !== undefined ? data[h] : '');
  sheet.appendRow(row);
  // Return the inserted row (last row)
  const lastRow = sheet.getLastRow();
  return rowToObject_(sheetName, lastRow);
}

/**
 * Update a row identified by `columnName = value`.
 * `data` is an object with column-value pairs to update.
 * Returns the updated row as an object, or null if not found.
 */
function sheetUpdate(sheetName, columnName, value, data) {
  const rowNum = findRowByColumn_(sheetName, columnName, value);
  if (rowNum === -1) return null;
  
  const sheet = getSheet_(sheetName);
  const headers = COLUMNS[sheetName];
  
  // Build the row array: keep existing values, overwrite with data
  const existingRow = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  const newRow = [...existingRow];
  headers.forEach((h, i) => {
    if (data[h] !== undefined) {
      newRow[i] = data[h];
    }
  });
  
  sheet.getRange(rowNum, 1, 1, headers.length).setValues([newRow]);
  return rowToObject_(sheetName, rowNum);
}

/**
 * Upsert: update if exists, insert if not.
 * `keyColumn` is the column to check for existence.
 * Returns the upserted row.
 */
function sheetUpsert(sheetName, keyColumn, data) {
  const value = data[keyColumn];
  if (value === undefined || value === null) {
    return sheetInsert(sheetName, data);
  }
  const existing = sheetFindOne(sheetName, keyColumn, value);
  if (existing) {
    return sheetUpdate(sheetName, keyColumn, value, data);
  } else {
    return sheetInsert(sheetName, data);
  }
}

/**
 * Delete a row identified by `columnName = value`.
 * Returns true if deleted, false if not found.
 */
function sheetDelete(sheetName, columnName, value) {
  const rowNum = findRowByColumn_(sheetName, columnName, value);
  if (rowNum === -1) return false;
  const sheet = getSheet_(sheetName);
  sheet.deleteRow(rowNum);
  return true;
}

/**
 * Get rows where a column's value is greater than a given value.
 * Useful for "updated after timestamp" queries.
 */
function sheetGetWhere(sheetName, columnName, minValue) {
  const all = getAllData_(sheetName);
  return all.filter(row => {
    const val = row[columnName];
    if (val === undefined || val === '') return false;
    return Number(val) > Number(minValue);
  });
}

/**
 * Get rows where a column matches a specific value.
 */
function sheetGetWhereEqual(sheetName, columnName, value) {
  const all = getAllData_(sheetName);
  return all.filter(row => String(row[columnName]) === String(value));
}
