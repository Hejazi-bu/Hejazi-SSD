// 📁 src/components/LogIn/ResetPassword.tsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { toast } from "sonner";

export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error("فشل في تغيير كلمة المرور");
    } else {
      toast.success("تم تغيير كلمة المرور بنجاح");
      window.location.href = "/"; // يرجع المستخدم للواجهة الرئيسية
    }

    setLoading(false);
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      toast.info("يرجى إدخال كلمة مرور جديدة");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded-lg shadow w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-center">كلمة مرور جديدة</h2>
        <input
          type="password"
          placeholder="كلمة المرور الجديدة"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded px-4 py-2 mb-4"
        />
        <button
          onClick={handleReset}
          disabled={loading}
          className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
        >
          {loading ? "..." : "تحديث كلمة المرور"}
        </button>
      </div>
    </div>
  );
}
