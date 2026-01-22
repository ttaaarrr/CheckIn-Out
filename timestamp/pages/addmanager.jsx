import { useState } from 'react';
import axios from 'axios';
import { useUser } from '../components/UserContext';

export default function AddManager() {
  const { user } = useUser();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }

  const handleSubmit = async () => {
    if (!username || !password) {
      setMessage({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบ' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await axios.post(
        'https://api-checkin-out.bpit-staff.com/api/user/manager',
        { username, password },
        {
          headers: {
            Authorization: `Bearer ${user.token}`
          }
        }
      );

      setMessage({ type: 'success', text: 'เพิ่มผู้จัดการเรียบร้อยแล้ว' });
      setUsername('');
      setPassword('');
    } catch (err) {
      setMessage({ type: 'error', text: 'เพิ่มผู้จัดการไม่สำเร็จ' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-start mt-10 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
          เพิ่มผู้จัดการ
        </h2>

        {/* MESSAGE */}
        {message && (
          <div
            className={`mb-4 rounded-lg px-4 py-2 text-sm ${
              message.type === 'success'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* USERNAME */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="กรอกชื่อผู้ใช้"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>

        {/* PASSWORD */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="กรอกรหัสผ่าน"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {/* BUTTON */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-2 rounded-lg font-medium text-white transition ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'กำลังบันทึก...' : 'ยืนยันรายการ'}
        </button>
      </div>
    </div>
  );
}
