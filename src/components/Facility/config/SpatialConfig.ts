import { 
    MapPinIcon, BuildingOfficeIcon, BuildingStorefrontIcon, 
    HomeIcon, HashtagIcon, TagIcon, RectangleStackIcon, 
    ArrowRightOnRectangleIcon, GlobeAmericasIcon, MapIcon
} from "@heroicons/react/24/outline";

export type SpatialTarget = 'country' | 'emirate' | 'region' | 'city' | 'district' | 'sector' | 'site' | 'building' | 'zone' | 'floor' | 'unit' | 'point';

export interface LevelConfig {
    label_ar: string;
    label_en: string;
    child_target: SpatialTarget | null;
    parent_target: SpatialTarget | null;
    parent_targets?: SpatialTarget[];
    collection: string;
    icon: React.ElementType;
    hasType?: boolean;
    referenceCollection?: string;
    geoInputType?: 'external_global' | 'internal_floor' | 'internal_unit' | 'none';
}

export const SPATIAL_HIERARCHY: Record<SpatialTarget, LevelConfig> = {
    country: { 
        label_ar: "البلدان", label_en: "Countries", 
        child_target: "emirate", parent_target: null, 
        // ✅ تعديل الاسم ليتوافق مع الباك اند
        collection: "ref_countries", 
        icon: GlobeAmericasIcon,
        geoInputType: 'external_global'
    },
    emirate: { 
        label_ar: "الإمارات", label_en: "Emirates", 
        child_target: "region", parent_target: "country", 
        // ✅ تعديل الاسم
        collection: "ref_emirates", 
        icon: MapIcon,
        geoInputType: 'external_global' 
    },
    region: { 
        label_ar: "المناطق", label_en: "Regions", 
        child_target: "city", parent_target: "emirate", 
        // ✅ تعديل الاسم
        collection: "ref_regions", 
        icon: MapIcon,
        geoInputType: 'external_global' 
    },
    city: { 
        label_ar: "المدن", label_en: "Cities", 
        child_target: "district", parent_target: "region", 
        // ✅ تعديل الاسم
        collection: "ref_cities", 
        icon: MapIcon,
        geoInputType: 'external_global' 
    },
    district: { 
        label_ar: "الأحياء", label_en: "Districts", 
        child_target: "sector", parent_target: "city", 
        // ✅ تعديل الاسم
        collection: "ref_districts", 
        icon: MapIcon,
        geoInputType: 'none' 
    },
    sector: { 
        label_ar: "القطاعات", label_en: "Sectors", 
        child_target: "site", parent_target: "district", 
        // ✅ تعديل الاسم
        collection: "ref_sectors", 
        icon: MapIcon,
        geoInputType: 'none'
    },
    site: { 
        label_ar: "المواقع", label_en: "Sites", 
        child_target: "building", 
        parent_target: "sector", 
        // ⚠️ المواقع تبقى كما هي sites
        collection: "sites", 
        icon: MapPinIcon,
        hasType: true, // لأننا أضفنا site_types في الباك اند
        geoInputType: 'external_global'
    },
    building: { 
        label_ar: "المباني", label_en: "Buildings", 
        child_target: "zone",
        parent_target: "site", 
        // ⚠️ المباني تبقى كما هي buildings
        collection: "buildings", 
        icon: BuildingOfficeIcon,
        hasType: true,
        geoInputType: 'external_global'
    },
    zone: { 
        label_ar: "المناطق", label_en: "Zones", 
        child_target: "floor",
        parent_target: "building",
        parent_targets: ["building", "site"],
        // ⚠️ المناطق تبقى كما هي zones
        collection: "zones", 
        icon: TagIcon,
        hasType: true, // لأننا أضفنا zone_types في الباك اند
        geoInputType: 'internal_unit'
    },
    floor: { 
        label_ar: "الطوابق", label_en: "Floors", 
        child_target: "unit", 
        parent_target: "zone",
        collection: "floors", 
        icon: RectangleStackIcon,
        geoInputType: 'internal_floor'
    },
    unit: { 
        label_ar: "الوحدات / الغرف", label_en: "Units / Rooms", 
        child_target: "point", 
        parent_target: "floor",
        parent_targets: ["floor", "zone"],
        collection: "units", 
        icon: HomeIcon,
        hasType: true,
        geoInputType: 'internal_unit'
    },
    point: { 
        label_ar: "نقاط الأصول", label_en: "Asset Points", 
        child_target: null, 
        parent_target: "unit", 
        collection: "points", 
        icon: ArrowRightOnRectangleIcon,
        hasType: true,
        geoInputType: 'internal_unit'
    },
};