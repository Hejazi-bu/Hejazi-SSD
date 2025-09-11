// src/components/Risk & Maintenance/RiskOrMaintenanceNew.tsx
import React, { useState, useEffect } from "react";
import Select from "react-select";
import {
  FaExclamationTriangle,
  FaUserShield,
  FaTools,
  FaLeaf,
  FaBuilding,
  FaHome,
  FaGlobe,
  FaBars,
} from "react-icons/fa";
import { db } from "../../lib/supabaseClient"; // تعديل: استبدال supabase بـ db
import { Client } from 'pg'; // تعديل: إضافة هذا الاستيراد للنوع

type Language = "en" | "ar";

type Option = {
  value: any;
  label: string;
};

const translations = {
  en: {
    title: "Risk Assessment",
    activity: "Activity",
    selectActivity: "Select Activity",
    hazardLabel: "Select Hazard Type",
    likelihood: [
      { value: 1, label: "1 - Rare", description: "The event is very unlikely to occur but is possible under exceptional circumstances.", example: "Example: Earthquake in a stable area." },
      { value: 2, label: "2 - Unlikely", description: "The event could occur at some time but is not expected to happen.", example: "Example: A fire in a well-maintained electrical room." },
      { value: 3, label: "3 - Possible", description: "The event might occur occasionally under certain conditions.", example: "Example: Slipping due to occasional floor cleaning." },
      { value: 4, label: "4 - Likely", description: "The event will probably occur in most circumstances.", example: "Example: Worker injury in a noisy construction zone." },
      { value: 5, label: "5 - Almost Certain", description: "The event is expected to occur frequently.", example: "Example: Minor cuts from daily use of sharp tools." },
    ],
    consequence: [
      { value: 1, label: "1 - Insignificant", description: "No injuries, low impact or damage.", example: "Example: Paper cut or noise discomfort." },
      { value: 2, label: "2 - Minor", description: "Minor injuries or damage requiring first aid.", example: "Example: Small burn from hot surface." },
      { value: 3, label: "3 - Moderate", description: "Injuries requiring medical treatment or moderate damage.", example: "Example: Muscle sprain needing clinic visit." },
      { value: 4, label: "4 - Major", description: "Serious injury or major damage requiring hospitalization.", example: "Example: Broken bone or severe electrical shock." },
      { value: 5, label: "5 - Catastrophic", description: "Death, permanent disability, or total loss.", example: "Example: Fatal fall from height or building fire." },
    ],
    save: "Save Risk Report",
    saved: "Risk saved successfully!",
    controlMeasures: {
      physical: ["Use safety signs", "Clear walkways", "Provide personal protective equipment (PPE)"],
      chemical: ["Store chemicals safely", "Use gloves and masks", "Ensure proper ventilation"],
      biological: ["Sanitize area regularly", "Use masks and gloves", "Isolate infected zones"],
      environmental: ["Reduce emissions", "Use eco-friendly materials", "Manage waste properly"],
      equipment: ["Perform regular maintenance", "Check equipment before use", "Train users on safety procedures"],
    },
    home: "Home",
    menu: "Risk Services",
    newPage: "New",
  },
  ar: {
    title: "تقييم المخاطر",
    activity: "النشاط",
    selectActivity: "اختر نشاطًا",
    hazardLabel: "اختر نوع الخطر",
    likelihood: [
      { value: 1, label: "1 - نادر", description: "من غير المحتمل جدًا أن يحدث إلا في ظروف استثنائية.", example: "مثال: حدوث زلزال في منطقة مستقرة." },
      { value: 2, label: "2 - غير محتمل", description: "قد يحدث أحيانًا لكنه غير متوقع.", example: "مثال: نشوب حريق في غرفة كهرباء جيدة الصيانة." },
      { value: 3, label: "3 - محتمل", description: "قد يحدث أحيانًا في بعض الظروف.", example: "مثال: الانزلاق نتيجة تنظيف الأرضية بشكل متقطع." },
      { value: 4, label: "4 - مرجح", description: "من المرجح أن يحدث في معظم الظروف.", example: "مثال: إصابة عامل في موقع بناء مزدحم وصاخب." },
      { value: 5, label: "5 - شبه مؤكد", description: "متوقع حدوثه بشكل متكرر.", example: "مثال: جروح بسيطة أثناء استخدام أدوات حادة بشكل يومي." },
    ],
    consequence: [
      { value: 1, label: "1 - طفيف", description: "لا إصابات أو أضرار بسيطة جداً.", example: "مثال: خدش بسيط أو إزعاج من الضوضاء." },
      { value: 2, label: "2 - ثانوي", description: "إصابات طفيفة أو أضرار بسيطة.", example: "مثال: حرق بسيط من سطح ساخن." },
      { value: 3, label: "3 - متوسط", description: "إصابات تحتاج لعلاج طبي أو أضرار متوسطة.", example: "مثال: التواء عضلي يتطلب زيارة طبية." },
      { value: 4, label: "4 - كبير", description: "إصابات خطيرة أو أضرار كبيرة.", example: "مثال: كسر في العظم أو صدمة كهربائية قوية." },
      { value: 5, label: "5 - كارثي", description: "وفاة أو عجز دائم أو خسائر كبيرة جداً.", example: "مثال: سقوط مميت من ارتفاع أو حريق كبير في مبنى." },
    ],
    save: "حفظ تقرير الخطر",
    saved: "تم حفظ الخطر بنجاح!",
    controlMeasures: {
      physical: ["استخدام لافتات السلامة", "توضيح الممرات", "توفير معدات الحماية الشخصية"],
      chemical: ["تخزين المواد الكيميائية بأمان", "استخدام القفازات والكمامات", "ضمان التهوية المناسبة"],
      biological: ["تعقيم المنطقة بانتظام", "استخدام الكمامات والقفازات", "عزل المناطق المصابة"],
      environmental: ["تقليل الانبعاثات", "استخدام مواد صديقة للبيئة", "إدارة النفايات بشكل صحيح"],
      equipment: ["إجراء صيانة دورية", "فحص المعدات قبل الاستخدام", "تدريب المستخدمين على السلامة"],
    },
    home: "الرئيسية",
    menu: "خدمات المخاطر",
    newPage: "جديد",
  },
};

