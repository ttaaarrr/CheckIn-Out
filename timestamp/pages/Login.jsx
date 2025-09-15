import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../components/UserContext";
import axios from "axios";

export default function Login() {
  const { setUser } = useUser();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await axios.post(
        "https://api-checkin-out.bpit-staff.com/api/login",
        { username, password }
      );

      setUser(res.data.user);
      navigate("/employees");
    } catch (err) {
      alert("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center ">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 border border-gray-200">
        {/* Logo / Title */}
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14  flex items-center justify-center text-white text-2xl font-bold ">
            {/* <img 
    src="/src/assets/logo.png" 
    alt="BPIT Logo" 
    className="w-32 h-16" 
  /> */}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mt-4">เข้าสู่ระบบ</h2>
          </div>

        {/* Username */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            type="text"
            placeholder="กรอกชื่อผู้ใช้"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            placeholder="กรอกรหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Button */}
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md transition"
        >
          Login
        </button>

     </div>
    </div>
  );
}
