const JSON = require('JSON');
const Firestore = require('Firestore');
const getRequestHeader = require('getRequestHeader');
const getAllEventData = require('getAllEventData');
const getTimestampMillis = require('getTimestampMillis');
const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const getType = require('getType');
const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;
const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = getRequestHeader('trace-id');

let input = data.addEventData ? getAllEventData() : {};

let options = { merge: !!data.firebaseMerge };
if (data.firebaseProjectIdOverride) options.projectId = data.firebaseProjectId;

if (data.addTimestamp) input[data.timestampFieldName] = getTimestampMillis();
if (data.customDataList) {
  data.customDataList.forEach((d) => {
    if (data.skipNilValues) {
      const dType = getType(d.value);
      if (dType === 'undefined' || dType === 'null') return;
    }
    if (d.name.indexOf('.') != -1) {
      const nameParts = d.name.split('.');
      let obj = {};
      for (let i = 1; i < nameParts.length; i++) {
        let part_n = i + 1;
        if (part_n != nameParts.length) {
          obj[nameParts[i]] = {};
        } else {
          obj[nameParts[i]] = d.value;
        }
        obj = obj[nameParts[i]];
      }
      input[nameParts[0]] = obj;
    } else {
      input[d.name] = d.value;
    }
  });
}

Firestore.write(data.firebasePath, input, options).then((id) => {
  if (isLoggingEnabled) {
    logToConsole(
      JSON.stringify({
        Name: 'Firestore',
        Type: 'Message',
        TraceId: traceId,
        EventName: 'Write',
        DocumentId: id,
        DocumentInput: input,
      })
    );
  }

  data.gtmOnSuccess();
}, data.gtmOnFailure);

function determinateIsLoggingEnabled() {
  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}
