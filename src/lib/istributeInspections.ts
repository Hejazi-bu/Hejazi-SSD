// lib/distributeInspections.ts
import { supabase } from "./supabaseClient";

const getTomorrowDate = (): string => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return t.toISOString().split("T")[0];
};

export const distributeInspectionsAutomatically = async () => {
  const inspectionDate = getTomorrowDate();

  // 1. جلب المفتشين المتاحين
  const { data: inspectors, error: inspectorsError } = await supabase
    .from("Inspectors")
    .select("id")
    .eq("status", "active");

  if (inspectorsError || !inspectors || inspectors.length === 0) {
    console.error("❌ لا يوجد مفتشون متاحون.");
    return;
  }

  // 2. جلب المباني
  const { data: buildings, error: buildingsError } = await supabase
    .from("Buildings")
    .select("id, sector_id");

  if (buildingsError || !buildings) {
    console.error("❌ فشل تحميل المباني");
    return;
  }

  // 3. جلب المباني الفرعية
  const { data: subBuildings, error: subBuildingsError } = await supabase
    .from("SubBuildings")
    .select("id, building_id");

  if (subBuildingsError || !subBuildings) {
    console.error("❌ فشل تحميل المباني الفرعية");
    return;
  }

  // 4. تكوين المهام
  let tasks = [];

  if (subBuildings.length > 0) {
    for (const sub of subBuildings) {
      const building = buildings.find((b) => b.id === sub.building_id);
      if (building) {
        tasks.push({
          sector_id: building.sector_id,
          building_id: building.id,
          sub_building_id: sub.id,
        });
      }
    }
  } else {
    for (const b of buildings) {
      tasks.push({
        sector_id: b.sector_id,
        building_id: b.id,
        sub_building_id: null,
      });
    }
  }

  if (tasks.length === 0) {
    console.warn("⚠️ لا توجد مهام للتوزيع");
    return;
  }

  // 5. التوزيع بالتساوي
  const distributedTasks = tasks.map((task, i) => ({
    ...task,
    inspector_id: inspectors[i % inspectors.length].id,
    inspection_date: inspectionDate,
  }));

  // 6. حفظ في جدول InspectionsSchedule
  for (const task of distributedTasks) {
    await supabase.from("InspectionsSchedule").insert(task);
  }

  console.log("✅ تم توزيع المهام على المفتشين بنجاح");
};
