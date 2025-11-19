import { useEffect, useState } from 'react';
import { useUser } from '../components/UserContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default icon
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
const MarkerSetter = ({ lat, lng, setLat, setLng }) => {
  const map = useMap();

  // อัพเดท center ของ map เมื่อ lat/lng เปลี่ยน
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);

  const [position, setPosition] = useState(lat && lng ? { lat, lng } : null);

  useEffect(() => {
    if (lat && lng) setPosition({ lat, lng });
  }, [lat, lng]);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
    },
  });

 const customIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

return position ? <Marker position={[position.lat, position.lng]} icon={customIcon} /> : null;

};
export default function Employees() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [employees, setEmployees] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [newEmp, setNewEmp] = useState({ em_code: '', name: '', position: '', department: '' });
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyLat, setNewCompanyLat] = useState('');
  const [newCompanyLng, setNewCompanyLng] = useState('');
  const [companyFormVisible, setCompanyFormVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null); 
  const { user } = useUser();
  const navigate = useNavigate();

  // Check Login

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  //ข้อมูลบริษัท
  const fetchCompanies = async () => {
    try {
      const res = await axios.get('https://api-checkin-out.bpit-staff.com/api/company');
      if (res.data.success) {
        setCompanies(res.data.companies);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // ข้อมูลพนักงาน
  const fetchEmployees = async (companyName) => {
    if (!companyName) return;
    try {
      const res = await axios.get(`https://api-checkin-out.bpit-staff.com/api/employees?company_name=${companyName}`);
      if (res.data.success) setEmployees(res.data.employees);
    } catch (err) {
      console.error(err);
    }
  };

  //เพิ่มบริษัท
  const addCompany = async () => {
    if (!newCompanyName) return alert("กรอกชื่อบริษัท");
    try {   
       let res;
if (editingCompany) {
  res = await axios.put(
    `https://api-checkin-out.bpit-staff.com/api/company/${editingCompany.id}`,
    {
      name: newCompanyName,
      address: newCompanyAddress,
      latitude: newCompanyLat || null,
      longitude: newCompanyLng || null,
    }
  );
  alert(`แก้ไขบริษัท ${newCompanyName} สำเร็จ`);
  setEditingCompany(null);
} else {
  res = await axios.post('https://api-checkin-out.bpit-staff.com/api/company', {
    name: newCompanyName,
    address: newCompanyAddress,
    latitude: newCompanyLat || null,
    longitude: newCompanyLng || null,
  });
}
if (res.data.success) {
  fetchCompanies();
  setNewCompanyName('');
  setNewCompanyAddress('');
  setNewCompanyLat('');
  setNewCompanyLng('');
  setCompanyFormVisible(false);
} else alert(res.data.message);

    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาด');
    }
  };

  //ลบบริษัท
  const deleteCompany = async (companyName) => {
    try {
      const res = await axios.delete(`https://api-checkin-out.bpit-staff.com/api/company/${companyName}`);
      if (res.data.success) {
        alert(`ลบบริษัท ${companyName} เรียบร้อยแล้ว`);
        if (selectedCompany === companyName) setSelectedCompany('');
        fetchCompanies();
      } else alert(res.data.message || 'เกิดข้อผิดพลาด');
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  //เพิ่มพนักงาน
  const addEmployee = async () => {
    if (!newEmp.em_code || !newEmp.name || !newEmp.position || !newEmp.department)
      return alert("กรอกไม่ครบ");
    if (!selectedCompany) return alert("กรุณาเลือกบริษัทก่อน");

    try {
      const res = await axios.post('https://api-checkin-out.bpit-staff.com/api/employees', { ...newEmp, company_name: selectedCompany });
      if (res.data.success) {
        fetchEmployees(selectedCompany);
        setFormVisible(false);
        setNewEmp({ em_code: '', name: '', position: '', department: '' });
      } else {
        alert(res.data.message || 'เกิดข้อผิดพลาด');
      }
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  // ลบพนักงาน

  const deleteEmployee = async (em_code) => {
    if (!selectedCompany) return alert("Missing company");
    if (!confirm("ลบพนักงาน?")) return;

    try {
      const res = await axios.delete(`https://api-checkin-out.bpit-staff.com/api/employees/${em_code}?company_name=${selectedCompany}`);
      if (res.data.success) fetchEmployees(selectedCompany);
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  if (!user) return null;

  // Render JSX

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">

      {/* เลือกบริษัท + ปุ่มเพิ่ม/ลบบริษัท  */}
      <div className="mb-6 flex justify-between items-center">
        <select
          value={selectedCompany}
          onChange={e => {
            const companyId = e.target.value;
            setSelectedCompany(companyId);
            fetchEmployees(companyId);
          }}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">เลือกบริษัท</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            onClick={() => setCompanyFormVisible(true)}
            className="flex items-center gap-2 bg-green-500 text-white px-5 py-2 rounded-lg hover:bg-green-600 shadow-md transition"
          >
            เพิ่มบริษัท
          </button>
          {/*แก้ไข*/}
          <button
          onClick={() => {
            if (!selectedCompany) return alert("กรุณาเลือกบริษัทก่อนแก้ไข");
            const company = companies.find(c => c.id === selectedCompany);
            if (!company) return;
            setEditingCompany(company);             // กำหนดบริษัทที่จะแก้ไข
            setNewCompanyName(company.name);        // เติมชื่อบริษัทใน form
            setNewCompanyAddress(company.address || '');
            setNewCompanyLat(company.latitude || '');
            setNewCompanyLng(company.longitude || '');
            setCompanyFormVisible(true);            // เปิด form
          }}
          className="bg-yellow-400 text-white px-5 py-2 rounded-lg hover:bg-yellow-500"
          >
            แก้ไขบริษัท
          </button>
          {/*ลบ*/ }
          <button
            onClick={() => {
              if (!selectedCompany) return alert("กรุณาเลือกบริษัทก่อนลบ");
              if (confirm(`ลบบริษัท ${selectedCompany}?`)) deleteCompany(selectedCompany);
            }}
            className="flex items-center gap-2 bg-red-500 text-white px-5 py-2 rounded-lg hover:bg-red-600 shadow-md transition"
          >
            ลบบริษัท
          </button>
        </div>
      </div>

      {/* --- ฟอร์มเพิ่มบริษัท --- */}
     {companyFormVisible && (
  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-2">
    {/* ชื่อบริษัท */}
    <input
      type="text"
      placeholder="ชื่อบริษัท"
      value={newCompanyName}
      onChange={e => setNewCompanyName(e.target.value)}
      className="px-4 py-2 border rounded-lg"
    />

    {/* ที่อยู่บริษัท */}
    <input
      type="text"
      placeholder="ที่อยู่บริษัท"
      value={newCompanyAddress}
      onChange={async e => {
        const addr = e.target.value;
        setNewCompanyAddress(addr);

        if (!addr) return;

        // เรียก Geocoding API ของ OpenStreetMap
        try {
          const res = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: addr, format: 'json', limit: 1 },
          });
          if (res.data.length > 0) {
            const { lat, lon } = res.data[0];
            setNewCompanyLat(parseFloat(lat));
            setNewCompanyLng(parseFloat(lon));
          }
        } catch (err) {
          console.error('Geocoding error:', err);
        }
      }}
      className="px-4 py-2 border rounded-lg"
    />

    {/* แผนที่ */}
    <div style={{ height: 300 }}>
     <MapContainer
  center={[newCompanyLat || 13.7367, newCompanyLng || 100.5231]}
  zoom={13}
  style={{ height: '300px', width: '100%' }}
>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  <MarkerSetter
    lat={newCompanyLat}
    lng={newCompanyLng}
    setLat={setNewCompanyLat}
    setLng={setNewCompanyLng}
  />
</MapContainer>

    </div>

    <p className="text-sm text-gray-500 mt-1">
      คลิกบนแผนที่เพื่อปรับตำแหน่งบริษัทได้
    </p>

    <div className="flex gap-2 justify-end">
      <button onClick={addCompany} className="bg-green-500 text-white px-4 py-2 rounded">บันทึก</button>
      <button onClick={() => {setCompanyFormVisible(false); setEditingCompany(null);}}
       className="bg-red-500 text-white px-4 py-2 rounded">ยกเลิก</button>
    </div>
  </div>
)}


      {/* ปุ่มเพิ่มพนักงานและตาราง  */}
      {selectedCompany && (
        <div className="space-y-4">
          <button
            onClick={() => setFormVisible(true)}
            className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 shadow-md transition"
          >
            + เพิ่มพนักงาน
          </button>

          {/* ฟอร์มเพิ่มพนักงาน */}
          {formVisible && (
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div>
                <label className="block text-gray-700 mb-1">รหัสพนักงาน</label>
                <input
                  type="text"
                  placeholder="รหัสพนักงาน"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={newEmp.em_code}
                  onChange={e => setNewEmp({ ...newEmp, em_code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">ชื่อพนักงาน</label>
                <input
                  type="text"
                  placeholder="ชื่อ-สกุล"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={newEmp.name}
                  onChange={e => setNewEmp({ ...newEmp, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">แผนก</label>
                <input
                  type="text"
                  placeholder="แผนก"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={newEmp.department}
                  onChange={e => setNewEmp({ ...newEmp, department: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">ตำแหน่ง</label>
                <input
                  type="text"
                  placeholder="ตำแหน่งงาน"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={newEmp.position}
                  onChange={e => setNewEmp({ ...newEmp, position: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={addEmployee} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">บันทึก</button>
                <button onClick={() => setFormVisible(false)} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">ยกเลิก</button>
              </div>
            </div>
          )}

          {/* ตารางแสดงพนักงาน */}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-700 font-medium">รหัส</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-medium">ชื่อ</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-medium">แผนก</th>
                  <th className="px-6 py-3 text-left text-gray-700 font-medium">ตำแหน่ง</th>
                  <th className="px-6 py-3 text-center text-gray-700 font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className="border-b hover:bg-gray-50 transition">
                    <td className="px-6 py-3">{emp.em_code}</td>
                    <td className="px-6 py-3">{emp.name}</td>
                    <td className="px-6 py-3">{emp.department}</td>
                    <td className="px-6 py-3">{emp.position}</td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => deleteEmployee(emp.em_code)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">ยังไม่มีพนักงาน</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
