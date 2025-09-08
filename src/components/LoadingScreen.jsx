import React from 'react';

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white bg-gray-900">
      <div className="relative flex flex-col items-center justify-center">
        <div className="w-16 h-16 mb-4 border-t-4 border-b-4 border-gray-400 rounded-full animate-spin"></div>
        <h1 className="text-4xl font-bold text-gray-200">Hejazi SSD</h1>
        <p className="mt-2 text-xl text-gray-400">الرجاء الإنتظار...</p>
      </div>
    </div>
  );
}

export default LoadingScreen;