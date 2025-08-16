// src/components/NotFound.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold mb-4">404: الصفحة غير موجودة</h1>
      <button
        onClick={() => navigate("/login")}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        العودة لتسجيل الدخول
      </button>
    </div>
  );
}
