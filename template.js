const Firestore = require('Firestore');
const getAllEventData = require('getAllEventData');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');

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

Firestore.write(data.firebasePath, input, options).then((id) => {
  data.gtmOnSuccess();
}, data.gtmOnFailure);
