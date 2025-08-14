import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Language = "ar" | "en";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Company {
  id: string;
  name_ar: string | null;
  name_en: string | null;
}

const translations = {
  ar: {
    title: "إدخال مخالفة جديدة",
    companyLabel: "الشركة",
    selectCompanyPlaceholder: "اختر الشركة",
    violationTitle: "العنوان",
    violationDescription: "الوصف",
    violationDate: "تاريخ المخالفة",
    violationTime: "وقت المخالفة",
    location: "الموقع",
    severity: "درجة الخطورة",
    severityOptions: ["منخفضة", "متوسطة", "عالية"],
    saveButton: "حفظ وفتح صفحة الإيميل",
    saving: "جاري الحفظ...",
  },
  en: {
    title: "New Violation Entry",
    companyLabel: "Company",
    selectCompanyPlaceholder: "Select a company",
    violationTitle: "Title",
    violationDescription: "Description",
    violationDate: "Violation Date",
    violationTime: "Violation Time",
    location: "Location",
    severity: "Severity",
    severityOptions: ["Low", "Medium", "High"],
    saveButton: "Save & Open Email",
    saving: "Saving...",
  },
};

const ViolationNew: React.FC = () => {
  // تعريب (العربية افتراضي)
  const [lang, setLang] = useState<Language>("ar");

  // بيانات المستخدم ثابتة مؤقتًا
  const user: User = {
    id: "00000000-0000-0000-0000-000000000001",
    name: lang === "ar" ? "مستخدم تجريبي" : "Test User",
    email: "testuser@example.com",
  };

  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    company_id: "",
    violation_type_id: "",
    title: "",
    description: "",
    violation_date: "",
    violation_time: "",
    location: "",
    severity: lang === "ar" ? "متوسطة" : "Medium",
  });

  const [saving, setSaving] = useState(false);

  // جلب الشركات من قاعدة البيانات
  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name_ar, name_en")
      .order("name_ar", { ascending: true });
    if (error) {
      alert(
        lang === "ar"
          ? "خطأ في جلب الشركات: " + error.message
          : "Error fetching companies: " + error.message
      );
      return;
    }
    setCompanies(data || []);
  };

  React.useEffect(() => {
    fetchCompanies();
  }, []);

  // تحديث اللغة ودرجة الخطورة معًا
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      severity: lang === "ar" ? "متوسطة" : "Medium",
    }));
  }, [lang]);

  const t = translations[lang];

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const saveViolation = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("violations")
      .insert({
        company_id: formData.company_id,
        violation_type_id: formData.violation_type_id || null,
        title: formData.title,
        description: formData.description,
        violation_date: formData.violation_date,
        violation_time: formData.violation_time || null,
        location: formData.location,
        severity: formData.severity,
        attachments: [],
        status: "pending",
        inserted_by: user.id,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      alert(
        lang === "ar"
          ? "خطأ أثناء حفظ المخالفة: " + error.message
          : "Error saving violation: " + error.message
      );
      return null;
    }

    return data;
  };

  const createMailtoLink = (violation: any) => {
    const emailTo = "intermediate@gov.abudhabi";

    const subject = encodeURIComponent(
      lang === "ar"
        ? `مخالفة شركة - ${violation.title}`
        : `Company Violation - ${violation.title}`
    );

    const bodyText = lang === "ar"
      ? `
السلام عليكم،

نود إعلامكم بوجود مخالفة بتاريخ ${violation.violation_date}:

العنوان: ${violation.title}
الوصف: ${violation.description}
الموقع: ${violation.location || "غير محدد"}
درجة الخطورة: ${violation.severity}

يرجى اتخاذ الإجراءات اللازمة.

تحياتي،
${user.name}
    `
      : `
Hello,

Please be informed of a violation dated ${violation.violation_date}:

Title: ${violation.title}
Description: ${violation.description}
Location: ${violation.location || "Not specified"}
Severity: ${violation.severity}

Please take the necessary actions.

Regards,
${user.name}
    `;

    const body = encodeURIComponent(bodyText);

    return `mailto:${emailTo}?subject=${subject}&body=${body}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const violation = await saveViolation();
    if (!violation) return;

    const mailtoLink = createMailtoLink(violation);

    window.open(mailtoLink, "_blank");

    // حفظ بيانات الإرسال
    const { error } = await supabase.from("violation_sends").insert({
      violation_id: violation.id,
      sent_to: "شركة بروفيس",
      sent_email: "intermediate@gov.abudhabi",
      subject:
        lang === "ar"
          ? `مخالفة شركة - ${violation.title}`
          : `Company Violation - ${violation.title}`,
      body: mailtoLink,
      email_link: mailtoLink,
      sent_by: user.id,
      sent_at: new Date().toISOString(),
    });

    if (error) {
      alert(
        lang === "ar"
          ? "خطأ أثناء حفظ بيانات الإرسال: " + error.message
          : "Error saving send data: " + error.message
      );
    } else {
      alert(
        lang === "ar"
          ? "تم حفظ المخالفة وفتح صفحة إرسال الإيميل."
          : "Violation saved and email page opened."
      );
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          {lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        </button>
      </div>

      <h2>{t.title}</h2>
      <form onSubmit={handleSubmit}>
        <label>{t.companyLabel}</label>
        <select
          name="company_id"
          value={formData.company_id}
          onChange={handleChange}
          required
        >
          <option value="">{t.selectCompanyPlaceholder}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {lang === "ar" ? c.name_ar || c.name_en : c.name_en || c.name_ar}
            </option>
          ))}
        </select>
        <br />

        <label>{t.violationTitle}</label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
        />
        <br />

        <label>{t.violationDescription}</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
        />
        <br />

        <label>{t.violationDate}</label>
        <input
          type="date"
          name="violation_date"
          value={formData.violation_date}
          onChange={handleChange}
          required
        />
        <br />

        <label>{t.violationTime}</label>
        <input
          type="time"
          name="violation_time"
          value={formData.violation_time}
          onChange={handleChange}
        />
        <br />

        <label>{t.location}</label>
        <input
          type="text"
          name="location"
          value={formData.location}
          onChange={handleChange}
        />
        <br />

        <label>{t.severity}</label>
        <select
          name="severity"
          value={formData.severity}
          onChange={handleChange}
        >
          {t.severityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <br />

        <button type="submit" disabled={saving}>
          {saving ? t.saving : t.saveButton}
        </button>
      </form>
    </div>
  );
};

export default ViolationNew;
