// src/lib/imageUtils.ts

/**
 * دالة تقوم باقتصاص المساحات الشفافة المحيطة بالتوقيع
 * لضمان أن الصورة المحفوظة تحتوي على التوقيع فقط وبحجمه الحقيقي.
 */
export const trimCanvas = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL();

    const width = canvas.width;
    const height = canvas.height;
    
    // جلب بيانات البكسلات
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;

    // فحص جميع البكسلات لتحديد حدود الرسم
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // الموقع في المصفوفة (كل بكسل يتكون من 4 قيم: R, G, B, Alpha)
            const offset = (y * width + x) * 4;
            const alpha = data[offset + 3]; // قيمة الشفافية

            // إذا لم يكن البكسل شفافًا تمامًا (يوجد رسم)
            if (alpha > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }

    // إذا كانت اللوحة فارغة
    if (!found) return canvas.toDataURL();

    // إضافة هامش بسيط (Padding) حتى لا يكون القص ملتصقًا بالحواف تمامًا
    const padding = 10;
    const trimWidth = (maxX - minX) + (padding * 2);
    const trimHeight = (maxY - minY) + (padding * 2);

    // إنشاء لوحة مؤقتة بالحجم الجديد
    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimWidth;
    trimmedCanvas.height = trimHeight;
    const trimmedCtx = trimmedCanvas.getContext('2d');

    if (!trimmedCtx) return canvas.toDataURL();

    // رسم الجزء المقصوص في اللوحة الجديدة
    // المصدر: نأخذ من minX/minY
    // الوجهة: نضع في padding/padding
    trimmedCtx.drawImage(
        canvas,
        minX, minY, (maxX - minX), (maxY - minY), // Source
        padding, padding, (maxX - minX), (maxY - minY) // Destination
    );

    return trimmedCanvas.toDataURL('image/png');
};