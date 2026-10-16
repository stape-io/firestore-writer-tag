const encodeUriComponent = require('encodeUriComponent');
const Firestore = require('Firestore');
const getAllEventData = require('getAllEventData');
const getGoogleAuth = require('getGoogleAuth');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeNumber = require('makeNumber');
const makeString = require('makeString');
const Math = require('Math');
const Object = require('Object');
const sendHttpRequest = require('sendHttpRequest');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (shouldExitEarly(data, eventData)) return;

const input = buildInput(data, eventData);

// Firestore.write() can't write Timestamp values (needed for TTL) and only supports the default database.
const shouldUseRestApi = data.useTtl || data.useCustomDatabase;
if (shouldUseRestApi) {
  const invalidReason = validateRestApiData(data);
  if (invalidReason) {
    log({
      Name: 'FirestoreWriter',
      Type: 'Message',
      EventName: 'Write',
      Message: '🛑 [ERROR] Document was not written.',
      Reason: invalidReason
    });

    return data.gtmOnFailure();
  }
}

// Both APIs send a merge with no fields as a PATCH without updateMask, which would replace the whole document.
const hasNoFieldsToMerge =
  data.firebaseMerge &&
  !data.useTtl &&
  isDocumentPath(data.firebasePath) &&
  Object.keys(input).length === 0;
if (hasNoFieldsToMerge) {
  log({
    Name: 'FirestoreWriter',
    Type: 'Message',
    EventName: 'Write',
    Message: '⚠️ [WARNING] Document was not written.',
    Reason: 'Merge is enabled and there are no fields to write.'
  });
  return data.gtmOnSuccess();
}

if (shouldUseRestApi) {
  writeWithRestApi(data, input);
} else {
  const options = { merge: !!data.firebaseMerge };
  if (data.firebaseProjectIdOverride) {
    options.projectId = data.firebaseProjectId;
  }

  Firestore.write(data.firebasePath, input, options).then(
    () => {
      if (!data.useOptimisticScenario) data.gtmOnSuccess();
    },
    () => {
      if (!data.useOptimisticScenario) data.gtmOnFailure();
    }
  );
}

