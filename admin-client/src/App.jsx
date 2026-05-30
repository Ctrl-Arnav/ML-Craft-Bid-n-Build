import React from 'react';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  return (
    <div className="h-screen w-screen overflow-auto bg-[#1c1e22]">
      <AdminPanel backendUrl={backendUrl} />
    </div>
  );
}
