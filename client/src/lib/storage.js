import { get, set } from 'idb-keyval';

// Small local settings (role, deviceId). Secrets go through secretStore.js, never here.
const KEY = 'iiry';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function getSetting(name) {
  return load()[name];
}

export function setSetting(name, value) {
  const all = load();
  if (value === undefined) delete all[name]; else all[name] = value;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getDeviceId() {
  let id = getSetting('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    setSetting('deviceId', id);
  }
  return id;
}

// Parent's paired family members: { deviceId, name, relation, X }. X came from the in-person QR scan (rule 4).

export async function getFamilyMembers() {
  return (await get('familyMembers')) || [];
}

export async function addFamilyMember(member) {
  const list = (await getFamilyMembers()).filter((m) => m.deviceId !== member.deviceId);
  list.push(member);
  await set('familyMembers', list);
  return list;
}
