const express = require('express');
const { initializeApp } = require('firebase/app');
const { 
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    where,
    updateDoc,
    addDoc,
    writeBatch
} = require('firebase/firestore');
const cors = require('cors');

// معلومات التكوين الخاصة بمشروعك
const firebaseConfig = {
    apiKey: "AIzaSyAaP_skZH15nFpkUh4l8xW3JWALQyG0E0Y", // هنا ضع مفتاح API
    authDomain: "hejazi-ssd.firebaseapp.com",
    projectId: "hejazi-ssd",
    storageBucket: "hejazi-ssd.firebasestorage.app",
    messagingSenderId: "880985922577",
    appId: "1:880985922577:web:ec6db20848d692195625b0"
};

const app = express();
const port = 3001;

// تهيئة Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// نقطة نهاية (Endpoint) لجلب بيانات المستخدم والأذونات
// ----------------------------------------------------
app.get('/api/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const user = { id: userDoc.id, ...userDoc.data() };

        const [jobPermsSnapshot, userPermsSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'job_permissions'), where('job_id', '==', user.job_id))),
            getDocs(query(collection(db, 'user_permissions'), where('user_id', '==', userId)))
        ]);

        const combinedPermissions = {};
        jobPermsSnapshot.forEach(d => {
            const data = d.data();
            if (data.sub_sub_service_id) combinedPermissions[`sss:${data.sub_sub_service_id}`] = true;
            else if (data.sub_service_id) combinedPermissions[`ss:${data.sub_service_id}`] = true;
            else combinedPermissions[`s:${data.service_id}`] = true;
        });

        userPermsSnapshot.forEach(d => {
            const data = d.data();
            let key;
            if (data.sub_sub_service_id) key = `sss:${data.sub_sub_service_id}`;
            else if (data.sub_service_id) key = `ss:${data.sub_service_id}`;
            else key = `s:${data.service_id}`;

            if (data.is_allowed === false) {
                delete combinedPermissions[key];
            } else {
                combinedPermissions[key] = data.is_allowed;
            }
        });

        res.status(200).json({ success: true, user: user, permissions: combinedPermissions });
    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) لتحديث الخدمات المفضلة
