// دالة تنظيف النص من المسافات الزائدة
export const cleanText = (text: string | undefined | null): string => {
  if (!text) return "";
  return text.trim().replace(/\s+/g, " ");
};

// دالة توحيد النص (للبحث الذكي) - تم نقلها من الملف السابق
export const normalizeText = (text: string = ""): string => {
  if (!text) return "";

  return text
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[يئى]/g, "ى")
    .replace(/[ؤ]/g, "و")
    .replace(/[ة]/g, "ه")
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06DC\u0670\u0640]/g, "") // تشكيل
    .replace(/[\s_.-]+/g, "") // إزالة الرموز والمسافات
    .trim();
};

/**
 * واجهة نتيجة البحث
 */
interface MatchResult<T> {
  exactMatch?: T;
  fuzzyMatch?: T;
}

/**
 * دالة عامة للبحث عن العناصر المكررة أو المتشابهة
 * @param items القائمة التي يتم البحث فيها
 * @param searchText النص المراد البحث عنه
 * @param nameField اسم الحقل الذي يحتوي على النص (مثلاً 'name' أو 'name_ar')
 * @param excludeId (اختياري) معرف العنصر الذي يجب استثناؤه (في حالة التعديل)
 */
export const findItemMatches = <T extends { id: string }>(
  items: T[],
  searchText: string,
  nameField: keyof T = "name" as keyof T,
  excludeId?: string
): MatchResult<T> => {
  const normalizedSearch = normalizeText(searchText);
  
  // تهيئة النتيجة
  const result: MatchResult<T> = {};

  if (!normalizedSearch) return result;

  for (const item of items) {
    // تخطي العنصر نفسه في حالة التعديل
    if (excludeId && item.id === excludeId) continue;

    const itemValue = String(item[nameField] || "");
    const normalizedItemName = normalizeText(itemValue);

    // 1. فحص التطابق التام (Exact Match)
    if (normalizedItemName === normalizedSearch) {
      result.exactMatch = item;
      // إذا وجدنا تطابقاً تاماً، نتوقف فوراً لأن هذا هو الأهم
      break; 
    }

    // 2. فحص التشابه (Fuzzy Match) - يتم تسجيله فقط إذا لم نجد تطابقاً تاماً بعد
    // نبحث عما إذا كان الاسم الجديد جزءاً من القديم أو العكس
    if (!result.fuzzyMatch) {
      if (normalizedItemName.includes(normalizedSearch) || normalizedSearch.includes(normalizedItemName)) {
        result.fuzzyMatch = item;
      }
    }
  }

  return result;
};

/**
 * دالة تجلب رابط صورة العلم بناءً على الكود
 * نستخدم خدمة flagcdn لأنها سريعة ومجانية وتدعم كل الأكواد
 */
export const getCountryFlagUrl = (countryCode: string | undefined): string | null => {
  if (!countryCode) return null;
  // تحويل الكود لحروف صغيرة لأن الرابط يتطلب ذلك (مثال: AE -> ae)
  const code = countryCode.toLowerCase();
  return `https://flagcdn.com/w40/${code}.png`;
};