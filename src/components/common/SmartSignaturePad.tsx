// src/components/common/SmartSignaturePad.tsx
import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser, PenLine, RotateCcw, Save } from 'lucide-react';
import { trimCanvas } from '../../lib/imageUtils';

interface SmartSignaturePadProps {
    onSave: (base64Image: string) => void;
    onCancel?: () => void;
    initialUrl?: string | null;
    isProcessing?: boolean;
    labels?: {
        clear: string;
        save: string;
        title?: string;
    };
}

export const SmartSignaturePad: React.FC<SmartSignaturePadProps> = ({
    onSave,
    initialUrl,
    isProcessing = false,
    labels = { clear: 'مسح', save: 'اعتماد التوقيع', title: 'لوحة التوقيع' }
}) => {
    const sigPadRef = useRef<SignatureCanvas>(null);
    const containerRef = useRef<HTMLDivElement>(null); // مرجع للحاوية لضبط الحجم
    const [isEmpty, setIsEmpty] = useState(true);

    // إعدادات القلم (تم تحديثها لتناسب الدقة العالية)
    const padOptions = {
        penColor: '#000080', // اللون الأزرق الرسمي
        backgroundColor: 'rgba(255,255,255,0)',
        minWidth: 0.5, // قللنا العرض قليلاً لأن الدقة زادت (لتجنب السماكة الزائدة)
        maxWidth: 2.5,
        velocityFilterWeight: 0.7,
        throttle: 16, 
    };

    // ✨ هذا هو سر الدقة العالية
    // هذه الدالة تقوم بمضاعفة أبعاد الـ Canvas الداخلية لتناسب شاشات الريتنا
    const prepareCanvas = () => {
        const canvas = sigPadRef.current?.getCanvas();
        const container = containerRef.current;
        
        if (canvas && container) {
            // الحصول على نسبة البكسل للشاشة (عادة 2 أو 3 في الهواتف الحديثة)
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            
            // ضبط العرض والارتفاع الداخلي بناءً على النسبة
            canvas.width = container.offsetWidth * ratio;
            canvas.height = container.offsetHeight * ratio;
            
            // ضبط السياق للرسم بالنسبة الجديدة
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.scale(ratio, ratio);
            
            // إعادة تعيين الحالة
            setIsEmpty(true);
        }
    };

    // تشغيل إعداد الدقة عند تحميل الصفحة أو تغيير حجم النافذة
    useEffect(() => {
        prepareCanvas();
        window.addEventListener("resize", prepareCanvas);
        return () => window.removeEventListener("resize", prepareCanvas);
    }, []);

    const handleClear = () => {
        sigPadRef.current?.clear();
        setIsEmpty(true);
    };

    const handleSave = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            // دالة القص ستعمل الآن على الصورة عالية الدقة تلقائياً
            const originalCanvas = sigPadRef.current.getCanvas();
            const trimmedDataUrl = trimCanvas(originalCanvas);
            onSave(trimmedDataUrl);
        }
    };

    const handleEndStroke = () => {
        if (sigPadRef.current) {
            setIsEmpty(sigPadRef.current.isEmpty());
        }
    };

    return (
        <div className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between text-gray-400 text-sm">
                <div className="flex items-center gap-2">
                    <PenLine size={16} className="text-[#FFD700]" />
                    <span>{labels.title}</span>
                </div>
                {initialUrl && (
                    <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-500">
                        يوجد توقيع محفوظ مسبقًا
                    </span>
                )}
            </div>

            {/* ربطنا المرجع containerRef هنا */}
            <div ref={containerRef} className="relative w-full h-48 bg-white rounded-xl overflow-hidden border-2 border-dashed border-gray-600 hover:border-[#FFD700] transition-colors shadow-inner cursor-crosshair group">
                <div className="absolute inset-0 pointer-events-none opacity-10" 
                     style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                </div>

                <SignatureCanvas
                    ref={sigPadRef}
                    {...padOptions}
                    canvasProps={{ 
                        // الأبعاد هنا ستُستبدل برمجياً، ولكن نضعها كاحتياط
                        className: 'w-full h-full' 
                    }}
                    onEnd={handleEndStroke}
                />
                
                {isEmpty && !initialUrl && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400/30 font-bold text-2xl select-none">
                        وقع هنا
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleClear}
                    disabled={isProcessing || isEmpty}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                    <RotateCcw size={18} />
                    {labels.clear}
                </button>

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isProcessing || isEmpty}
                    className="flex-[2] py-2.5 px-4 rounded-lg bg-[#FFD700] text-black hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg shadow-yellow-500/10"
                >
                    {isProcessing ? (
                        <span className="animate-pulse">جاري المعالجة...</span>
                    ) : (
                        <>
                            <Save size={18} />
                            {labels.save}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};