const hazardIcons = {
  physical: <FaExclamationTriangle color="#D9534F" size={30} />,
  chemical: <FaTools color="#F0AD4E" size={30} />,
  biological: <FaUserShield color="#5BC0DE" size={30} />,
  environmental: <FaLeaf color="#5CB85C" size={30} />,
  equipment: <FaBuilding color="#337AB7" size={30} />,
};

export default function RiskAssessment() {
  const [language, setLanguage] = useState<Language>("en");
  const t = translations[language];

  const [activityOptions, setActivityOptions] = useState<Option[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Option | null>(null);

  const [hazardOptions, setHazardOptions] = useState<Option[]>([]);
  const [selectedHazard, setSelectedHazard] = useState<Option | null>(null);

  const [controlMeasuresOptions, setControlMeasuresOptions] = useState<Option[]>([]);
  const [selectedControlMeasure, setSelectedControlMeasure] = useState<Option | null>(null);

  const [activityReference, setActivityReference] = useState<string>("");

  const [likelihood, setLikelihood] = useState<number>(1);
  const [consequence, setConsequence] = useState<number>(1);
  const [saved, setSaved] = useState(false);

  // حالة القائمة الجانبية (Sidebar)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // جلب الأنشطة من Supabase عند تغيير اللغة
  useEffect(() => {
    async function fetchActivities() {
      try {
        // تعديل: استبدال استعلام Supabase بـ db.query
        const res = await db.query('SELECT * FROM activity ORDER BY id ASC');
        const options = res.rows.map((item: any) => ({
          value: item.id,
          label: language === "ar" ? item.name_ar : item.name_en,
        }));

        setActivityOptions(options);
        setSelectedActivity(null);
        setHazardOptions([]);
        setSelectedHazard(null);
      } catch (error) {
        console.error("Error fetching activities:", error);
      }
    }

    fetchActivities();
  }, [language]);

  // جلب المخاطر حسب النشاط المختار واللغة
  useEffect(() => {
    async function fetchHazards() {
      if (!selectedActivity) {
        setHazardOptions([]);
        setSelectedHazard(null);
        return;
      }
      try {
        // تعديل: استبدال استعلام Supabase بـ db.query
        const res = await db.query('SELECT id, name_en, name_ar FROM hazards WHERE activity_id = $1 ORDER BY id ASC', [selectedActivity.value]);
        const options = res.rows.map((item: any) => ({
          value: item.id,
          label: language === "ar" ? item.name_ar : item.name_en,
        }));

        setHazardOptions(options);
        setSelectedHazard(null);
      } catch (error) {
        console.error("Error fetching hazards:", error);
      }
    }

    fetchHazards();
  }, [selectedActivity, language]);

  // جلب إجراءات التحكم حسب النشاط المختار
  useEffect(() => {
    async function fetchControlMeasures() {
      if (!selectedActivity) {
        setControlMeasuresOptions([]);
        setSelectedControlMeasure(null);
        setActivityReference("");
        return;
      }
      try {
        // تعديل: استبدال استعلام Supabase بـ db.query
        const cmRes = await db.query('SELECT id, name_en, name_ar FROM control_measures WHERE activity_id = $1 ORDER BY id ASC', [selectedActivity.value]);
        const options = cmRes.rows.map((item: any) => ({
          value: item.id,
          label: language === "ar" ? item.name_ar : item.name_en,
        }));
        setControlMeasuresOptions(options);
        setSelectedControlMeasure(null);

        // تعديل: استبدال استعلام Supabase بـ db.query
        const actRes = await db.query('SELECT reference FROM activity WHERE id = $1', [selectedActivity.value]);
        const actData = actRes.rows[0];

        if (actData) {
          setActivityReference(actData.reference);
        } else {
          setActivityReference("");
        }
      } catch (error) {
        console.error("Error fetching control measures or activity reference:", error);
      }
    }

    fetchControlMeasures();
  }, [selectedActivity, language]);

  const riskScore = likelihood * consequence;

  const riskLevels = [
    {
      min: 15,
      max: 25,
      level: language === "en" ? "Extreme Risk" : "خطر شديد",
      color: "#d9534f",
      action:
        language === "en"
          ? "Activity or industry should not proceed in current form."
          : "يجب إيقاف النشاط فوراً ولا يسمح بالاستمرار على هذا الشكل الحالي.",
    },
    {
      min: 8,
      max: 12,
      level: language === "en" ? "High Risk" : "خطر عالي",
      color: "#f0ad4e",
      action:
        language === "en"
          ? "Activity or industry should be modified to include remedial planning and action and be subject to detailed OSH assessment."
          : "يجب تعديل النشاط ووضع خطة علاجية ومتابعة تقييم مفصل للسلامة.",
    },
    {
      min: 4,
      max: 6,
      level: language === "en" ? "Moderate Risk" : "خطر متوسط",
      color: "#5bc0de",
      action:
        language === "en"
          ? "Activity or industry can operate subject to management and/or modification."
          : "يمكن استمرار النشاط مع مراقبة الإدارة أو إجراء تعديلات ضرورية.",
    },
    {
      min: 1,
      max: 3,
      level: language === "en" ? "Low Risk" : "خطر منخفض",
      color: "#5cb85c",
      action:
        language === "en"
          ? "No immediate action required, unless escalation of risk is possible."
          : "لا حاجة لاتخاذ إجراء فوري، إلا إذا كان هناك احتمال لزيادة الخطورة.",
    },
  ];

  const riskLevelInfo = riskLevels.find(
    (level) => riskScore >= level.min && riskScore <= level.max
  );

  function saveRisk() {
    if (!selectedHazard) return;
    // ضع هنا كود الحفظ في قاعدة البيانات حسب الحاجة
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <>
      {/* الترويسة الثابتة */}
<header
  style={{
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#337ab7",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 15px",
    zIndex: 1000,
    fontFamily: "Arial, sans-serif",
    userSelect: "none",
    direction: language === "ar" ? "rtl" : "ltr", // إضافة اتجاه
  }}
>
  {/* أقصى اليمين: الرئيسية + اللغة */}
  <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
    <button
      onClick={() => alert(translations[language].home + " clicked")}
      style={{
        background: "none",
        border: "none",
        color: "white",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontWeight: "bold",
        fontSize: 16,
      }}
      aria-label={translations[language].home}
    >
      <FaHome />
      {translations[language].home}
    </button>

    <button
      onClick={() => setLanguage(language === "en" ? "ar" : "en")}
      style={{
        background: "none",
        border: "none",
        color: "white",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontWeight: "bold",
        fontSize: 16,
      }}
      aria-label="Change Language"
    >
      <FaGlobe />
      {language === "en" ? "العربية" : "English"}
    </button>
  </div>

  {/* المنتصف */}
  <div style={{ fontWeight: "bold", fontSize: 20 }}>
    {language === "en" ? "Risk Management" : "إدارة المخاطر"}
  </div>

  {/* أقصى اليسار: جديد + قائمة (3 خطوط) مجاورين */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 15,
      cursor: "default",
      userSelect: "none",
    }}
  >
    {/* كلمة جديد غير زر */}
    <span
      style={{
        color: "white",
        fontWeight: "bold",
        fontSize: 16,
        padding: "5px 10px",
        borderBottom: "2px solid white", // تبين أنها الصفحة الحالية
      }}
      aria-current="page"
    >
      {translations[language].newPage}
    </span>

    {/* زر القائمة (3 خطوط) */}
    <button
      onClick={() => setSidebarOpen(!sidebarOpen)}
      style={{
        background: "none",
        border: "none",
        color: "white",
        cursor: "pointer",
        fontSize: 24,
        padding: 0,
        margin: 0,
      }}
      aria-label={translations[language].menu}
      title={translations[language].menu} // لإظهار الاسم عند المرور بالفأرة
    >
      <FaBars />
    </button>
  </div>
</header>

      {/* القائمة الجانبية */}
      <nav
        style={{
          position: "fixed",
          top: 60,
          left: sidebarOpen ? 0 : "-250px",
          width: 250,
          height: "100vh",
          backgroundColor: "#f8f9fa",
          boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
          transition: "left 0.3s ease-in-out",
          zIndex: 999,
          padding: "20px",
          fontFamily: "Arial, sans-serif",
          direction: language === "ar" ? "rtl" : "ltr",
        }}
      >
        <h3>{translations[language].menu}</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          <li>
            <button
              style={{
                background: "none",
                border: "none",
                padding: "8px 0",
                width: "100%",
                textAlign: language === "ar" ? "right" : "left",
                cursor: "pointer",
                fontSize: 16,
                color: "#337ab7",
              }}
              onClick={() => alert("التقارير (قيد التطوير)")}
            >
              {language === "en" ? "Reports" : "التقارير"}
            </button>
          </li>
          <li>
            <button
              style={{
                background: "none",
                border: "none",
                padding: "8px 0",
                width: "100%",
                textAlign: language === "ar" ? "right" : "left",
                cursor: "pointer",
                fontSize: 16,
                color: "#337ab7",
              }}
              onClick={() => alert("السجلات (قيد التطوير)")}
            >
              {language === "en" ? "Records" : "السجلات"}
            </button>
          </li>
          {/* أضف روابط أخرى هنا حسب الحاجة */}
        </ul>
      </nav>

      {/* المحتوى الرئيسي مع تعويض الهامش العلوي بسبب الترويسة الثابتة */}
      <main
        style={{
          maxWidth: "1200px",
          margin: "80px auto 20px",
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          padding: "30px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
          fontFamily: "Arial, sans-serif",
          direction: language === "ar" ? "rtl" : "ltr",
        }}
      >
        {/* --- هنا يبدأ الكود الأصلي --- */}
        <section style={{ marginBottom: 25 }}>
          <h2>{language === "en" ? "Select Activity and Hazard" : "اختر النشاط ونوع الخطر"}</h2>

          <label>
            <strong>{t.activity}</strong>
            <Select
              options={activityOptions}
              value={selectedActivity}
              onChange={(option) => setSelectedActivity(option)}
              placeholder={t.selectActivity}
              isClearable
              isSearchable
              noOptionsMessage={() =>
                language === "en" ? "No activity types found" : "لم يتم العثور على أنواع النشاط"
              }
            />
          </label>

          {selectedActivity && (
            <div style={{ marginTop: 15 }}>
              <label>
                <strong>{t.hazardLabel}</strong>
                <Select
                  options={hazardOptions}
                  value={selectedHazard}
                  onChange={(option) => setSelectedHazard(option)}
                  placeholder={language === "en" ? "Select hazard..." : "اختر نوع الخطر..."}
                  isClearable
                  isSearchable
                  noOptionsMessage={() =>
                    language === "en" ? "No hazards found" : "لم يتم العثور على أنواع الخطر"
                  }
                />
              </label>
            </div>
          )}
        </section>

        <section style={{ marginBottom: 25 }}>
          <h2>{language === "en" ? "Evaluate Risk" : "تقييم الخطر"}</h2>
          <p>
            {language === "en"
              ? "Select the likelihood and consequence of the hazard occurring. See the explanation below for guidance."
              : "اختر الاحتمالية والعواقب لحدوث الخطر. انظر الشرح أدناه للمساعدة."}
          </p>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 45%" }}>
              <label>
                <strong>
                  {language === "en"
                    ? "Likelihood (How likely is the hazard to occur?)"
                    : "الاحتمالية (ما مدى احتمال حدوث الخطر؟)"}
                </strong>
                <select
                  value={likelihood}
                  onChange={(e) => setLikelihood(Number(e.target.value))}
                  style={{ width: "100%", padding: 6, marginTop: 5 }}
                  aria-describedby="likelihood-desc"
                >
                  {t.likelihood.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p id="likelihood-desc" style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                {t.likelihood.find((l) => l.value === likelihood)?.description}
              </p>
              <p style={{ fontSize: 12, color: "#777" }}>
                <strong>{language === "en" ? "Example:" : "مثال:"}</strong>{" "}
                {t.likelihood.find((l) => l.value === likelihood)?.example}
              </p>
            </div>

            <div style={{ flex: "1 1 45%" }}>
              <label>
                <strong>
                  {language === "en"
                    ? "Consequence (What is the severity if the hazard occurs?)"
                    : "العواقب (ما شدة الضرر إذا حدث الخطر؟)"}
                </strong>
                <select
                  value={consequence}
                  onChange={(e) => setConsequence(Number(e.target.value))}
                  style={{ width: "100%", padding: 6, marginTop: 5 }}
                  aria-describedby="consequence-desc"
                >
                  {t.consequence.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p id="consequence-desc" style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                {t.consequence.find((c) => c.value === consequence)?.description}
              </p>
              <p style={{ fontSize: 12, color: "#777" }}>
                <strong>{language === "en" ? "Example:" : "مثال:"}</strong>{" "}
                {t.consequence.find((c) => c.value === consequence)?.example}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <h3>
              {language === "en" ? "Risk Score:" : "مجموع الخطورة:"}{" "}
              <span
                style={{
                  fontWeight: "bold",
                  color: riskLevelInfo ? riskLevelInfo.color : "#000",
                }}
              >
                {riskScore}
              </span>
            </h3>
            {riskLevelInfo && (
              <>
                <h4 style={{ color: riskLevelInfo.color, marginTop: 10, marginBottom: 5 }}>
                  {riskLevelInfo.level}
                </h4>
                <p>{riskLevelInfo.action}</p>
              </>
            )}
          </div>
        </section>

        <section style={{ marginBottom: 25 }}>
          <h2>{language === "en" ? "Control Measures" : "إجراءات التحكم"}</h2>
          {selectedActivity && (
            <div>
              <label>
                <strong>{language === "en" ? "Select Control Measure" : "اختر إجراء تحكم"}</strong>
                <Select
                  options={controlMeasuresOptions}
                  value={selectedControlMeasure}
                  onChange={(option) => setSelectedControlMeasure(option)}
                  placeholder={
                    language === "en" ? "Select control measure..." : "اختر إجراء التحكم..."
                  }
                  isClearable
                  isSearchable
                  noOptionsMessage={() =>
                    language === "en"
                      ? "No control measures found"
                      : "لم يتم العثور على إجراءات التحكم"
                  }
                />
              </label>
            </div>
          )}

          {selectedActivity && activityReference && (
            <div style={{ marginTop: 15 }}>
              <p>
                {language === "en" ? "Activity Reference Code:" : "كود مرجعي للنشاط:"}{" "}
                <strong>{activityReference}</strong>
              </p>
            </div>
          )}
        </section>

        <button
          onClick={saveRisk}
          disabled={!selectedHazard}
          style={{
            backgroundColor: selectedHazard ? "#337ab7" : "#ccc",
            color: "white",
            padding: "10px 20px",
            border: "none",
            borderRadius: 5,
            cursor: selectedHazard ? "pointer" : "not-allowed",
          }}
          aria-disabled={!selectedHazard}
        >
          {t.save}
        </button>

        {saved && (
          <div
            role="alert"
            style={{
              marginTop: 20,
              padding: 10,
              backgroundColor: "#dff0d8",
              color: "#3c763d",
              borderRadius: 5,
            }}
          >
            {t.saved}
          </div>
        )}
      </main>
    </>
  );
}