import { UAParser } from 'ua-parser-js';

/**
 * واجهة لنوع البيانات التي نجمعها من العميل (المتصفح).
 */
export interface ClientContext {
    device: {
        vendor?: string;
        model?: string;
        type?: string;
    };
    os: {
        name?: string;
        version?: string;
    };
    browser: {
        name?: string;
        version?: string;
    };
    location: {
        latitude: number;
        longitude: number;
        accuracy: number;
    };
}

/**
 * دالة تقوم بجمع معلومات الجهاز والموقع الجغراfi من المتصفح.
 * تقوم برفض Promise (reject) في حال عدم دعم المتصفح للموقع أو رفض المستخدم للإذن.
 * @returns {Promise<ClientContext>} كائن يحتوي على جميع معلومات العميل.
 */
export const getClientContext = (): Promise<ClientContext> => {
    return new Promise((resolve, reject) => {
        // 1. جمع معلومات الجهاز ونظام التشغيل والمتصفح
        // FIX: The constructor is now correctly recognized after fixing the import statement.
        const parser = new UAParser();
        const result = parser.getResult();

        // 2. التحقق من دعم المتصفح لخدمة الموقع
        if (!navigator.geolocation) {
            return reject(new Error("هذا المتصفح لا يدعم خدمة تحديد المواقع."));
        }

        // 3. طلب الموقع من المستخدم
        navigator.geolocation.getCurrentPosition(
            // --- في حالة النجاح ---
            (position) => {
                // حل Promise وإرجاع كل البيانات المجمعة
                resolve({
                    device: result.device,
                    os: result.os,
                    browser: result.browser,
                    location: {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    },
                });
            },
            // --- في حالة الفشل (رفض المستخدم للإذن) ---
            (error) => {
                // رفض Promise مع رسالة خطأ واضحة
                let errorMessage = "حدث خطأ أثناء محاولة الحصول على الموقع.";
                if (error.code === error.PERMISSION_DENIED) {
                    errorMessage = "يجب السماح بالوصول إلى الموقع لإتمام هذا الإجراء.";
                }
                reject(new Error(errorMessage));
            }
        );
    });
};
