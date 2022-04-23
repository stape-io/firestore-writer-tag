const JSON = require('JSON');
const Firestore = require('Firestore');
const getRequestHeader = require('getRequestHeader');
const getAllEventData = require('getAllEventData');
const getTimestampMillis = require('getTimestampMillis');
const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;
const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = getRequestHeader('trace-id');

let input = data.addEventData ? getAllEventData() : {};

let options = {merge: data.firebaseMerge ? true : false};
if (data.firebaseProjectIdOverride) options.projectId = data.firebaseProjectId;

if (data.addTimestamp) input[data.timestampFieldName] = getTimestampMillis();
if (data.customDataList) data.customDataList.forEach(d => {input[d.name] = d.value;});

Firestore.write(data.firebasePath, input, options).then((id) => {
    if (isLoggingEnabled) {
        logToConsole(JSON.stringify({
            'Name': 'Firestore',
            'Type': 'Message',
            'TraceId': traceId,
            'EventName': 'Write',
            'DocumentId': id,
            'DocumentInput': input,
        }));
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
