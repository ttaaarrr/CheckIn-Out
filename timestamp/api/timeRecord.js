import axios from 'axios';

export async function logTime({ empId, type }) {
  const res = await axios.post('/api/time-record', { empId, type });
  return res.data;
}

export async function getTimeRecords(empId) {
  const res = await axios.get(`/api/time-record/${empId}`);
  return res.data;
}
