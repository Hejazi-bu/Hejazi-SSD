
import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold mb-4">404</h1>
      <p className="mb-4">الصفحة غير موجودة</p>
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded"
        onClick={() => navigate("/dashboard")}
      >
        العودة للداشبورد
      </button>
    </div>
  );
}
