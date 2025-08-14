import React, { useEffect, useState, useRef } from "react";
import ar from "../../locales/ar";
import en from "../../locales/en";

import {
  Globe,
  Home,
  FileText,
  BarChart2,
  ClipboardList,
  Info,
  MapPin,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { cleanText } from "../../utils/textUtils";

type Sector = {
  id: string;
  name_en: string;
  name_ar: string;
};

type Building = {
  id: string;
  name_en: string;
  name_ar: string;
  Map: string | null;
  sector_id: string;
  guards_morning_shift?: number; // 👈 أضف هذا
  guards_night_shift?: number;   // 👈 وأضف هذا
  extinguishers_count?: number | null;
  first_aid_boxes_count?: number | null; // ✅ أضف هذا
};

type SubBuilding = {
  id: string;
  name_en: string;
  name_ar: string;
  Map: string | null;
  building_id: string;
  guards_morning_shift?: number; // 👈 أضف هذا
  guards_night_shift?: number;   // 👈 وأضف هذا
  extinguishers_count?: number | null;
  first_aid_boxes_count?: number | null; // ✅ أضف هذا
};

type Distribution = {
  id: string;
  assigned_user_id: string;
  sector_id: string;
  building_id: string;
  sub_building_id: string | null;
  assigned_date: string | null;
  is_completed: boolean;
};

type User = {
  id: string;
  full_name_ar: string;
  full_name_en: string;
};

type Props = {
  language: "ar" | "en";
  onLanguageChange: (lang: "ar" | "en") => void;
  onBackToHome: () => void;
  onGoToReports: () => void;
  onGoToRecords: () => void;
  userId?: string;
};

const InspectionNew: React.FC<Props> = ({
  language,
  onLanguageChange,
  onBackToHome,
  onGoToReports,
  onGoToRecords,
  userId,
}) => {
  const t = language === "ar" ? ar : en;
  const dir = language === "ar" ? "rtl" : "ltr";

  // بيانات وهمية: المفتشين
  const [users, setUsers] = useState<User[]>([]);
  // مفتش مختار (لتجربة القائمة مؤقتا)
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // المفتش الفعلي المستخدم في جلب البيانات
  const actualUserId = selectedUserId || userId || "3d33fb7e-fecf-4af1-9a29-ba7006b3e6b8"; // أحمد محمد كمثال افتراضي

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [subBuildings, setSubBuildings] = useState<SubBuilding[]>([]);
  const [distribution, setDistribution] = useState<Distribution[]>([]);

  const [selectedSectorId, setSelectedSectorId] = useState<string>("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedSubBuildingId, setSelectedSubBuildingId] = useState<string>("");
  const prevUserIdRef = useRef<string | null>(null);

  const [actualGuards, setActualGuards] = useState<string>("");
  const [guardCountNotes, setGuardCountNotes] = useState<string>("");
  const [guardCompetency, setGuardCompetency] = useState<string>("");
  const [guardCompetencyNotes, setGuardCompetencyNotes] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState(""); // للوردية
  const [currentShift, setCurrentShift] = useState("");

  const [actualExtinguishers, setActualExtinguishers] = useState("");
  const [extinguisherNotes, setExtinguisherNotes] = useState("");
  const [extinguisherValidity, setExtinguisherValidity] = useState("");
  const [extinguisherValidityNotes, setExtinguisherValidityNotes] = useState("");

  const [actualFirstAidBoxes, setActualFirstAidBoxes] = useState("");
  const [firstAidBoxNotes, setFirstAidBoxNotes] = useState("");
  const [firstAidBoxQuantityStatus, setFirstAidBoxQuantityStatus] = useState("");
  const [firstAidBoxQuantityNotes, setFirstAidBoxQuantityNotes] = useState("");
  const [firstAidBoxValidity, setFirstAidBoxValidity] = useState("");
  const [firstAidBoxValidityNotes, setFirstAidBoxValidityNotes] = useState("");

  const getTodayString = () => {
    return new Date().toISOString().split("T")[0];
  };

  // 🧠 States for Risks
  const [showRiskForm, setShowRiskForm] = useState(false);
  const riskGroupRef = useRef<HTMLSelectElement | null>(null);
  const [editingRiskId, setEditingRiskId] = useState<number | null>(null);

  useEffect(() => {
    if (showRiskForm && riskGroupRef.current) {
      riskGroupRef.current.focus();
    }
  }, [showRiskForm, editingRiskId]);

  const [riskGroup, setRiskGroup] = useState("");
  const [riskDescription, setRiskDescription] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [riskLocation, setRiskLocation] = useState("");
  const [riskNotes, setRiskNotes] = useState("");
  const [riskFiles, setRiskFiles] = useState<File[]>([]);
  const [temporaryRisks, setTemporaryRisks] = useState<any[]>([]);

  type RiskGroupKey = "electrical" | "civil" | "obstacles";
  type RiskLevelKey = "high" | "medium" | "low";

  const riskGroups: Record<RiskGroupKey, { ar: string; en: string }> = {
    electrical: { ar: "كهربائية", en: "Electrical" },
    civil: { ar: "مدنية", en: "Civil" },
    obstacles: { ar: "عوائق", en: "Obstacles" },
  };

  const riskLevels: Record<RiskLevelKey, { ar: string; en: string }> = {
    high: { ar: "عالي", en: "High" },
    medium: { ar: "متوسط", en: "Medium" },
    low: { ar: "ضعيف", en: "Low" },
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);

    setRiskFiles((prev) => {
      // فلترة الملفات الجديدة بحيث لا تكون مكررة بناءً على الاسم
      const filteredNewFiles = newFiles.filter(
        (newFile) => !prev.some((existingFile) => existingFile.name === newFile.name)
      );

      return [...prev, ...filteredNewFiles];
    });
  };

  const handleRemoveFile = (index: number) => {
    setRiskFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const cancelEdit = () => {
    setEditingRiskId(null);
    setRiskGroup("");
    setRiskLevel("");
    setRiskDescription("");
    setRiskLocation("");
    setRiskNotes("");
    setRiskFiles([]);
  };

  // تعديل دالة الحفظ لتعطي نتيجة (نجاح أو فشل)
  const handleAddRiskTemporarily = (): boolean => {
    if (!riskGroup || !riskLevel || !riskDescription || !riskLocation) {
      alert(language === "ar" ? "يرجى تعبئة الحقول الإلزامية" : "Please fill all required fields");
      return false;
    }
  const cleanedDescription = cleanText(riskDescription);
  const cleanedLocation = cleanText(riskLocation);
  const cleanedNotes = cleanText(riskNotes);

  const newRisk = {
    id: editingRiskId ?? Date.now(),
    group: riskGroup,
    level: riskLevel,
    description: cleanedDescription,
    location: cleanedLocation,
    notes: cleanedNotes,
    files: riskFiles,
  };

  if (editingRiskId) {
    setTemporaryRisks((prev) =>
      prev.map((r) => (r.id === editingRiskId ? newRisk : r))
    );
    setEditingRiskId(null);
  } else {
    setTemporaryRisks((prev) => [...prev, newRisk]);
  }

  // إعادة تعيين الحقول
  setRiskGroup("");
  setRiskLevel("");
  setRiskDescription("");
  setRiskLocation("");
  setRiskNotes("");
  setRiskFiles([]);

    return true; // تم الحفظ بنجاح
  };

  const handleEditRisk = (id: number) => {
    const selected = temporaryRisks.find((r) => r.id === id);
    if (!selected) return;

    setRiskGroup(selected.group);
    setRiskLevel(selected.level);
    setRiskDescription(selected.description);
    setRiskLocation(selected.location);
    setRiskNotes(selected.notes);
    setRiskFiles(selected.files);
    setEditingRiskId(id);

    // يجب تفعيل ظهور النموذج هنا أيضاً:
    setShowRiskForm(true);
  };

  const handleDeleteRisk = (id: number) => {
    const confirmDelete = window.confirm(
      language === "ar" ? "هل أنت متأكد من حذف هذا الخطر؟" : "Are you sure you want to delete this risk?"
    );
    if (confirmDelete) {
      setTemporaryRisks((prev) => prev.filter((r) => r.id !== id));
    }
  };

const getRiskLevelColor = (level: string) => {
  switch (level.toLowerCase()) {
    case "high":
    case "عالي":
      return "text-red-600 font-bold"; // أحمر + سميك
    case "medium":
    case "متوسط":
      return "text-yellow-600 font-bold"; // أصفر + سميك
    case "low":
    case "ضعيف":
      return "text-green-600 font-bold"; // أخضر + سميك
    default:
      return "font-bold"; // سميك فقط لو القيمة غير معروفة
  }
};

// صيانة
const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
const maintenanceGroupRef = useRef<HTMLSelectElement | null>(null);
const [editingMaintenanceId, setEditingMaintenanceId] = useState<number | null>(null);

useEffect(() => {
  if (showMaintenanceForm && maintenanceGroupRef.current) {
    maintenanceGroupRef.current.focus();
  }
}, [showMaintenanceForm, editingMaintenanceId]);

const [maintenanceGroup, setMaintenanceGroup] = useState("");
const [maintenanceDescription, setMaintenanceDescription] = useState("");
const [maintenanceImportance, setMaintenanceImportance] = useState("");
const [maintenanceLocation, setMaintenanceLocation] = useState("");
const [maintenanceNotes, setMaintenanceNotes] = useState("");
const [maintenanceFiles, setMaintenanceFiles] = useState<File[]>([]);
const [temporaryMaintenances, setTemporaryMaintenances] = useState<any[]>([]);

type MaintenanceGroupKey = "electrical" | "civil" | "mechanical";
type ImportanceLevelKey = "high" | "medium" | "low";

const maintenanceGroups: Record<string, { ar: string; en: string }> = {
  electrical: { ar: "كهربائية", en: "Electrical" },
  civil: { ar: "مدنية", en: "Civil" },
  mechanical: { ar: "ميكانيكية", en: "Mechanical" },
};

const importanceLevels: Record<string, { ar: string; en: string }> = {
  high: { ar: "عالية", en: "High" },
  medium: { ar: "متوسطة", en: "Medium" },
  low: { ar: "منخفضة", en: "Low" },
};

const handleMaintenanceFileUpload = (files: FileList | null) => {
  if (!files) return;
  const fileArray = Array.from(files);
  setMaintenanceFiles((prev) => [...prev, ...fileArray]);
};

const cancelMaintenanceEdit = () => {
  setEditingMaintenanceId(null);
  setMaintenanceGroup("");
  setMaintenanceImportance("");
  setMaintenanceDescription("");
  setMaintenanceLocation("");
  setMaintenanceNotes("");
  setMaintenanceFiles([]);
};

const handleAddMaintenanceTemporarily = () => {
  if (!maintenanceGroup || !maintenanceImportance || !maintenanceDescription || !maintenanceLocation) {
    alert(language === "ar" ? "يرجى تعبئة جميع الحقول الإلزامية" : "Please fill in all required fields");
    return false;
  }

  const cleanedDescription = cleanText(maintenanceDescription);
  const cleanedLocation = cleanText(maintenanceLocation);
  const cleanedNotes = cleanText(maintenanceNotes);

  const newEntry = {
    id: editingMaintenanceId || Date.now(),
    group: maintenanceGroup,
    level: maintenanceImportance,
    description: cleanedDescription,
    location: cleanedLocation,
    notes: cleanedNotes,
    files: maintenanceFiles,
  };

  if (editingMaintenanceId) {
    setTemporaryMaintenances(prev =>
      prev.map(item => item.id === editingMaintenanceId ? newEntry : item)
    );
  } else {
    setTemporaryMaintenances(prev => [...prev, newEntry]);
  }

  cancelMaintenanceEdit();
  return true;
};

const handleEditMaintenance = (id: number) => {
  const item = temporaryMaintenances.find(m => m.id === id);
  if (!item) return;
  setEditingMaintenanceId(id);
  setMaintenanceGroup(item.group);
  setMaintenanceImportance(item.level);
  setMaintenanceDescription(item.description);
  setMaintenanceLocation(item.location);
  setMaintenanceNotes(item.notes);
  setMaintenanceFiles(item.files);
};

const handleDeleteMaintenance = (id: number) => {
  if (window.confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure?")) {
    setTemporaryMaintenances(prev => prev.filter(item => item.id !== id));
    cancelMaintenanceEdit();
  }
};

const getImportanceColor = (level: string) => {
  switch (level.toLowerCase()) {
    case "high":
    case "عالية":
      return "text-red-600 font-bold";
    case "medium":
    case "متوسطة":
      return "text-yellow-600 font-bold";
    case "low":
    case "ضعيفة":
      return "text-green-600 font-bold";
    default:
      return "font-bold";
  }
};

  useEffect(() => {
    // جلب المفتشين (بيانات وهمية أو من قاعدة بيانات)
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name_ar, full_name_en");

      if (error) {
        console.error("Error fetching users:", error);
      } else {
        setUsers(data ?? []);
        // إذا لم يتم اختيار مفتش بعد، نعين أول مفتش افتراضياً (اختياري)
        if (!selectedUserId && data && data.length > 0) {
          setSelectedUserId(data[0].id);
        }
      }
    };

    fetchUsers();
  }, []);

  const [inspectionType, setInspectionType] = useState<"scheduled" | "random">("scheduled");
  const todayStr = new Date().toISOString().split("T")[0];

useEffect(() => {
  const updateInspectionType = () => {
    // تحويل التوقيت إلى الإمارات
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const uaeDate = new Date(utc + 4 * 60 * 60 * 1000);

    const dayOfWeek = uaeDate.getDay(); // ✅ الصحيح هنا

    const type =
      dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6
        ? "random"
        : "scheduled";

    console.log("🕓 UAE Day:", dayOfWeek, "Type:", type); // للمراجعة
    setInspectionType(type);
  };

  updateInspectionType(); // مرة أولى

  // حساب الوقت المتبقي حتى منتصف الليل (00:00) بتوقيت الإمارات
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const uaeNow = new Date(utc + 4 * 60 * 60 * 1000);

  const nextMidnightUAE = new Date(uaeNow);
  nextMidnightUAE.setHours(24, 0, 0, 0); // منتصف الليل المحلي لتوقيت الإمارات

  const timeUntilMidnightUAE = nextMidnightUAE.getTime() - uaeNow.getTime();

  const timer = setTimeout(() => {
    updateInspectionType();
  }, timeUntilMidnightUAE);

  return () => clearTimeout(timer);
}, []);


useEffect(() => {
  async function fetchData() {
    if (!actualUserId) return;

    // جلب القطاعات
    const { data: sectorsData, error: sectorsError } = await supabase
      .from("sectors")
      .select("id, name_ar, name_en")
      .order(language === "ar" ? "name_ar" : "name_en", { ascending: true });

    if (sectorsError) {
      console.error("Error fetching sectors:", sectorsError);
    } else {
      setSectors(sectorsData ?? []);
    }

    if (inspectionType === "scheduled") {
      const { data: distributionData, error: distributionError } = await supabase
        .from("distribution")
        .select(`id, assigned_user_id, sector_id, building_id, sub_building_id, assigned_date, is_completed`)
        .eq("assigned_user_id", actualUserId)
        .eq("is_completed", false)
        .lte("assigned_date", todayStr);

      if (distributionError) {
        console.error("Error fetching distribution:", distributionError);
        setDistribution([]);
      } else {
        const normalizedData = (distributionData ?? []).map((d) => ({
          ...d,
          user_id: d.assigned_user_id,
        }));
        setDistribution(normalizedData);
      }
    } else {
      setDistribution([]); // تفتيش عشوائي: لا يوجد توزيع مسبق
    }

    // فقط إذا تغيّر المفتش
    if (prevUserIdRef.current !== actualUserId) {
      console.log("Resetting sector, building and sub-building selections");      
      setSelectedSectorId("");
      setSelectedBuildingId("");
      setSelectedSubBuildingId("");
      setBuildings([]);
      setSubBuildings([]);
    }
    // حفظ القيمة الحالية للمفتش
    prevUserIdRef.current = actualUserId;
  }

  fetchData();
  // لا تضع language هنا لتجنب إعادة التهيئة عند تغيّر اللغة
}, [actualUserId, inspectionType, todayStr]);


  // عرض القطاعات حسب التوزيع (المباني الفرعية فقط)
const filteredSectors = inspectionType === "random"
  ? sectors // عرض جميع القطاعات عند العشوائي
  : sectors.filter((sector) =>
      distribution.some((d) => d.sector_id === sector.id)
    );

  // جلب المباني عند اختيار القطاع فقط التي في التوزيع
useEffect(() => {
  async function fetchBuildings() {
    if (!selectedSectorId) {
      setBuildings([]);
      setSelectedBuildingId("");
      setSubBuildings([]);
      setSelectedSubBuildingId("");
      return;
    }

    if (inspectionType === "random") {
      const { data, error } = await supabase
        .from("buildings")
        .select("id, name_en, name_ar, Map, sector_id, guards_morning_shift, guards_night_shift, extinguishers_count, first_aid_boxes_count")
        .eq("sector_id", selectedSectorId)
        .order(language === "ar" ? "name_ar" : "name_en", { ascending: true });

      if (error) {
        console.error("Error fetching buildings (random):", error);
        setBuildings([]);
      } else {
        setBuildings(data ?? []);
        setSelectedBuildingId("");
        setSubBuildings([]);
        setSelectedSubBuildingId("");
      }
    } else {
      const allowedBuildingIds = distribution
        .filter((d) => d.sector_id === selectedSectorId)
        .map((d) => d.building_id);

      if (allowedBuildingIds.length === 0) {
        setBuildings([]);
        setSelectedBuildingId("");
        setSubBuildings([]);
        setSelectedSubBuildingId("");
        return;
      }

      const { data, error } = await supabase
        .from("buildings")
        .select("id, name_en, name_ar, Map, sector_id, guards_morning_shift, guards_night_shift, extinguishers_count, first_aid_boxes_count")
        .eq("sector_id", selectedSectorId)
        .in("id", allowedBuildingIds)
        .order(language === "ar" ? "name_ar" : "name_en", { ascending: true });

      if (error) {
        console.error("Error fetching buildings (scheduled):", error);
        setBuildings([]);
      } else {
        setBuildings(data ?? []);
        setSelectedBuildingId("");
        setSubBuildings([]);
        setSelectedSubBuildingId("");
      }
    }
  }

  fetchBuildings();
}, [selectedSectorId, distribution, inspectionType]); // حذف language من القائمة

    // جلب المباني الفرعية عند اختيار المبنى
useEffect(() => {
  async function fetchSubBuildings() {
    if (!selectedBuildingId) {
      setSubBuildings([]);
      setSelectedSubBuildingId("");
      return;
    }
    
    if (inspectionType === "random") {
      const { data, error } = await supabase
        .from("subbuildings")
        .select("id, name_en, name_ar, Map, building_id, guards_morning_shift, guards_night_shift, extinguishers_count, first_aid_boxes_count")
        .eq("building_id", selectedBuildingId)
        .order(language === "ar" ? "name_ar" : "name_en", { ascending: true });

      if (error) {
        console.error("Error fetching sub-buildings (random):", error);
        setSubBuildings([]);
      } else {
        setSubBuildings(data ?? []);
        setSelectedSubBuildingId("");
      }
    } else {
      const allowedSubBuildingIds = distribution
        .filter((d) => d.building_id === selectedBuildingId)
        .map((d) => d.sub_building_id)
        .filter((id): id is string => id !== null);

      if (allowedSubBuildingIds.length === 0) {
        setSubBuildings([]);
        setSelectedSubBuildingId("");
        return;
      }

      const { data, error } = await supabase
        .from("subbuildings")
        .select("id, name_en, name_ar, Map, building_id, guards_morning_shift, guards_night_shift, extinguishers_count, first_aid_boxes_count")
        .in("id", allowedSubBuildingIds)
        .order(language === "ar" ? "name_ar" : "name_en", { ascending: true });

      if (error) {
        console.error("Error fetching sub-buildings (scheduled):", error);
        setSubBuildings([]);
      } else {
        setSubBuildings(data ?? []);
        setSelectedSubBuildingId("");
      }
    }
  }

  fetchSubBuildings();
}, [selectedBuildingId, distribution, inspectionType]); // حذف language من القائمة

  // التعامل مع تغييرات الاختيار
  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUserId(e.target.value);
    // بعد تغيير المفتش نعيد تعيين الخيارات الأخرى
    setSelectedSectorId("");
    setSelectedBuildingId("");
    setSelectedSubBuildingId("");
    setBuildings([]);
    setSubBuildings([]);
  };

  const handleSectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSectorId(e.target.value);
    setSelectedBuildingId("");
    setSelectedSubBuildingId("");
    setBuildings([]);
    setSubBuildings([]);
  };

  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBuildingId(e.target.value);
    setSelectedSubBuildingId("");
    setSubBuildings([]);
  };

  const handleSubBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubBuildingId(e.target.value);
  };

  // أيقونة الخريطة
  const renderMapIcon = (mapUrl: string | null) => {
    if (!mapUrl) return null;
    return (
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={t.showMap}
        className="inline-block text-blue-600 cursor-pointer"
      >
        <MapPin className="w-5 h-5" />
      </a>
    );
  };

  // هل الحقول مفتوحة (تكون فقط بعد اختيار مفتش)
  const isFieldsEnabled = !!selectedUserId;

  return (
    <div className="min-h-screen bg-gray-500">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-blue-100 shadow-md border-b py-3 px-4">
        <div className="flex flex-wrap justify-between items-center max-w-7xl mx-auto relative">
          {/* مؤقتاً قائمة اختيار المفتشين */}
          <div className="w-48">
            <label className="block font-medium mb-1">{language === "ar" ? "اختر المفتش" : "Select Inspector"}</label>
            <select
              className="w-full p-2 border border-gray-300 rounded"
              value={selectedUserId}
              onChange={handleUserChange}
            >
              <option value="">{language === "ar" ? "اختر مفتشاً" : "Select an inspector"}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name_ar} ({user.full_name_en})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-4 sm:gap-6 items-center">
            <button
              onClick={onGoToRecords}
              className="flex flex-col items-center text-sm text-gray-600 hover:text-blue-700 transition"
            >
              <ClipboardList className="w-5 h-5" />
              <span className="hidden md:block">{t.records}</span>
            </button>
            <button
              onClick={onGoToReports}
              className="flex flex-col items-center text-sm text-gray-600 hover:text-blue-700 transition"
            >
              <BarChart2 className="w-5 h-5" />
              <span className="hidden md:block">{t.reports}</span>
            </button>
            <div className="flex flex-col items-center text-sm text-blue-700 font-semibold underline cursor-default">
              <FileText className="w-5 h-5" />
              <span className="hidden md:block">{t.new}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 sm:gap-6 items-center">
            <button
              onClick={() => onLanguageChange(language === "ar" ? "en" : "ar")}
              className="flex flex-col items-center text-sm text-gray-600 hover:text-blue-700 transition"
            >
              <Globe className="w-5 h-5" />
              <span className="hidden md:block">{language === "ar" ? "English" : "العربية"}</span>
            </button>
            <button
              onClick={onBackToHome}
              className="flex flex-col items-center text-sm text-gray-600 hover:text-blue-700 transition"
            >
              <Home className="w-5 h-5" />
              <span className="hidden md:block">{t.backToHome}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main dir={dir} className="p-6 w-full">
        <section className="bg-blue-50 border border-blue-200 text-blue-900 rounded-md shadow p-6 w-full max-w-none px-6 mt-6">
          <h2 className="text-center text-xl font-bold mb-6 flex items-center justify-center gap-2 select-none">
            <Info className="w-6 h-6" />
            {t.inspectionData}
          </h2>

          {/* Inspection Type and Sector in one row on md+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Inspection Type */}
            <div>
              <label className="block mb-2 font-medium">{t.inspectionType}</label>
              <select
                className={`w-full border border-gray-300 rounded px-3 py-2 ${
                  "cursor-not-allowed bg-gray-100"
                }`}
                value={inspectionType}
                disabled // منع المستخدم من التعديل يدويًا
              >
                <option value="scheduled">{t.scheduled}</option>
                <option value="random">{t.random}</option>
              </select>
            </div>
            {/* Sector */}
            <div>
              <label className="block mb-2 font-medium">{t.sector}</label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={selectedSectorId}
                onChange={handleSectorChange}
                disabled={!isFieldsEnabled}
              >
                <option value="">{t.selectSector}</option>
                {filteredSectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {language === "ar" ? sector.name_ar : sector.name_en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Building and SubBuilding in one row on md+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Building with map icon */}
            <div className="flex items-center gap-2">
              <div className="flex-grow">
                <label className="block mb-2 font-medium">
                  {language === "ar" ? "الموقع" : "Site"}
                </label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={selectedBuildingId}
                  onChange={handleBuildingChange}
                  disabled={!isFieldsEnabled || buildings.length === 0}
                >
                  <option value="">
                    {buildings.length === 0
                      ? language === "ar"
                        ? "اختر القطاع أولاً"
                        : "Select sector first"
                      : t.selectBuilding}
                  </option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {language === "ar" ? building.name_ar : building.name_en}
                    </option>
                  ))}
                </select>
              </div>
              {selectedBuildingId &&
                (() => {
                  const building = buildings.find((b) => b.id === selectedBuildingId);
                  if (building && building.Map && subBuildings.length === 0) {
                    return renderMapIcon(building.Map);
                  }
                  return null;
                })()}
            </div>

            {/* SubBuilding with map icon */}
            {subBuildings.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-grow">
                  <label className="block mb-2 font-medium">
                    {language === "ar" ? "المبنى" : "Building"}
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={selectedSubBuildingId}
                    onChange={handleSubBuildingChange}
                    disabled={!isFieldsEnabled}
                  >
                    <option value="">
                      {language === "ar" ? "اختر المبنى" : "Select building"}
                    </option>
                    {subBuildings.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {language === "ar" ? sub.name_ar : sub.name_en}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedSubBuildingId &&
                  (() => {
                    const subBuilding = subBuildings.find(
                      (sb) => sb.id === selectedSubBuildingId
                    );
                    return subBuilding && subBuilding.Map
                      ? renderMapIcon(subBuilding.Map)
                      : null;
                  })()}
              </div>
            )}
          </div>
        </section>
        