// --------------------------------------------------
app.post('/api/user/update-favorites', async (req, res) => {
    const { userId, favorites } = req.body;
    try {
        await updateDoc(doc(db, 'users', userId), { favorite_services: favorites });
        res.status(200).json({ success: true, message: 'Favorites updated successfully' });
    } catch (err) {
        console.error('Error updating favorites:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) لجلب اسم الشركة
// --------------------------------------------------
app.get('/api/company/:companyId', async (req, res) => {
    const { companyId } = req.params;
    try {
        const result = await getDoc(doc(db, 'companies', companyId));
        if (result.exists()) {
            const data = result.data();
            res.json({ success: true, name_ar: data.name_ar, name_en: data.name_en });
        } else {
            res.status(404).json({ success: false, message: 'Company not found' });
        }
    } catch (err) {
        console.error('Error fetching company name:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) لجلب المسمى الوظيفي
// --------------------------------------------------
app.get('/api/job/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
        const result = await getDoc(doc(db, 'jobs', jobId));
        if (result.exists()) {
            const data = result.data();
            res.json({ success: true, name_ar: data.name_ar, name_en: data.name_en });
        } else {
            res.status(404).json({ success: false, message: 'Job not found' });
        }
    } catch (err) {
        console.error('Error fetching job title:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) لجلب جميع التقييمات
// --------------------------------------------------
app.get('/api/evaluations', async (req, res) => {
    try {
        const evaluationsSnapshot = await getDocs(query(
            collection(db, 'security_evaluations'),
        ));

        const dataPromises = evaluationsSnapshot.docs.map(async (d) => {
            const evaluation = d.data();
            const [companyDoc, userDoc] = await Promise.all([
                getDoc(doc(db, 'companies', evaluation.company_id)),
                getDoc(doc(db, 'users', evaluation.evaluator_id))
            ]);

            const companies = companyDoc.exists() ? companyDoc.data() : {};
            const users = userDoc.exists() ? userDoc.data() : {};

            return {
                ...evaluation,
                id: d.id,
                companies: { name_ar: companies.name_ar, name_en: companies.name_en },
                users: { name_ar: users.name_ar, name_en: users.name_en }
            };
        });

        const formattedData = await Promise.all(dataPromises);
        res.status(200).json({ success: true, evaluations: formattedData });
    } catch (err) {
        console.error("Error fetching evaluations:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// --------------------------------------------------
// نقطة نهاية (Endpoint) لجلب تفاصيل تقييم محدد
// --------------------------------------------------
app.get('/api/evaluations/:evaluationId', async (req, res) => {
    const { evaluationId } = req.params;
    try {
        const mainDocRef = doc(db, 'security_evaluations', evaluationId);
        const detailsQuery = query(collection(db, 'security_evaluation_details'), where('evaluation_id', '==', evaluationId));
        const historyQuery = query(collection(db, 'evaluation_approvals'), where('evaluation_id', '==', evaluationId));

        const [mainDoc, detailsSnapshot, historySnapshot] = await Promise.all([
            getDoc(mainDocRef),
            getDocs(detailsQuery),
            getDocs(historyQuery)
        ]);

        if (!mainDoc.exists()) {
            return res.status(404).json({ success: false, message: 'Evaluation not found' });
        }
        const fullData = mainDoc.data();

        const [companyDoc, userDoc, jobDoc] = await Promise.all([
            getDoc(doc(db, 'companies', fullData.company_id)),
            getDoc(doc(db, 'users', fullData.evaluator_id)),
            getDoc(doc(db, 'jobs', fullData.historical_job_id)),
        ]);

        const companies = companyDoc.exists() ? companyDoc.data() : {};
        const users = userDoc.exists() ? userDoc.data() : {};
        const jobs = jobDoc.exists() ? jobDoc.data() : {};

        const details = await Promise.all(detailsSnapshot.docs.map(async d => {
            const data = d.data();
            const questionDoc = await getDoc(doc(db, 'security_questions', String(data.question_id)));
            const questionData = questionDoc.exists() ? questionDoc.data() : {};
            return {
                ...data,
                security_questions: { question_text_ar: questionData.question_text_ar, question_text_en: questionData.question_text_en }
            };
        }));

        const history = await Promise.all(historySnapshot.docs.map(async d => {
            const data = d.data();
            const userDoc = await getDoc(doc(db, 'users', data.approver_id));
            const userData = userDoc.exists() ? userDoc.data() : {};
            return {
                ...data,
                users: { name_ar: userData.name_ar, name_en: userData.name_en }
            };
        }));

        res.status(200).json({ success: true, fullData: { ...fullData, companies, users, jobs }, details, history });
    } catch (err) {
        console.error("Error fetching evaluation details:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// --------------------------------------------------
// نقطة نهاية (Endpoint) لجلب الشركات والأسئلة للتقييم الجديد
// --------------------------------------------------
app.get('/api/evaluations/companies-and-questions', async (req, res) => {
    try {
        const [companiesSnapshot, questionsSnapshot, latestEvalsSnapshot] = await Promise.all([
            getDocs(collection(db, 'companies')),
            getDocs(collection(db, 'security_questions')),
            getDocs(collection(db, 'security_evaluations'))
        ]);
        
        const allCompanies = companiesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const questionsData = questionsSnapshot.docs.map(d => d.data());
        const latestEvalsMap = new Map();
        latestEvalsSnapshot.docs.forEach(d => {
            const data = d.data();
            const companyId = data.company_id;
            const createdAt = data.created_at;
            if (!latestEvalsMap.has(companyId) || createdAt > latestEvalsMap.get(companyId).created_at) {
                latestEvalsMap.set(companyId, { ...data });
            }
        });

        const today = new Date();
        const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonth = lastMonthDate.getMonth() + 1;
        const lastMonthYear = lastMonthDate.getFullYear();

        const companiesToEvaluate = allCompanies.map(company => {
            const lastEval = latestEvalsMap.get(company.id);
            let nextEvalYear, nextEvalMonth, isDoneForThisCycle = false;

            if (!lastEval) {
                nextEvalYear = lastMonthYear;
                nextEvalMonth = lastMonth;
            } else {
                const lastEvalDate = lastEval.created_at.toDate();
                const nextEvalDate = new Date(lastEvalDate.setMonth(lastEvalDate.getMonth() + 1));
                nextEvalYear = nextEvalDate.getFullYear();
                nextEvalMonth = nextEvalDate.getMonth() + 1;
                isDoneForThisCycle = lastEval.evaluation_year === lastMonthYear && lastEval.evaluation_month === lastMonth;
            }
            return { ...company, nextEvalYear, nextEvalMonth, isDone: isDoneForThisCycle };
        }).filter(c => !c.isDone);

        res.status(200).json({ success: true, companies: companiesToEvaluate, questions: questionsData });
    } catch (err) {
        console.error("Error fetching initial data:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// --------------------------------------------------
// نقطة نهاية (Endpoint) لإدخال تقييم جديد
// --------------------------------------------------
app.post('/api/evaluations', async (req, res) => {
    const { evaluation_year, evaluation_month, company_id, evaluator_id, historical_job_id, status, historical_contract_no, summary, overall_score, details } = req.body;
    const batch = writeBatch(db);

    try {
        const evalDocRef = doc(collection(db, 'security_evaluations'));
        batch.set(evalDocRef, {
            evaluation_year,
            evaluation_month,
            company_id,
            evaluator_id,
            historical_job_id,
            status,
            historical_contract_no,
            summary,
            overall_score,
            created_at: new Date()
        });

        if (details && details.length > 0) {
            details.forEach(d => {
                const detailDocRef = doc(collection(db, 'security_evaluation_details'));
                batch.set(detailDocRef, {
                    evaluation_id: evalDocRef.id,
                    question_id: d.question_id,
                    selected_rating: d.selected_rating,
                    note: d.note,
                    inserted_at: new Date()
                });
            });
        }

        await batch.commit();
        res.status(201).json({ success: true, evaluation_id: evalDocRef.id });
    } catch (err) {
        console.error("Error saving evaluation:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// --------------------------------------------------
// نقطة نهاية (Endpoint) لجلب الخدمات الفرعية
// --------------------------------------------------
app.get('/api/services/:serviceId/sub-services', async (req, res) => {
    const { serviceId } = req.params;
    try {
        const subServicesRef = collection(db, 'sub_services');
        const querySnapshot = await getDocs(query(subServicesRef, where('service_id', '==', Number(serviceId))));
        const subServices = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        res.status(200).json({ success: true, subServices: subServices });
    } catch (err) {
        console.error('Error fetching sub-services:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) لجلب مجموعات وخدمات المستخدم
// --------------------------------------------------
app.get('/api/services-groups', async (req, res) => {
    try {
        const [groupsSnapshot, servicesSnapshot] = await Promise.all([
            getDocs(collection(db, 'service_groups')),
            getDocs(collection(db, 'services')),
        ]);
        const groups = groupsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const services = servicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        res.status(200).json({ success: true, groups, services });
    } catch (err) {
        console.error("Error fetching services and groups:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لجلب بيانات رأس الصفحة الإدارية
// --------------------------------------------------
app.get('/api/admin/services/:mainServiceId/header-data', async (req, res) => {
    const { mainServiceId } = req.params;
    try {
        const [serviceDoc, subServicesSnapshot] = await Promise.all([
            getDoc(doc(db, 'services', mainServiceId)),
            getDocs(query(collection(db, 'sub_services'), where('service_id', '==', Number(mainServiceId))))
        ]);

        if (!serviceDoc.exists()) {
            return res.status(404).json({ success: false, message: 'Main service not found' });
        }
        const mainService = serviceDoc.data();
        const subServices = subServicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        res.status(200).json({ success: true, mainService, subServices });
    } catch (err) {
        console.error("Error fetching admin header data:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لجلب بيانات AppSecurityPage
// --------------------------------------------------
app.get('/api/admin/app-security', async (req, res) => {
    try {
        const [appStatusSnapshot, usersSnapshot, jobsSnapshot] = await Promise.all([
            getDocs(collection(db, 'app')),
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'jobs')),
        ]);

        const appStatus = appStatusSnapshot.docs[0] ? appStatusSnapshot.docs[0].data() : { is_allowed: true };
        const users = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const jobs = jobsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        res.status(200).json({ success: true, appStatus, users, jobs });
    } catch (err) {
        console.error("Error fetching app security data:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لحفظ تغييرات AppSecurityPage
// --------------------------------------------------
app.post('/api/admin/app-security/save-changes', async (req, res) => {
    const { isSystemActive, usersToEnableException, usersToDisableException } = req.body;
    const batch = writeBatch(db);

    try {
        const appDocRef = doc(db, 'app', 'global');
        batch.set(appDocRef, { is_allowed: isSystemActive }, { merge: true });

        usersToEnableException.forEach(userId => {
            const userRef = doc(db, 'users', userId);
            batch.update(userRef, { app_exception: true });
        });

        usersToDisableException.forEach(userId => {
            const userRef = doc(db, 'users', userId);
            batch.update(userRef, { app_exception: false });
        });

        await batch.commit();
        res.status(200).json({ success: true, message: 'Changes saved successfully.' });
    } catch (err) {
        console.error("Error saving app security changes:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لجلب البيانات الأولية لصفحة صلاحيات الوظائف
// --------------------------------------------------
app.get('/api/job-permissions/initial-data', async (req, res) => {
    try {
        const [jobsSnapshot, servicesSnapshot, subServicesSnapshot, subSubServicesSnapshot] = await Promise.all([
            getDocs(collection(db, 'jobs')),
            getDocs(collection(db, 'services')),
            getDocs(collection(db, 'sub_services')),
            getDocs(collection(db, 'sub_sub_services'))
        ]);
        const jobs = jobsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const servicesTree = servicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const subServices = subServicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const subSubServices = subSubServicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        res.status(200).json({
            success: true,
            jobs,
            servicesTree,
            subServices,
            subSubServices
        });
    } catch (err) {
        console.error("Error fetching job permissions initial data:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لجلب صلاحيات مسمى وظيفي محدد
// --------------------------------------------------
app.get('/api/job-permissions/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
        const querySnapshot = await getDocs(query(collection(db, 'job_permissions'), where('job_id', '==', Number(jobId))));
        const permissions = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        res.status(200).json({ success: true, permissions });
    } catch (err) {
        console.error("Error fetching job permissions:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لحفظ صلاحيات مسمى وظيفي
// --------------------------------------------------
app.post('/api/job-permissions/save', async (req, res) => {
    const { jobId, permissionsToAdd, permissionsToRemove, actorId } = req.body;
    const batch = writeBatch(db);

    try {
        if (permissionsToRemove.length > 0) {
            await Promise.all(permissionsToRemove.map(async perm => {
                const [type, id] = perm.split(':');
                const querySnapshot = await getDocs(query(collection(db, 'job_permissions'), where('job_id', '==', Number(jobId)), where('sub_service_id', '==', Number(id)))); 
                if (!querySnapshot.empty) {
                    querySnapshot.docs.forEach(d => batch.delete(d.ref));
                }
            }));
        }

        if (permissionsToAdd.length > 0) {
            permissionsToAdd.forEach(perm => {
                const [type, id] = perm.split(':');
                let service_id = null, sub_service_id = null, sub_sub_service_id = null;
                if (type === 's') service_id = Number(id);
                else if (type === 'ss') sub_service_id = Number(id);
                else if (type === 'sss') sub_sub_service_id = Number(id);

                const docRef = doc(collection(db, 'job_permissions'));
                batch.set(docRef, {
                    service_id,
                    sub_service_id,
                    sub_sub_service_id,
                    job_id: jobId,
                    actor_id: actorId,
                    is_allowed: true,
                    created_at: new Date()
                });
            });
        }

        await batch.commit();
        res.status(200).json({ success: true, message: 'Permissions updated successfully.' });
    } catch (err) {
        console.error("Error saving job permissions:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لجلب البيانات الأولية لصفحة استثناءات المستخدمين
// --------------------------------------------------
app.get('/api/user-exceptions/initial-data', async (req, res) => {
    try {
        const [usersSnapshot, jobsSnapshot, servicesSnapshot, subServicesSnapshot, subSubServicesSnapshot] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'jobs')),
            getDocs(collection(db, 'services')),
            getDocs(collection(db, 'sub_services')),
            getDocs(collection(db, 'sub_sub_services'))
        ]);
        const users = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const jobs = jobsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const services = servicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const subServices = subServicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const subSubServices = subSubServicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        res.status(200).json({
            success: true,
            users,
            jobs,
            services,
            subServices,
            subSubServices
        });
    } catch (err) {
        console.error("Error fetching user exceptions initial data:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لجلب صلاحيات مستخدم محدد وصلاحيات وظيفته
// --------------------------------------------------
app.get('/api/user-exceptions/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const user = userDoc.data();

        const [userPermsSnapshot, jobPermsSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'user_permissions'), where('user_id', '==', userId))),
            getDocs(query(collection(db, 'job_permissions'), where('job_id', '==', user.job_id))),
        ]);
        const userPermissions = userPermsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const jobPermissions = jobPermsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        res.status(200).json({ success: true, userPermissions, jobPermissions });
    } catch (err) {
        console.error("Error fetching user and job permissions:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لحفظ استثناءات المستخدمين
// --------------------------------------------------
app.post('/api/user-exceptions/save', async (req, res) => {
    const { userId, changesToInsert, changesToDelete } = req.body;
    const batch = writeBatch(db);

    try {
        if (changesToDelete.length > 0) {
            await Promise.all(changesToDelete.map(async change => {
                const querySnapshot = await getDocs(query(collection(db, 'user_permissions'), where('user_id', '==', change.user_id), where('service_id', '==', change.service_id)));
                if (!querySnapshot.empty) {
                    querySnapshot.docs.forEach(d => batch.delete(d.ref));
                }
            }));
        }

        if (changesToInsert.length > 0) {
            changesToInsert.forEach(change => {
                const docRef = doc(collection(db, 'user_permissions'));
                batch.set(docRef, { ...change });
            });
        }

        await batch.commit();
        res.status(200).json({ success: true, message: 'User exceptions saved successfully.' });
    } catch (err) {
        console.error("Error saving user exceptions:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`الخادم يعمل على المنفذ: ${port}`);
});