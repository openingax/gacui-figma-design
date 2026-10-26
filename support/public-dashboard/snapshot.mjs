import fs from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

export function validateReport(value, now=Date.now()) {
 if (!value || !Number.isFinite(Date.parse(value.generatedAt)) || Date.parse(value.generatedAt)>now+60000) throw Error('invalid generatedAt');
 for (const key of ['people','tasks','daily','recentErrors','sources']) if (!Array.isArray(value[key])) throw Error('invalid '+key);
 for (const key of ['people','devices','events','tasks','commands','errors','feedback','profileOnly']) if (!Number.isSafeInteger(value.totals?.[key]) || value.totals[key]<0) throw Error('invalid totals');
 if (value.totals.people!==value.people.length || value.totals.tasks!==value.tasks.length) throw Error('inconsistent totals');
 return value;
}
export function loadSnapshot(file) {
 if (!fs.existsSync(file)) return null;
 return validateReport(JSON.parse(fs.readFileSync(file,'utf8')));
}
export function saveSnapshot(file, value) {
 validateReport(value);
 const previous=loadSnapshot(file);
 if (previous && Date.parse(value.generatedAt)<Date.parse(previous.generatedAt)) throw Object.assign(Error('older snapshot'),{status:409});
 fs.mkdirSync(dirname(file),{recursive:true});
 const temp=file+'.'+randomUUID()+'.tmp';
 try { fs.writeFileSync(temp,JSON.stringify(value),{mode:0o600});fs.renameSync(temp,file); }
 finally { if(fs.existsSync(temp))fs.unlinkSync(temp); }
 return value;
}