{/* Security Guards Section */}
<section className="bg-blue-50 border border-blue-200 text-blue-900 rounded-md shadow p-6 w-full max-w-none px-6 mt-6">
  <h2 className="text-center text-xl font-bold mb-6 flex items-center justify-center gap-2 select-none">
    <span role="img" aria-label="Security">👮‍♂️</span>
    {language === "ar" ? "حراس الأمن" : "Security Guards"}
  </h2>

  {(() => {
    const selected =
      subBuildings.find((sb) => sb.id === selectedSubBuildingId) ||
      buildings.find((b) => b.id === selectedBuildingId);

    const morningGuards = selected?.guards_morning_shift ?? 0;
    const nightGuards = selected?.guards_night_shift ?? 0;

    const isBlocked =
      (subBuildings.length > 0 && !selectedSubBuildingId) ||
      !selectedBuildingId ||
      !selectedSectorId;

    return (
      <>
        {isBlocked && (
          <div className="text-red-600 font-semibold mb-4">
            {language === "ar"
              ? "الرجاء اختيار المبنى أولاً لإكمال بيانات حراس الأمن"
              : "Please select the building first to complete the security guard information."}
          </div>
        )}

        {!isBlocked && (
          <>
            {/* عدد الحراس في كل وردية */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-2 font-medium">
                  {language === "ar" ? "عدد حراس وردية الصباح" : "Morning Shift Guards"}
                </label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
                  value={morningGuards}
                  readOnly
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">
                  {language === "ar" ? "عدد حراس وردية الليل" : "Night Shift Guards"}
                </label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
                  value={nightGuards}
                  readOnly
                />
              </div>
            </div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 items-end">
  {/* Current Shift Dropdown */}
  <div>
    <label className="block mb-2 font-medium">
      {language === "ar" ? "الوردية الحالية" : "Current Shift"}
    </label>
    <select
      className="w-full border border-gray-300 rounded px-3 py-2"
      value={currentShift}
      onChange={(e) => setCurrentShift(e.target.value)}
    >
      <option value="">{language === "ar" ? "اختر الوردية" : "Select Shift"}</option>
      <option value="morning">{language === "ar" ? "وردية الصباح" : "Morning Shift"}</option>
      <option value="night">{language === "ar" ? "وردية الليل" : "Night Shift"}</option>
    </select>
  </div>

  {/* Present Guards - show only if shift is selected */}
  {currentShift && (
    <div>
      <label className="block mb-2 font-medium">
        {language === "ar" ? "عدد الحراس الموجود حالياً" : "Present Guards (Now)"}
      </label>
      <input
        type="number"
        className="w-full border border-gray-300 rounded px-3 py-2"
        value={actualGuards}
        onChange={(e) => setActualGuards(e.target.value.replace(/\D/g, ""))}
        inputMode="numeric"
        pattern="[0-9]*"
      />
    </div>
  )}
</div>


            {/* ملاحظات عدد الحراس */}
            <div className="mb-4">
              <label className="block mb-2 font-medium">
                {language === "ar" ? "ملاحظات عدد الحراس" : "Notes on Guard Count"}
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2"
                rows={2}
                value={guardCountNotes}
                onChange={(e) => setGuardCountNotes(e.target.value)}
              />
            </div>

            {/* التمكن والملاحظات */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-2 font-medium">
                  {language === "ar" ? "تمكن الحراس في العمل" : "Guard Competency"}
                </label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={guardCompetency}
                  onChange={(e) => setGuardCompetency(e.target.value)}
                >
                  <option value="">{language === "ar" ? "اختر التقييم" : "Select competency"}</option>
                  <option value="متكمن">{language === "ar" ? "متكمن" : "Competent"}</option>
                  <option value="غير متمكن">{language === "ar" ? "غير متمكن" : "Not Competent"}</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 font-medium">
                  {language === "ar" ? "ملاحظات حول التمكن" : "Competency Notes"}
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  rows={2}
                  value={guardCompetencyNotes}
                  onChange={(e) => setGuardCompetencyNotes(e.target.value)}
                />
              </div>
            </div>
          </>
        )}
      </>
    );
  })()}
</section>


        {/* Fire Extinguishers Section */}
        <section className="bg-blue-50 border border-blue-200 text-blue-900 rounded-md shadow p-6 w-full max-w-none px-6 mt-6">
          <h2 className="text-center text-xl font-bold mb-6 flex items-center justify-center gap-2 select-none">
            <span role="img" aria-label="Extinguisher">🧯</span>
            {language === "ar" ? "طفايات الحريق" : "Fire Extinguishers"}
          </h2>

          {(() => {
            const selected =
              subBuildings.find((sb) => sb.id === selectedSubBuildingId) ||
              buildings.find((b) => b.id === selectedBuildingId);
            const expectedExtinguishers = selected?.extinguishers_count ?? "";

            const isBlocked =
              (subBuildings.length > 0 && !selectedSubBuildingId) ||
              !selectedBuildingId ||
              !selectedSectorId;

            return (
              <>
                {isBlocked && (
                  <div className="text-red-600 font-semibold mb-4">
                    {language === "ar"
                      ? "الرجاء اختيار المبنى أولاً لإكمال بيانات طفايات الحريق"
                      : "Please select the building first to complete the extinguisher information."}
                  </div>
                )}

                {!isBlocked && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Expected Extinguishers */}
                      <div>
                        <label className="block mb-2 font-medium">
                          {language === "ar" ? "عدد الطفايات المفترض" : "Expected Extinguishers"}
                        </label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
                          value={expectedExtinguishers}
                          readOnly
                        />
                      </div>

                      {/* Actual Extinguishers */}
                      <div>
                        <label className="block mb-2 font-medium">
                          {language === "ar" ? "عدد الطفايات الموجود" : "Present Extinguishers"}
                        </label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded px-3 py-2"
                          value={actualExtinguishers}
                          onChange={(e) => setActualExtinguishers(e.target.value.replace(/\D/g, ""))}
                          inputMode="numeric"
                          pattern="[0-9]*"
                        />
                      </div>
                    </div>

                    {/* Notes on Extinguishers Count */}
                    <div className="mb-4">
                      <label className="block mb-2 font-medium">
                        {language === "ar" ? "ملاحظات عدد الطفايات" : "Extinguisher Count Notes"}
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        rows={2}
                        value={extinguisherNotes}
                        onChange={(e) => setExtinguisherNotes(e.target.value)}
                      />
                    </div>

                    {/* Validity and Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Validity Status */}
                      <div>
                        <label className="block mb-2 font-medium">
                          {language === "ar" ? "صلاحية الطفايات" : "Extinguisher Validity"}
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded px-3 py-2"
                          value={extinguisherValidity}
                          onChange={(e) => setExtinguisherValidity(e.target.value)}
                        >
                          <option value="">{language === "ar" ? "اختر الحالة" : "Select validity"}</option>
                          <option value="صالحة">{language === "ar" ? "صالحة" : "Valid"}</option>
                          <option value="منتهية الصلاحية">{language === "ar" ? "منتهية الصلاحية" : "Expired"}</option>
                        </select>
                      </div>

                      {/* Notes on Validity */}
                      <div>
                        <label className="block mb-2 font-medium">
                          {language === "ar" ? "ملاحظات الصلاحية" : "Validity Notes"}
                        </label>
                        <textarea
                          className="w-full border border-gray-300 rounded px-3 py-2"
                          rows={2}
                          value={extinguisherValidityNotes}
                          onChange={(e) => setExtinguisherValidityNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </section>

        {/* First Aid Boxes Section */}
        <section className="bg-blue-50 border border-blue-200 text-blue-900 rounded-md shadow p-6 w-full max-w-none px-6 mt-6">
          <h2 className="text-center text-xl font-bold mb-6 flex items-center justify-center gap-2 select-none">
            <span role="img" aria-label="First Aid">🩺</span>
            {language === "ar" ? "صناديق الإسعافات الأولية" : "First Aid Boxes"}
          </h2>

          {(() => {
            const selected =
              subBuildings.find((sb) => sb.id === selectedSubBuildingId) ||
              buildings.find((b) => b.id === selectedBuildingId);
            const expectedBoxes = selected?.first_aid_boxes_count ?? "";

            const isBlocked =
              (subBuildings.length > 0 && !selectedSubBuildingId) ||
              !selectedBuildingId ||
              !selectedSectorId;

            return (
              <>
                {isBlocked && (
                  <div className="text-red-600 font-semibold mb-4">
                    {language === "ar"
                      ? "الرجاء اختيار المبنى أولاً لإكمال بيانات صناديق الإسعافات الأولية"
                      : "Please select the building first to complete the first aid box information."}
                  </div>
                )}

                {!isBlocked && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Expected Boxes */}
                      <div>
                        <label className="block mb-2 font-medium">
                          {language === "ar" ? "عدد الصناديق المفترض" : "Expected Boxes"}
                        </label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
                          value={expectedBoxes}
                          readOnly
                        />
                      </div>

                      {/* Actual Boxes */}
                      <div>
                        <label className="block mb-2 font-medium">
                          {language === "ar" ? "عدد الصناديق الموجود" : "Present Boxes"}
                        </label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded px-3 py-2"
                          value={actualFirstAidBoxes}
                          onChange={(e) =>
                            setActualFirstAidBoxes(e.target.value.replace(/\D/g, ""))
                          }
                          inputMode="numeric"
                          pattern="[0-9]*"
                        />
                      </div>
                    </div>

                    {/* Notes on Count */}
                    <div className="mb-4">
                      <label className="block mb-2 font-medium">
                        {language === "ar" ? "ملاحظات عدد الصناديق" : "Box Count Notes"}
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        rows={2}
                        value={firstAidBoxNotes}
                        onChange={(e) => setFirstAidBoxNotes(e.target.value)}
                      />
                    </div>

                    {/* Quantity Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block mb-2 font-medium">
                          {language === "ar" ? "كميات محتويات الصناديق" : "Box Quantity Status"}
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded px-3 py-2"
                          value={firstAidBoxQuantityStatus}
                          onChange={(e) => setFirstAidBoxQuantityStatus(e.target.value)}
                        >
                          <option value="">{language === "ar" ? "اختر الحالة" : "Select status"}</option>
                          <option value="مكتملة">{language === "ar" ? "مكتملة" : "Complete"}</option>
                          <option value="نقصان">{language === "ar" ? "نقصان" : "Shortage"}</option>
                          <option value="زيادة">{language === "ar" ? "زيادة" : "Surplus"}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block mb-2 font-medium">
                          {language === "ar" ? "ملاحظات الكمية" : "Quantity Notes"}
                        </label>
                        <textarea
                          className="w-full border border-gray-300 rounded px-3 py-2"
                          rows={2}
                          value={firstAidBoxQuantityNotes}
                          onChange={(e) => setFirstAidBoxQuantityNotes(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Validity */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block mb-2 font-medium">
                          {language === "ar" ? "صلاحية محتويات الصناديق" : "Contents Validity"}
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded px-3 py-2"
                          value={firstAidBoxValidity}
                          onChange={(e) => setFirstAidBoxValidity(e.target.value)}
                        >
                          <option value="">{language === "ar" ? "اختر الحالة" : "Select validity"}</option>
                          <option value="صالحة">{language === "ar" ? "صالحة" : "Valid"}</option>
                          <option value="منتهية الصلاحية">{language === "ar" ? "منتهية الصلاحية" : "Expired"}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block mb-2 font-medium">
                          {language === "ar" ? "ملاحظات الصلاحية" : "Validity Notes"}
                        </label>
                        <textarea
                          className="w-full border border-gray-300 rounded px-3 py-2"
                          rows={2}
                          value={firstAidBoxValidityNotes}
                          onChange={(e) => setFirstAidBoxValidityNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </section>








<section className="bg-blue-50 border border-blue-200 text-blue-900 rounded-md shadow p-6 w-full max-w-none px-6 mt-6">
  <h2 className="text-center text-xl font-bold mb-6 flex items-center justify-center gap-2 select-none">
    <span role="img" aria-label="Danger">⚠️</span>
    {language === "ar" ? `المخاطر` : "Risks"}
  </h2>

  {/* زر خطر جديد */}
  {!showRiskForm && (
    <div className="text-center mb-4">
      <button
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
        onClick={() => {
          setShowRiskForm(true);
          cancelEdit();
        }}
      >
        {language === "ar" ? "خطر جديد" : "New Risk"}
      </button>
    </div>
  )}

  {/* نموذج إدخال بيانات الخطر */}
  {showRiskForm && (
    <div className={`p-4 rounded-md mb-6 border ${
      editingRiskId ? "border-yellow-500 bg-yellow-50" : "border-gray-500 bg-white"
    }`}>
      {editingRiskId && (
        <div className="mb-3 flex justify-between items-center bg-yellow-200 border border-yellow-400 rounded p-2 text-yellow-900 font-semibold select-none">
          <span>
            {language === "ar"
              ? `تقوم الآن بتعديل الخطر رقم ${temporaryRisks.findIndex(r => r.id === editingRiskId) + 1}`
              : `Editing Risk #${temporaryRisks.findIndex(r => r.id === editingRiskId) + 1}`}
          </span>
          <button
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
            onClick={() => {
              cancelEdit();
              setShowRiskForm(false);
            }}
            type="button"
          >
            {language === "ar" ? "إلغاء" : "Cancel"}
          </button>
        </div>
      )}

      {/* إدخال بيانات الخطر */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block mb-2 font-medium">
            {language === "ar" ? "مجموعة الخطر" : "Risk Group"}
            <span className="text-red-600 mx-1">*</span>
          </label>
          <select
            ref={riskGroupRef}
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={riskGroup}
            onChange={(e) => setRiskGroup(e.target.value)}
            required
          >
            <option value="">{language === "ar" ? "اختر المجموعة" : "Select group"}</option>
            <option value="electrical">{riskGroups.electrical[language]}</option>
            <option value="civil">{riskGroups.civil[language]}</option>
            <option value="obstacles">{riskGroups.obstacles[language]}</option>
          </select>
        </div>

        {/* درجة الخطورة */}
        <div>
          <label className="block mb-2 font-medium">
            {language === "ar" ? "درجة الخطورة" : "Risk Level"}
            <span className="text-red-600 mx-1">*</span>
          </label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value)}
            required
          >
            <option value="">{language === "ar" ? "اختر الدرجة" : "Select level"}</option>
            <option value="high">{riskLevels.high[language]}</option>
            <option value="medium">{riskLevels.medium[language]}</option>
            <option value="low">{riskLevels.low[language]}</option>
          </select>
        </div>
      </div>

      {/* الوصف والموقع */}
      <div className="mb-4">
        <label className="block mb-2 font-medium">
          {language === "ar" ? "وصف الخطر" : "Risk Description"}
          <span className="text-red-600 mx-1">*</span>
        </label>
        <textarea
          className="w-full border border-gray-300 rounded px-3 py-2"
          rows={2}
          value={riskDescription}
          onChange={(e) => setRiskDescription(e.target.value)}
          required
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium">
          {language === "ar" ? "وصف مكان الخطر" : "Risk Location"}
          <span className="text-red-600 mx-1">*</span>
        </label>
        <textarea
          className="w-full border border-gray-300 rounded px-3 py-2"
          rows={2}
          value={riskLocation}
          onChange={(e) => setRiskLocation(e.target.value)}
          required
        />
      </div>

      {/* الملاحظات */}
      <div className="mb-4">
        <label className="block mb-2 font-medium">
          {language === "ar" ? "ملاحظات" : "Notes"}
        </label>
        <textarea
          className="w-full border border-gray-300 rounded px-3 py-2"
          rows={2}
          value={riskNotes}
          onChange={(e) => setRiskNotes(e.target.value)}
        />
      </div>

      {/* رفع الملفات */}
      <div className="mb-4">
        <label className="block mb-2 font-medium">
          {language === "ar" ? "الصور والفيديوهات" : "Photos & Videos"}
        </label>
        <div className="flex gap-4 items-center flex-wrap">
          {/* أزرار رفع الملفات كما هي */}
          <label className="cursor-pointer bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded shadow text-sm">
            📁 {language === "ar" ? "رفع من الجهاز" : "Upload from device"}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>
          <label className="cursor-pointer bg-blue-200 hover:bg-blue-300 text-blue-900 px-4 py-2 rounded shadow text-sm">
            📷 {language === "ar" ? "الكاميرا" : "Camera"}
            <input
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>

          {/* زر حذف جميع الملفات */}
          {riskFiles.length > 0 && (
            <button
              type="button"
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition text-sm"
              onClick={() => {
                if (window.confirm(language === "ar" ? "هل أنت متأكد من حذف جميع الملفات؟" : "Are you sure you want to delete all files?")) {
                  setRiskFiles([]);
                }
              }}
            >
              {language === "ar" ? "حذف جميع الملفات" : "Delete All Files"}
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {riskFiles.map((file, index) => (
            <div key={index} className="relative border border-gray-300 rounded overflow-hidden p-2">
              {file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt="risk media"
                  className="w-full h-24 object-cover rounded cursor-pointer"
                  onClick={() => window.open(URL.createObjectURL(file), "_blank")}
                />
              ) : (
                <video
                  src={URL.createObjectURL(file)}
                  controls
                  className="w-full h-24 rounded"
                />
              )}
              <button
                onClick={() => handleRemoveFile(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* أزرار الحفظ والإلغاء */}
      <div className="text-center flex justify-center gap-4 mt-4 flex-row-reverse">
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          onClick={() => {
            const saved = handleAddRiskTemporarily();
            if (saved) {
              setShowRiskForm(false);
            }
          }}
          type="button"
        >
          {editingRiskId
            ? language === "ar" ? "تحديث الخطر" : "Update Risk"
            : language === "ar" ? "حفظ الخطر" : "Save Risk"}
        </button>
        <button
          className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition"
          onClick={() => {
            cancelEdit();
            setShowRiskForm(false);
          }}
          type="button"
        >
          {language === "ar" ? "إلغاء" : "Cancel"}
        </button>
      </div>

    </div>
  )}

  {/* قائمة المخاطر */}
  <div className="mt-10">
    <h3 className="text-lg font-bold mb-3">
      🗂️ {language === "ar" ? "محفوظات المخاطر" : "Saved Risks"} ({temporaryRisks.length})
    </h3>
    {temporaryRisks.length === 0 ? (
      <p className="text-gray-500">
        {language === "ar" ? "لا توجد مخاطر محفوظة" : "No risks saved yet."}
      </p>
    ) : (
      <div className="space-y-4">
        {temporaryRisks.map((risk, index) => {
          const isEditing = editingRiskId === risk.id;
          const borderColor =
            risk.level === "عالي" || risk.level === "High"
              ? "border-red-500"
              : risk.level === "متوسط" || risk.level === "Medium"
              ? "border-yellow-500"
              : "border-green-500";

          return (
            <div
              key={risk.id}
              className={`border-l-4 ${borderColor} bg-white shadow rounded p-4 relative ${
                isEditing ? "bg-yellow-100 border-yellow-500" : ""
              }`}
            >
              {isEditing && (
                <div className="absolute top-2 right-2 bg-yellow-300 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded select-none">
                  {language === "ar" ? "قيد التعديل" : "Editing"}
                </div>
              )}
              <div className="flex justify-between items-center mb-2">
                <div className="font-bold">
                  #{index + 1} - {riskGroups[risk.group as RiskGroupKey]?.[language] || risk.group}
                </div>
                <div className={`text-sm ${getRiskLevelColor(risk.level)}`}>
                  {language === "ar" ? "خطر " : "Risk "}
                  {riskLevels[risk.level as RiskLevelKey]?.[language] || risk.level}
                </div>
              </div>
              <p className="mb-1"><strong>{language === "ar" ? "الوصف:" : "Description:"}</strong> {risk.description}</p>
              <p className="mb-1"><strong>{language === "ar" ? "المكان:" : "Location:"}</strong> {risk.location}</p>
              <p className="mb-2"><strong>{language === "ar" ? "ملاحظات:" : "Notes:"}</strong> {risk.notes}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                {risk.files.map((file: File, i: number) => (
                  <div key={i}>
                    {file.type.startsWith("image/") ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt="risk"
                        className="w-full h-24 object-cover rounded cursor-pointer"
                        onClick={() => window.open(URL.createObjectURL(file), "_blank")}
                      />
                    ) : (
                      <video
                        src={URL.createObjectURL(file)}
                        controls
                        className="w-full h-24 rounded"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                {/* الرقم المتسلسل */}
                <span className={language === "ar" ? "order-2" : "order-1"}>
                  #{index + 1}
                </span>

                {/* الأزرار */}
                <div className="flex gap-2">
                  <button
                    className={`text-white px-3 py-1 rounded text-sm transition ${
                      isEditing ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
                    }`}
                    onClick={() => {
                      if (isEditing) {
                        cancelEdit(); // أو cancelMaintenanceEdit حسب القسم
                        setShowRiskForm(false); // أو setShowMaintenanceForm(false)
                      } else {
                        handleEditRisk(risk.id); // أو handleEditMaintenance(item.id)
                        setShowRiskForm(true); // أو setShowMaintenanceForm(true)
                      }
                    }}
                  >
                    {isEditing
                      ? language === "ar" ? "إلغاء التعديل" : "Cancel Edit"
                      : language === "ar" ? "تعديل" : "Edit"}
                  </button>

                  <button
                    className="text-white bg-red-500 px-3 py-1 rounded hover:bg-red-600 text-sm"
                    onClick={() => handleDeleteRisk(risk.id)} // أو handleDeleteMaintenance(item.id)
                  >
                    {language === "ar" ? "حذف" : "Delete"}
                  </button>
                </div>
              </div>


            </div>
          );
        })}
      </div>
    )}
  </div>
</section>













<section className="bg-blue-50 border border-blue-200 text-blue-900 rounded-md shadow p-6 w-full max-w-none px-6 mt-6">
  <h2 className="text-center text-xl font-bold mb-6 flex items-center justify-center gap-2 select-none">
    🛠️ {language === "ar" ? "الصيانة" : "Maintenance"}
  </h2>

  {!showMaintenanceForm && (
    <div className="text-center mb-4">
      <button
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
        onClick={() => {
          setShowMaintenanceForm(true);
          cancelMaintenanceEdit();
        }}
      >
        {language === "ar" ? "صيانة جديدة" : "New Maintenance"}
      </button>
    </div>
  )}

  {showMaintenanceForm && (
    <div className={`p-4 rounded-md mb-6 border ${
      editingMaintenanceId ? "border-yellow-500 bg-yellow-100" : "border-gray-500 bg-white"
    }`}>
      {editingMaintenanceId && (
        <div className="mb-3 flex justify-between items-center bg-yellow-200 border border-yellow-400 rounded p-2 text-yellow-900 font-semibold select-none">
          <span>
            {language === "ar"
              ? `تقوم الآن بتعديل الصيانة رقم ${temporaryMaintenances.findIndex(m => m.id === editingMaintenanceId) + 1}`
              : `Editing Maintenance #${temporaryMaintenances.findIndex(m => m.id === editingMaintenanceId) + 1}`}
          </span>
          <button
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
            onClick={() => {
              cancelMaintenanceEdit();
              setShowMaintenanceForm(false);
            }}
            type="button"
          >
            {language === "ar" ? "إلغاء" : "Cancel"}
          </button>
        </div>
      )}

      {/* النموذج */}      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block mb-2 font-medium">
            {language === "ar" ? "مجموعة الصيانة" : "Maintenance Group"}
            <span className="text-red-600 mx-1">*</span>
          </label>
          <select
            ref={maintenanceGroupRef}
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={maintenanceGroup}
            onChange={(e) => setMaintenanceGroup(e.target.value)}
            required
          >
            <option value="">{language === "ar" ? "اختر المجموعة" : "Select group"}</option>
            <option value="electrical">{maintenanceGroups.electrical[language]}</option>
            <option value="civil">{maintenanceGroups.civil[language]}</option>
            <option value="mechanical">{maintenanceGroups.mechanical[language]}</option>
          </select>
        </div>

        <div>
          <label className="block mb-2 font-medium">
            {language === "ar" ? "درجة الأهمية" : "Importance Level"}
            <span className="text-red-600 mx-1">*</span>
          </label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={maintenanceImportance}
            onChange={(e) => setMaintenanceImportance(e.target.value)}
            required
          >
            <option value="">{language === "ar" ? "اختر الدرجة" : "Select level"}</option>
            <option value="high">{language === "ar" ? "عالية" : "High"}</option>
            <option value="medium">{language === "ar" ? "متوسطة" : "Medium"}</option>
            <option value="low">{language === "ar" ? "ضعيفة" : "Low"}</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium">
          {language === "ar" ? "وصف الصيانة" : "Maintenance Description"}
          <span className="text-red-600 mx-1">*</span>
        </label>
        <textarea
          className="w-full border border-gray-300 rounded px-3 py-2"
          rows={2}
          value={maintenanceDescription}
          onChange={(e) => setMaintenanceDescription(e.target.value)}
          required
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium">
          {language === "ar" ? "مكان الصيانة" : "Maintenance Location"}
          <span className="text-red-600 mx-1">*</span>
        </label>
        <textarea
          className="w-full border border-gray-300 rounded px-3 py-2"
          rows={2}
          value={maintenanceLocation}
          onChange={(e) => setMaintenanceLocation(e.target.value)}
          required
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium">
          {language === "ar" ? "ملاحظات" : "Notes"}
        </label>
        <textarea
          className="w-full border border-gray-300 rounded px-3 py-2"
          rows={2}
          value={maintenanceNotes}
          onChange={(e) => setMaintenanceNotes(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium">
          {language === "ar" ? "الصور والفيديوهات" : "Photos & Videos"}
        </label>
        <div className="flex gap-4 items-center flex-wrap">
          <label className="cursor-pointer bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded shadow text-sm">
            📁 {language === "ar" ? "رفع من الجهاز" : "Upload from device"}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => handleMaintenanceFileUpload(e.target.files)}
            />
          </label>
          <label className="cursor-pointer bg-blue-200 hover:bg-blue-300 text-blue-900 px-4 py-2 rounded shadow text-sm">
            📷 {language === "ar" ? "الكاميرا" : "Camera"}
            <input
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleMaintenanceFileUpload(e.target.files)}
            />
          </label>

          {maintenanceFiles.length > 0 && (
            <button
              type="button"
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition text-sm"
              onClick={() => {
                if (window.confirm(language === "ar" ? "هل أنت متأكد من حذف جميع الملفات؟" : "Delete all files?")) {
                  setMaintenanceFiles([]);
                }
              }}
            >
              {language === "ar" ? "حذف جميع الملفات" : "Delete All Files"}
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {maintenanceFiles.map((file, index) => (
            <div key={index} className="relative border border-gray-300 rounded overflow-hidden p-2">
              {file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt="media"
                  className="w-full h-24 object-cover rounded cursor-pointer"
                  onClick={() => window.open(URL.createObjectURL(file), "_blank")}
                />
              ) : (
                <video
                  src={URL.createObjectURL(file)}
                  controls
                  className="w-full h-24 rounded"
                />
              )}
              <button
                onClick={() => setMaintenanceFiles((prev) => prev.filter((_, i) => i !== index))}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center flex justify-center gap-4 mt-4 flex-row-reverse">
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          onClick={() => {
            const saved = handleAddMaintenanceTemporarily();
            if (saved) setShowMaintenanceForm(false);
          }}
          type="button"
        >
          {editingMaintenanceId
            ? language === "ar" ? "تحديث الصيانة" : "Update"
            : language === "ar" ? "حفظ الصيانة" : "Save"}
        </button>
        <button
          className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition"
          onClick={() => {
            cancelMaintenanceEdit();
            setShowMaintenanceForm(false);
          }}
          type="button"
        >
          {language === "ar" ? "إلغاء" : "Cancel"}
        </button>
      </div>
    </div>
  )}

  {/* عرض الصيانات */}  
  <div className="mt-10">
    <h3 className="text-lg font-bold mb-3">
      🗂️ {language === "ar" ? "محفوظات الصيانة" : "Saved Maintenances"} ({temporaryMaintenances.length})
    </h3>
    {temporaryMaintenances.length === 0 ? (
      <p className="text-gray-500">
        {language === "ar" ? "لا توجد صيانات محفوظة" : "No maintenances saved yet."}
      </p>
    ) : (
      <div className="space-y-4">
        {temporaryMaintenances.map((item, index) => {
          const isEditing = editingMaintenanceId === item.id;
          const borderColor =
            item.level === "عالية" || item.level === "High"
              ? "border-red-500"
              : item.level === "متوسطة" || item.level === "Medium"
              ? "border-yellow-500"
              : "border-green-500";

          return (
            <div
              key={item.id}
              className={`border-l-4 ${borderColor} bg-white shadow rounded p-4 relative ${
                isEditing ? "bg-yellow-100 border-yellow-500" : ""
              }`}
            >
              {isEditing && (
                <div className="absolute top-2 right-2 bg-yellow-300 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded select-none">
                  {language === "ar" ? "قيد التعديل" : "Editing"}
                </div>
              )}
              <div className="flex justify-between items-center mb-2">
                {/* رقم الصيانة + اسم المجموعة */}
                <div className="font-bold">
                  #{index + 1} - {maintenanceGroups[item.group as MaintenanceGroupKey]?.[language] || item.group}
                </div>

                {/* درجة الأهمية */}
                <div className={`text-sm ${getImportanceColor(item.level)}`}>
                  {language === "ar" ? "أهمية " : "Importance "}
                  {importanceLevels[item.level as ImportanceLevelKey]?.[language] || item.level}
                </div>
              </div>
              <p className="mb-1"><strong>{language === "ar" ? "الوصف:" : "Description:"}</strong> {item.description}</p>
              <p className="mb-1"><strong>{language === "ar" ? "المكان:" : "Location:"}</strong> {item.location}</p>
              <p className="mb-2"><strong>{language === "ar" ? "ملاحظات:" : "Notes:"}</strong> {item.notes}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                {item.files.map((file: File, i: number) => (
                  <div key={i}>
                    {file.type.startsWith("image/") ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt="file"
                        className="w-full h-24 object-cover rounded cursor-pointer"
                        onClick={() => window.open(URL.createObjectURL(file), "_blank")}
                      />
                    ) : (
                      <video
                        src={URL.createObjectURL(file)}
                        controls
                        className="w-full h-24 rounded"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                {/* الرقم المتسلسل */}
                <span className={language === "ar" ? "order-2" : "order-1"}>
                  #{index + 1}
                </span>

                {/* الأزرار */}
                <div className="flex gap-2">
                  <button
                    className={`text-white px-3 py-1 rounded text-sm transition ${
                      isEditing ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
                    }`}
                    onClick={() => {
                      if (isEditing) {
                        cancelMaintenanceEdit(); // أو cancelMaintenanceEdit حسب القسم
                        setShowMaintenanceForm(false); // أو setShowMaintenanceForm(false)
                      } else {
                        handleEditMaintenance(item.id); // أو handleEditMaintenance(item.id)
                        setShowMaintenanceForm(true); // أو setShowMaintenanceForm(true)
                      }
                    }}
                  >
                    {isEditing
                      ? language === "ar" ? "إلغاء التعديل" : "Cancel Edit"
                      : language === "ar" ? "تعديل" : "Edit"}
                  </button>

                  <button
                    className="text-white bg-red-500 px-3 py-1 rounded hover:bg-red-600 text-sm"
                    onClick={() => handleDeleteMaintenance(item.id)} // أو handleDeleteMaintenance(item.id)
                  >
                    {language === "ar" ? "حذف" : "Delete"}
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    )}
  </div>
</section>


        {/* زر حفظ التفتيش */}
        <div className="flex justify-center mt-8">
          <button
            onClick={() => {
              console.log("🔍 سيتم تنفيذ حفظ التفتيش هنا لاحقًا");
              // TODO: implement inspection save logic
            }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all"
          >
            {language === "ar" ? "حفظ التفتيش" : "Save Inspection"}
          </button>
        </div>



      </main>
    </div>
  );
};

export default InspectionNew;