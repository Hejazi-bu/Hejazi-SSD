import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "./components/contexts/UserContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from './pages/LoginPage';
import HomePage from "./components/HomePage";
import LoadingScreen from "./components/LoadingScreen";
import SubServicesPage from "./components/home/SubServicesPage";
import AppLockedScreen from "./components/AppLockedScreen";
import SubServicePageRenderer from "./pages/SubServicePageRenderer";
import { usePageLoading } from "./components/contexts/LoadingContext"; 
import ActionLoadingOverlay from "./components/ActionLoadingOverlay";
import { NavigationBlocker } from "./components/NavigationBlocker";
// استيراد الصفحات الأخرى
import EvaluationDetails from "./components/GuardsRating/EvaluationDetails";
import EditEvaluation from "./components/GuardsRating/EditEvaluation";
import { useServices } from "./components/contexts/ServicesContext";
import UserRequestDetails from "./components/Users/UserRequestDetails";
// ✅ 1. استيراد صفحة التعديل الجديدة
import EditUserRequest from "./components/Users/EditUserRequest"; 

import HandleAuthAction from "./pages/HandleAuthAction";
import SetPasswordPage from "./pages/SetPasswordPage";

function App() {
    const auth = useAuth();
    const page = usePageLoading();
    const services = useServices();
    const location = useLocation();
    
    const showLoadingScreen = auth.isLoading || (auth.user && services.isLoading) || page.isPageLoading;

    return (
        <>
            <ActionLoadingOverlay /> 
            <NavigationBlocker />
            <AnimatePresence mode="wait">
                {showLoadingScreen ? (
                    <LoadingScreen key="loading-screen" />
                ) : (
                    <Routes location={location} key={location.pathname}>
                        
                        <Route path="/__/auth/action" element={<HandleAuthAction />} />
                        <Route path="/set-password" element={<SetPasswordPage />} />

                        {auth.user ? (
                            auth.lockState !== 'NONE' ? (
                                <Route path="*" element={<AppLockedScreen reason={auth.lockState} />} />
                            ) : (
                                <>
                                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                    
                                    <Route path="/dashboard" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                                    
                                    <Route path="/:groupPage/:servicePage" element={<ProtectedRoute><SubServicesPage /></ProtectedRoute>} />
                                    
                                    {/* المسارات ذات الصلاحيات الثابتة */}
                                    <Route path="/companies/evaluation/details/:evaluationSequenceNumber" element={<ProtectedRoute permissionKey="sss:4"><EvaluationDetails /></ProtectedRoute>} />
                                    <Route path="/companies/evaluation/edit/:evaluationSequenceNumber" element={<ProtectedRoute permissionKey="sss:3"><EditEvaluation /></ProtectedRoute>} />
                                    
                                    <Route path="/system/users/details/:requestId" element={<ProtectedRoute><UserRequestDetails /></ProtectedRoute>} />
                                    
                                    {/* ✅ 2. تم إضافة المسار هنا */}
                                    <Route path="/system/users/edit/:requestId" element={<ProtectedRoute permissionKey="sss:13"><EditUserRequest /></ProtectedRoute>} />

                                    {/* المسار الديناميكي الرئيسي */}
                                    <Route 
                                        path="/:groupPage/:servicePage/:subServicePage" 
                                        element={
                                            <ProtectedRoute dynamic level="ss">
                                                <SubServicePageRenderer />
                                            </ProtectedRoute>
                                        } 
                                    />
                                    
                                    <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                                </>
                            )
                        ) : (
                            <>
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="*" element={<Navigate to="/login" replace />} />
                            </>
                        )}
                    </Routes>
                )}
            </AnimatePresence>
        </>
    );
}

export default App;