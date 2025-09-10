import axios from 'axios';

export async function logTime({ empId, type }) {
  const res = await axios.post('https://api-checkin-out.bpit-staff.com/api/time-record', { empId, type });
  return res.data;
}

export async function getTimeRecords(empId) {
  const res = await axios.get(`https://api-checkin-out.bpit-staff.com/api/time-record/${empId}`);
  return res.data;
}
