#!/bin/bash

# ============================================================================
# سكريبت تطبيق إعادة الهيكلة لملف Firebase Functions
# ============================================================================
# الوصف: يقوم بتطبيق التعديلات المطلوبة تلقائياً
# الاستخدام: ./apply_refactoring.sh
# ============================================================================

set -e  # التوقف عند أي خطأ

# الألوان
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# المتغيرات
FUNCTIONS_DIR="/home/user/Hejazi-SSD/functions"
SOURCE_FILE="$FUNCTIONS_DIR/src/index.ts"
BACKUP_FILE="$FUNCTIONS_DIR/src/index.backup.ts"
TEMP_FILE="$FUNCTIONS_DIR/src/index.temp.ts"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}🚀 بدء تطبيق إعادة الهيكلة لـ Firebase Functions${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# 1. التحقق من وجود النسخة الاحتياطية
echo -e "${YELLOW}[1/8]${NC} التحقق من النسخة الاحتياطية..."
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ خطأ: لا توجد نسخة احتياطية. جاري إنشاء واحدة...${NC}"
    cp "$SOURCE_FILE" "$BACKUP_FILE"
    echo -e "${GREEN}✅ تم إنشاء نسخة احتياطية بنجاح${NC}"
else
    echo -e "${GREEN}✅ النسخة الاحتياطية موجودة${NC}"
fi
echo ""

# 2. حساب المواضع المتأثرة
echo -e "${YELLOW}[2/8]${NC} حساب المواضع المتأثرة..."
SECTOR_COUNT=$(grep -c "scope_sector_id\|sector_id" "$SOURCE_FILE" || echo "0")
SECTION_COUNT=$(grep -c "scope_section_id\|section_id" "$SOURCE_FILE" || echo "0")
TOTAL_COUNT=$((SECTOR_COUNT + SECTION_COUNT))
echo -e "   📊 عدد مواضع sector: ${YELLOW}$SECTOR_COUNT${NC}"
echo -e "   📊 عدد مواضع section: ${YELLOW}$SECTION_COUNT${NC}"
echo -e "   📊 الإجمالي: ${YELLOW}$TOTAL_COUNT${NC}"
echo ""

# 3. إنشاء نسخة مؤقتة للعمل عليها
echo -e "${YELLOW}[3/8]${NC} إنشاء نسخة مؤقتة..."
cp "$SOURCE_FILE" "$TEMP_FILE"
echo -e "${GREEN}✅ تم إنشاء النسخة المؤقتة${NC}"
echo ""

# 4. تطبيق التعديلات على الواجهات
echo -e "${YELLOW}[4/8]${NC} تطبيق التعديلات على الواجهات..."

# حذف scope_sector_id من واجهة ScopeDefinition
echo -e "   🔧 تحديث ScopeDefinition..."
sed -i '/scope_sector_id.*:/d' "$TEMP_FILE"

# حذف scope_section_id من واجهة ScopeDefinition
sed -i '/scope_section_id.*:/d' "$TEMP_FILE"

# حذف section_id من واجهة UserData
echo -e "   🔧 تحديث UserData..."
# (سيتم الحذف في الخطوة السابقة)

echo -e "${GREEN}✅ تم تحديث الواجهات${NC}"
echo ""

# 5. تطبيق التعديلات على دالة isScopeMatching
echo -e "${YELLOW}[5/8]${NC} تطبيق التعديلات على isScopeMatching..."
# حذف السطور المتعلقة بـ sector و section من isScopeMatching
sed -i '/if (rule\.scope_sector_id.*userData\.sector_id)/d' "$TEMP_FILE"
sed -i '/if (rule\.scope_section_id.*userData\.section_id)/d' "$TEMP_FILE"
echo -e "${GREEN}✅ تم تحديث isScopeMatching${NC}"
echo ""

# 6. تطبيق التعديلات على validateAuthority
echo -e "${YELLOW}[6/8]${NC} تطبيق التعديلات على validateAuthority..."
# حذف الأسطر المتعلقة بـ section_id من validateAuthority
sed -i '/section_id.*string.*null/d' "$TEMP_FILE"
sed -i '/if (rule\.scope_section_id.*targetEntity\.section_id)/d' "$TEMP_FILE"
echo -e "${GREEN}✅ تم تحديث validateAuthority${NC}"
echo ""

# 7. إحصائيات ما بعد التعديل
echo -e "${YELLOW}[7/8]${NC} التحقق من النتائج..."
NEW_SECTOR_COUNT=$(grep -c "scope_sector_id\|sector_id" "$TEMP_FILE" || echo "0")
NEW_SECTION_COUNT=$(grep -c "scope_section_id\|section_id" "$TEMP_FILE" || echo "0")
NEW_TOTAL_COUNT=$((NEW_SECTOR_COUNT + NEW_SECTION_COUNT))

echo -e "   📊 المواضع المتبقية: ${YELLOW}$NEW_TOTAL_COUNT${NC}"
if [ "$NEW_TOTAL_COUNT" -eq 0 ]; then
    echo -e "   ${GREEN}✅ تم حذف جميع المراجع بنجاح!${NC}"
else
    echo -e "   ${YELLOW}⚠️  لا تزال هناك $NEW_TOTAL_COUNT مواضع تحتاج مراجعة يدوية${NC}"
fi
echo ""

# 8. السؤال عن التطبيق النهائي
echo -e "${YELLOW}[8/8]${NC} هل تريد تطبيق التعديلات؟"
echo -e "   ${BLUE}الخيارات:${NC}"
echo -e "   ${GREEN}1)${NC} نعم، طبّق التعديلات الآن"
echo -e "   ${YELLOW}2)${NC} لا، احتفظ بالنسخة المؤقتة فقط"
echo -e "   ${RED}3)${NC} إلغاء (احذف النسخة المؤقتة)"
echo ""
read -p "اختر (1/2/3): " choice

case $choice in
    1)
        echo -e "${GREEN}✅ جاري تطبيق التعديلات...${NC}"
        mv "$TEMP_FILE" "$SOURCE_FILE"
        echo -e "${GREEN}✅ تم تطبيق التعديلات بنجاح!${NC}"
        echo -e "${BLUE}📝 ملاحظة: النسخة الأصلية محفوظة في: $BACKUP_FILE${NC}"
        ;;
    2)
        echo -e "${YELLOW}⏸️  تم الاحتفاظ بالنسخة المؤقتة في: $TEMP_FILE${NC}"
        echo -e "${BLUE}يمكنك مراجعتها والتطبيق يدوياً${NC}"
        ;;
    3)
        echo -e "${RED}❌ تم إلغاء العملية${NC}"
        rm -f "$TEMP_FILE"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ خيار غير صحيح${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}🎉 انتهت عملية إعادة الهيكلة!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${YELLOW}الخطوات التالية:${NC}"
echo -e "1. راجع التعديلات: ${BLUE}code $SOURCE_FILE${NC}"
echo -e "2. اختبر البناء: ${BLUE}cd $FUNCTIONS_DIR && npm run build${NC}"
echo -e "3. راجع التقرير: ${BLUE}cat $FUNCTIONS_DIR/REFACTORING_REPORT.md${NC}"
echo ""
