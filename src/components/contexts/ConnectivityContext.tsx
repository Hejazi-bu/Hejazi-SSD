import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useMemo,
    useRef,
    useCallback
} from 'react';

// الحالة لا تزال تتضمن checking و poor مؤقتًا أثناء الفحص
type NetworkStatus = 'online' | 'offline' | 'checking' | 'poor';

interface ConnectivityContextProps {
    status: NetworkStatus; // آخر حالة معروفة
    isOnline: boolean;     // هل الحالة الأخيرة كانت online أو poor؟
    isChecking: boolean;   // هل يتم الفحص اليدوي الآن؟
    isPoorConnection: boolean; // هل آخر فحص ناجح كان ضعيفاً؟
    // ✨ دالة جديدة للفحص اليدوي
    checkConnectionNow: () => Promise<boolean>;
}

const ConnectivityContext = createContext<ConnectivityContextProps | undefined>(
    undefined
);

// القيم يمكن تعديلها حسب الحاجة
const PING_RESOURCE = 'https://www.google.com/favicon.ico';
const PING_TIMEOUT = 8000;
const POOR_CONNECTION_THRESHOLD = 4000;

export const ConnectivityProvider = ({ children }: { children: ReactNode }) => {
    // الحالة التي نعرضها للمستخدم، تبدأ بـ checking إذا كان المتصفح online
    const [status, setStatus] = useState<NetworkStatus>(() => navigator.onLine ? 'checking' : 'offline');
    // لتتبع حالة الفحص اليدوي
    const [isCheckingManually, setIsCheckingManually] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // ✨ دالة الفحص اليدوي (تُرجع true للاتصال، false لعدم الاتصال)
    const checkConnectionNow = useCallback(async (): Promise<boolean> => {
        // إذا كان المتصفح يبلغ عن عدم الاتصال، لا داعي للفحص
        if (!navigator.onLine) {
            setStatus('offline');
            return false;
        }

        abortControllerRef.current?.abort(); // إلغاء أي فحص سابق
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        setIsCheckingManually(true); // بدء حالة التحقق
        setStatus('checking');       // تحديث الحالة المرئية
        const startTime = Date.now();
        let isConnected = false;
        let finalStatus: NetworkStatus = 'offline';

        try {
            await fetch(`${PING_RESOURCE}?_=${Date.now()}`, {
                method: 'HEAD', mode: 'no-cors', signal, cache: 'no-store'
            });
            const duration = Date.now() - startTime;
            isConnected = true;
            finalStatus = duration > POOR_CONNECTION_THRESHOLD ? 'poor' : 'online';
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                isConnected = false;
                finalStatus = 'offline';
            } else {
                // إذا تم الإلغاء، نعتبره فشلاً مؤقتًا ونبقي الحالة checking
                isConnected = false; // لا يمكن التأكيد
                finalStatus = 'checking'; // أو ربما offline؟ نعتمد offline لضمان السلامة
                finalStatus = 'offline';
            }
        } finally {
            if (abortControllerRef.current?.signal === signal) {
                 abortControllerRef.current = null;
            }
        }

        // مؤقت المهلة
        const timeoutId = setTimeout(() => {
             if (abortControllerRef.current?.signal === signal) {
                 abortControllerRef.current.abort();
                 isConnected = false;
                 finalStatus = 'offline';
                 setStatus(finalStatus); // تحديث الحالة عند انتهاء المهلة
                 setIsCheckingManually(false);
             }
         }, PING_TIMEOUT);

         // عند الإلغاء أو الاكتمال، قم بتنظيف المؤقت
         const cleanupTimeout = () => clearTimeout(timeoutId);
         signal.addEventListener('abort', cleanupTimeout);

        // تحديث الحالة النهائية بعد اكتمال الفحص (أو المهلة)
        // لا نحدث الحالة هنا إذا تم الإلغاء يدويًا أو بالمهلة لأنها ستحدث داخل catch أو setTimeout
        if (finalStatus === 'online' || finalStatus === 'poor') { // نحدث فقط عند النجاح (online/poor)
            setStatus(finalStatus);
        } else if (!isConnected && status !== 'offline') { // نحدث اذا فشل ولم تكن الحالة offline بالفعل
            setStatus('offline');
        }

        setIsCheckingManually(false); // انتهاء حالة التحقق
        cleanupTimeout(); // تنظيف المؤقت
        return isConnected;

    }, []); // لا توجد اعتماديات

    // useEffect لمراقبة أحداث online/offline الأساسية
    useEffect(() => {
        const handleOnline = () => {
            // عند عودة الشبكة، نضع الحالة checking ونطلب فحصًا واحدًا
            setStatus('checking');
            checkConnectionNow(); // فحص فوري لتأكيد الاتصال الفعلي
        };

        const handleOffline = () => {
            abortControllerRef.current?.abort(); // إلغاء أي فحص جاري
            setStatus('offline'); // تحديث فوري للحالة
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // فحص أولي عند التحميل إذا كان المتصفح online
        if (navigator.onLine) {
            checkConnectionNow();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            abortControllerRef.current?.abort();
        };
    }, [checkConnectionNow]); // يعتمد على دالة الفحص

    // ❌ تم حذف useEffect الخاص بالفحص الدوري

    const value = useMemo(() => ({
        status,
        isOnline: status === 'online' || status === 'poor',
        // isChecking يعكس الآن فقط حالة الفحص اليدوي النشط
        isChecking: isCheckingManually || status === 'checking',
        isPoorConnection: status === 'poor',
        checkConnectionNow, // ✨ توفير الدالة اليدوية
    }), [status, isCheckingManually, checkConnectionNow]);

    return (
        <ConnectivityContext.Provider value={value}>
            {children}
        </ConnectivityContext.Provider>
    );
};

export const useConnectivity = (): ConnectivityContextProps => {
    const context = useContext(ConnectivityContext);
    if (context === undefined) {
        throw new Error('useConnectivity must be used within a ConnectivityProvider');
    }
    return context;
};