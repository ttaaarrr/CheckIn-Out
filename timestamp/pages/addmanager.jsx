import { useState } from 'react';
import axios from 'axios';
import { useUser } from '../components/UserContext';

export default function AddManager() {
  const { user } = useUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
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
      alert('เพิ่มสำเร็จ');
      setUsername('');
      setPassword('');
    } catch (err) {
      alert('เพิ่มไม่สำเร็จ');
      console.error(err);
    }
  };

  return (
    <div className="max-w-md bg-white p-6 rounded-xl shadow">
      <h2 className="text-xl font-bold mb-4">เพิ่มชื่อผู้จัดการ</h2>

      <input
        className="w-full border p-2 mb-3"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />

      <input
        className="w-full border p-2 mb-3"
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white w-full py-2 rounded"
      >
       ยืนยันรายการ
      </button>
    </div>
  );
}