if (data.useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function buildInput(data, eventData) {
  const input = data.addEventData ? eventData : {};

  if (data.addTimestamp) input[data.timestampFieldName] = getTimestampMillis();
  if (data.customDataList) {
    data.customDataList.forEach((d) => {
      if (data.skipNilValues) {
        const dType = getType(d.value);
        if (dType === 'undefined' || dType === 'null') return;
      }
      if (getType(d.name) === 'string' && d.name.indexOf('.') !== -1) {
        const nameParts = d.name.split('.');
        let obj = input;
        for (let i = 0; i < nameParts.length - 1; i++) {
          const part = nameParts[i];
          if (!obj[part]) {
            obj[part] = {};
          }
          obj = obj[part];
        }
        obj[nameParts[nameParts.length - 1]] = d.value;
      } else {
        input[d.name] = d.value;
      }
    });
  }

  return input;
}

function validateRestApiData(data) {
  if (!data.firebaseProjectId) {
    return 'GCP Project ID is required when TTL or a custom database is used.';
  }
  if (data.useCustomDatabase && !data.databaseId) {
    return 'Database ID is required when a custom database is used.';
  }
  if (data.useTtl && !(makeNumber(data.ttlValue) > 0)) {
    return 'TTL value must be a positive number. Value: ' + data.ttlValue;
  }
  // Firestore Timestamps can't be later than 9999-12-31T23:59:59.999999999Z.
  if (data.useTtl && getTimestampMillis() + makeNumber(data.ttlValue) * 1000 > 253402300799999) {
    return (
      'TTL value is too large. The expiration date must be before the year 10000. Value: ' +
      data.ttlValue
    );
  }
}

function writeWithRestApi(data, input) {
  const path = makeString(data.firebasePath);
  const fields = toFirestoreValue(input).mapValue.fields;

  if (data.useTtl) {
    const expiresAtMs = getTimestampMillis() + Math.round(makeNumber(data.ttlValue) * 1000);
    fields[data.ttlFieldName || 'expiresAt'] = {
      timestampValue: convertTimestampToISO(expiresAtMs)
    };
  }

  let url =
    'https://firestore.googleapis.com/v1/projects/' +
    enc(data.firebaseProjectId) +
    '/databases/' +
    enc(data.useCustomDatabase ? data.databaseId : '(default)') +
    '/documents/' +
    path
      .split('/')
      .map((segment) => enc(segment))
      .join('/');

  // Collection paths create a document with an auto-generated ID.
  const isCollectionPath = !isDocumentPath(path);
  if (!isCollectionPath && data.firebaseMerge) {
    url =
      url +
      '?' +
      Object.keys(fields)
        .map((key) => 'updateMask.fieldPaths=' + enc(quoteFieldPath(key)))
        .join('&');
  }

  sendHttpRequest(
    url,
    {
      method: isCollectionPath ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      authorization: getGoogleAuth({
        scopes: ['https://www.googleapis.com/auth/datastore']
      })
    },
    JSON.stringify({ fields: fields })
  )
    .then((result) => {
      if (data.useOptimisticScenario) return;
      if (result.statusCode >= 200 && result.statusCode < 300) data.gtmOnSuccess();
      else data.gtmOnFailure();
    })
    .catch(() => {
      if (!data.useOptimisticScenario) data.gtmOnFailure();
    });
}

// Same type mapping as Firestore.write(), so data is stored identically in both modes.
function toFirestoreValue(value) {
  const type = getType(value);
  if (type === 'boolean') return { booleanValue: value };
  if (type === 'number') return { doubleValue: value };
  if (type === 'string') return { stringValue: value };
  if (type === 'array') return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (type === 'object') {
    const fields = {};
    Object.keys(value).forEach((key) => {
      fields[key] = toFirestoreValue(value[key]);
    });
    return { mapValue: { fields: fields } };
  }
  return { nullValue: null };
}

// Field names that aren't "simple" (letters, digits and underscores, not starting with a digit) must be backtick-quoted,
// with backslashes and backticks escaped.
function quoteFieldPath(fieldName) {
  const isSimpleName = fieldName.match('^[A-Za-z_][A-Za-z0-9_]*$');
  if (isSimpleName) return fieldName;
  return '`' + fieldName.split('\\').join('\\\\').split('`').join('\\`') + '`';
}

/*==============================================================================
  Helpers
==============================================================================*/

function convertTimestampToISO(timestamp) {
  const msPerDay = 86400000;
  const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const pad = (value, length) => {
    let result = makeString(value);
    while (result.length < length) result = '0' + result;
    return result;
  };

  let days = Math.floor(timestamp / msPerDay);
  let msOfDay = timestamp - days * msPerDay;

  let year = 1970;
  while (days >= (isLeapYear(year) ? 366 : 365)) {
    days = days - (isLeapYear(year) ? 366 : 365);
    year++;
  }

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let month = 0;
  while (days >= daysInMonth[month]) {
    days = days - daysInMonth[month];
    month++;
  }

  const hours = Math.floor(msOfDay / 3600000);
  msOfDay = msOfDay - hours * 3600000;
  const minutes = Math.floor(msOfDay / 60000);
  msOfDay = msOfDay - minutes * 60000;
  const seconds = Math.floor(msOfDay / 1000);
  const milliseconds = msOfDay - seconds * 1000;

  return (
    year +
    '-' +
    pad(month + 1, 2) +
    '-' +
    pad(days + 1, 2) +
    'T' +
    pad(hours, 2) +
    ':' +
    pad(minutes, 2) +
    ':' +
    pad(seconds, 2) +
    '.' +
    pad(milliseconds, 3) +
    'Z'
  );
}

// Document paths have an even number of segments (collection/document), collection paths an odd one.
function isDocumentPath(path) {
  return makeString(path).split('/').length % 2 === 0;
}

function shouldExitEarly(data, eventData) {
  const url = getUrl(eventData);
  if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
    data.gtmOnSuccess();
    return true;
  }

  return false;
}

function getUrl(eventData) {
  return eventData.page_location || getRequestHeader('referer') || eventData.page_referrer;
}

function enc(value) {
  if (['null', 'undefined'].indexOf(getType(value)) !== -1) value = '';
  return encodeUriComponent(makeString(value));
}

function log(rawDataToLog) {
  rawDataToLog.TraceId = getRequestHeader('trace-id');
  logToConsole(JSON.stringify(rawDataToLog));
}
