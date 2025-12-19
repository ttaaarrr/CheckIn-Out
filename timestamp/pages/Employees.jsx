import { useEffect, useState } from 'react';
import { useUser } from '../components/UserContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import api from '../src/api';

// Fix default icon
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
const MarkerSetter = ({ lat, lng, setLat, setLng }) => {
  const numLat = Number(lat);
  const numLng = Number(lng);

  const valid = !isNaN(numLat) && !isNaN(numLng);

  const [position, setPosition] = useState(
    valid ? { lat: numLat, lng: numLng } : null
  );

  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
    }
  });

  useEffect(() => {
    const newLat = Number(lat);
    const newLng = Number(lng);

    if (!isNaN(newLat) && !isNaN(newLng)) {
      setPosition({ lat: newLat, lng: newLng });
    }
  }, [lat, lng]);

  if (!position) return null;

  const customIcon = new L.Icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return <Marker position={[position.lat, position.lng]} icon={customIcon} />;
};
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center]);

  return null;
}
export default function Employees() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [employees, setEmployees] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [newEmp, setNewEmp] = useState({ em_code: '', name: '', position: '', department: '' });
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyLat, setNewCompanyLat] = useState(13.7563);
  const [newCompanyLng, setNewCompanyLng] = useState(100.5018);
  const [companyFormVisible, setCompanyFormVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null); 
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [newCompanyRadius, setNewCompanyRadius] = useState(30);
  const { user } = useUser();
  const navigate = useNavigate();

  // Check Login

  useEffect(() => {
   const storedUser = localStorage.getItem('user');

  if (!user && storedUser) {
    setUser(JSON.parse(storedUser));
  }

  if (!user && !storedUser) {
    navigate('/login');
  }
  }, [user, navigate]);

  //ข้อมูลบริษัท
  const fetchCompanies = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const token = user?.token;
      console.log(token);
      if (!token) {
      console.error("ไม่พบ token");
      return;
    }
      const res = await api.get('https://api-checkin-out.bpit-staff.com/api/company',{
  headers: {
    Authorization: `Bearer ${token}`
  }
});
      if (res.data.success) {
        setCompanies(res.data.companies.map(c => ({  id: c.name,
        name: c.name,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
        radius_km: c.radius_km,
       })));
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
      const res = await api.get(`https://api-checkin-out.bpit-staff.com/api/employees?company_name=${companyName}`);
      if (res.data.success) setEmployees(res.data.employees);
    } catch (err) {
      console.error(err);
    }
  };

  //เพิ่มบริษัท
  const addCompany = async () => {
     if (!newCompanyRadius || newCompanyRadius <= 0) {
    alert('กรุณากรอกระยะห่าง (เมตร)');
    return;
  }
  const radiusKm = Number(newCompanyRadius) / 1000;
    if (!newCompanyName) return alert("กรอกชื่อบริษัท");
    try {   
       let res;
if (editingCompany) {
  res = await api.put(
    `https://api-checkin-out.bpit-staff.com/api/company/${editingCompany.name}`,
    {
      name: newCompanyName,
      address: newCompanyAddress,
      latitude: newCompanyLat || null,
      longitude: newCompanyLng || null,
      radius_km: radiusKm,
    }
  );
  alert(`แก้ไขบริษัท ${newCompanyName} สำเร็จ`);
  setEditingCompany(null);
} else {
  res = await api.post('https://api-checkin-out.bpit-staff.com/api/company', {
    name: newCompanyName,
    address: newCompanyAddress,
    latitude: newCompanyLat || null,
    longitude: newCompanyLng || null,
    radius_km: radiusKm,
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
 // auto search
 const searchAddress = async (query) => {
  if (!query.trim()) return [];

  try {
    const res = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        q: query,
        format: "json",
        limit: 5,
        countrycodes: "th",
        addressdetails: 1,
      },
    });

    return res.data;
  } catch (err) {
    console.error("Geocode error:", err);
    return [];
  }
};

const handleAddressChange = async (e) => {
  const value = e.target.value;
  setNewCompanyAddress(value);

  if (value.length < 3) {
    setAddressSuggestions([]);
    return;
  }

  setIsFetchingAddress(true);
  const results = await searchAddress(value);
  setAddressSuggestions(results);
  setIsFetchingAddress(false);
};

// ENTER = auto choose suggestion[0] หรือ set default lat/lng
const handleAddressEnter = async (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();

  const results = await searchAddress(newCompanyAddress);

  if (results.length > 0) {
    const { lat, lon } = results[0];
    setNewCompanyLat(parseFloat(lat));
    setNewCompanyLng(parseFloat(lon));
  } else {
    // ถ้าไม่พบที่อยู่ → ใช้ default พิกัดกรุงเทพ
    setNewCompanyLat(13.7563);
    setNewCompanyLng(100.5018);
  }
  setAddressSuggestions([]);
};

const selectSuggestion = (item) => {
  setNewCompanyAddress(item.display_name);
  setAddressSuggestions([]);
  setNewCompanyLat(parseFloat(item.lat));
  setNewCompanyLng(parseFloat(item.lon));
};
  //ลบบริษัท
  const deleteCompany = async (companyName) => {
    try {
      const res = await api.delete(`https://api-checkin-out.bpit-staff.com/api/company/${companyName}`);
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
      const res = await api.post('https://api-checkin-out.bpit-staff.com/api/employees', { ...newEmp, company_name: selectedCompany });
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
      const res = await api.delete(`https://api-checkin-out.bpit-staff.com/api/employees/${em_code}?company_name=${selectedCompany}`);
      if (res.data.success) fetchEmployees(selectedCompany);
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  if (!user) return null;

  // Render JSX

  return (
<div className="bg-white rounded-2xl shadow-xl p-4 md:p-8 space-y-6">

  {/* เลือกบริษัท + ปุ่มเพิ่ม/ลบ */}
  <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">

    <select
      value={selectedCompany}
      onChange={e => {
        const companyId = e.target.value;
        setSelectedCompany(companyId);
        fetchEmployees(companyId);
      }}
      className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 w-full md:w-auto"
    >
      <option value="">เลือกบริษัท</option>
      {companies.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>

    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
      <button
        onClick={() => setCompanyFormVisible(true)}
        className="flex items-center justify-center gap-2 bg-green-500 text-white px-5 py-2 rounded-lg hover:bg-green-600 shadow-md transition w-full sm:w-auto"
      >
        เพิ่มบริษัท
      </button>

      <button
        onClick={() => {
          if (!selectedCompany) return alert("กรุณาเลือกบริษัทก่อนแก้ไข");
          const company = companies.find(c => c.id == selectedCompany);
          if (!company) return;
          setEditingCompany(company);
          setNewCompanyName(company.name);
          setNewCompanyAddress(company.address || '');
          setNewCompanyLat(company.latitude || '');
          setNewCompanyLng(company.longitude || '');
          setNewCompanyRadius(company.radius_km ? company.radius_km * 1000 :'');
          setCompanyFormVisible(true);
        }}
        className="bg-yellow-400 text-white px-5 py-2 rounded-lg hover:bg-yellow-500 w-full sm:w-auto"
      >
        แก้ไขบริษัท
      </button>

      <button
        onClick={() => {
          if (!selectedCompany) return alert("กรุณาเลือกบริษัทก่อนลบ");
          if (confirm(`ลบบริษัทนี้?`)) deleteCompany(selectedCompany);
        }}
        className="bg-red-500 text-white px-5 py-2 rounded-lg hover:bg-red-600 shadow-md transition w-full sm:w-auto"
      >
        ลบบริษัท
      </button>
    </div>

  </div>

  {/* ฟอร์มเพิ่มบริษัท */}
  {companyFormVisible && (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-3">

      {/* ชื่อบริษัท */}
      <input
        type="text"
        placeholder="ชื่อบริษัท"
        value={newCompanyName}
        onChange={e => setNewCompanyName(e.target.value)}
        className="px-4 py-2 border rounded-lg w-full"
      />

      {/* ที่อยู่ + Suggestion */}
      <div className="relative">
        <input
          type="text"
          placeholder="กรอกข้อมูลที่อยู่บริษัทเพื่อปักหมุดบนแผนที่"
          value={newCompanyAddress}
          onChange={handleAddressChange}
          onKeyDown={handleAddressEnter}
          className="px-4 py-2 border rounded-lg w-full"
        />

        {isFetchingAddress && (
          <div className="absolute bg-white border rounded-lg mt-1 w-full p-2 text-gray-500 z-9999">
            กำลังค้นหา...
          </div>
        )}

        {addressSuggestions.length > 0 && (
          <ul className="absolute bg-white border rounded-lg mt-1 w-full max-h-48 overflow-auto shadow-lg z-9999">
            {addressSuggestions.map((item, idx) => (
              <li
                key={idx}
                className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                onClick={() => selectSuggestion(item)}
              >
                {item.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>
<div>
  <label className="block text-sm text-gray-700 mb-1">
    ระยะห่างที่อนุญาตในการลงเวลา (เมตร)
  </label>
  <input
    type="number"
    min={10}
    step={10}
    value={newCompanyRadius}
    onChange={e => setNewCompanyRadius(Number(e.target.value))}
    className="px-4 py-2 border rounded-lg w-full"
    placeholder="เช่น 300"
  />
  <p className="text-xs text-gray-500 mt-1">
    พนักงานต้องอยู่ในระยะนี้จากบริษัทจึงจะลงเวลาได้
  </p>
</div>
      {/* แผนที่ – ปรับให้ฟิตจอมือถือ */}
      <div className="w-full" style={{ height: 360 }}>
        <MapContainer
          center={[
            newCompanyLat || 13.7367,
            newCompanyLng || 100.5231
          ]}
          zoom={16}
          maxZoom={18}
          style={{ height: "100%", width: "100%" }}
        >
   <TileLayer
  url={`https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}`}
  attribution="&copy; Google Maps"
/>

          {newCompanyLat && newCompanyLng && (
            <ChangeView center={[newCompanyLat, newCompanyLng]} />
          )}

          {newCompanyLat !== null && newCompanyLng !== null && (
            <MarkerSetter
              lat={parseFloat(newCompanyLat)}
              lng={parseFloat(newCompanyLng)}
              setLat={setNewCompanyLat}
              setLng={setNewCompanyLng}
            />
          )}
        {newCompanyLat && newCompanyLng && newCompanyRadius > 0 && (
  <Circle
    center={[newCompanyLat, newCompanyLng]}
    radius={newCompanyRadius} // เมตร
    pathOptions={{
      color: 'blue',
      fillColor: 'blue',
      fillOpacity: 0.15,
    }}
  />
)}
        </MapContainer>
      </div>

      <p className="text-sm text-gray-500 mt-1">
        คลิกบนแผนที่เพื่อปักหมุดตำแหน่งบริษัทได้
      </p>

      <div className="flex gap-2 justify-end">
        <button onClick={addCompany} className="bg-green-500 text-white px-4 py-2 rounded">บันทึก</button>
        <button onClick={() => { setCompanyFormVisible(false); setEditingCompany(null); }}
          className="bg-red-500 text-white px-4 py-2 rounded">ยกเลิก</button>
      </div>
    </div>
  )}

  {/* ปุ่มเพิ่มพนักงาน */}
  {selectedCompany && (
    <div className="space-y-4">

      <button
        onClick={() => setFormVisible(true)}
        className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 shadow-md transition w-full md:w-auto"
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
              className="w-full px-4 py-2 border rounded-lg"
              value={newEmp.em_code}
              onChange={e => setNewEmp({ ...newEmp, em_code: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">ชื่อพนักงาน</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-lg"
              value={newEmp.name}
              onChange={e => setNewEmp({ ...newEmp, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">แผนก</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-lg"
              value={newEmp.department}
              onChange={e => setNewEmp({ ...newEmp, department: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">ตำแหน่ง</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-lg"
              value={newEmp.position}
              onChange={e => setNewEmp({ ...newEmp, position: e.target.value })}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={addEmployee} className="bg-green-500 text-white px-4 py-2 rounded">บันทึก</button>
            <button onClick={() => setFormVisible(false)} className="bg-gray-500 text-white px-4 py-2 rounded">ยกเลิก</button>
          </div>
        </div>
      )}

      {/* ตารางพนักงาน */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left">รหัส</th>
              <th className="px-6 py-3 text-left">ชื่อ</th>
              <th className="px-6 py-3 text-left">แผนก</th>
              <th className="px-6 py-3 text-left">ตำแหน่ง</th>
              <th className="px-6 py-3 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b">
                <td className="px-6 py-3">{emp.em_code}</td>
                <td className="px-6 py-3">{emp.name}</td>
                <td className="px-6 py-3">{emp.department}</td>
                <td className="px-6 py-3">{emp.position}</td>
                <td className="px-6 py-3 text-center">
                  <button
                    onClick={() => deleteEmployee(emp.em_code)}
                    className="bg-red-500 text-white px-3 py-1 rounded"
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
