// C:\Users\user\Music\hejazi-logic\src\components\Users\MyProfile.tsx
// (أو أي مكان تضع فيه صفحاتك)

import React from 'react';
// ✨ 1. استيراد المكون الموحد
import { UserProfileContent } from './../layouts/UserProfileContent';

// ✨ 2. استيراد أي مكونات أخرى تحتاجها للصفحة (مثل الهيدر الرئيسي)
// import { MainLayout } from '../components/layouts/MainLayout';
// import { PageHeader } from '../components/common/PageHeader';

export const MyProfilePage: React.FC = () => {
    return (
        // <MainLayout>  // ✨ 3. ربما يكون لديك غلاف للصفحة
        //     <PageHeader title="ملفي الشخصي" /> 

            <div className="container mx-auto p-4"> 
                {/* ✨ 4. عرض المحتوى الموحد وتحديد أنه ليس نافذة منبثقة */}
                <UserProfileContent isOverlay={false} />
            </div>

        // </MainLayout>
    );
};

export default MyProfilePage;