import React from 'react';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const rawUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  // Ensure the URL always has a protocol (guards against env var missing https://)
  const backendUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  return (
    <div className="h-screen w-screen overflow-auto bg-[#1c1e22]">
      <AdminPanel backendUrl={backendUrl} />
    </div>
  );
}
