const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

admin.initializeApp(); // لا يحتاج إلى مفتاح خدمة

const db = admin.firestore();
const app = express();

app.use(cors({ origin: true }));

// نقطة نهاية (Endpoint) لجلب بيانات المستخدم والأذونات
app.get('/api/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const user = userDoc.data();
        const [jobPermsRes, userPermsRes] = await Promise.all([
            db.collection('job_permissions').where('job_id', '==', user.job_id).get(),
            db.collection('user_permissions').where('user_id', '==', userId).get()
        ]);
        const combinedPermissions = {};
        jobPermsRes.forEach(doc => {
            const data = doc.data();
            if (data.sub_sub_service_id) combinedPermissions[`sss:${data.sub_sub_service_id}`] = true;
            else if (data.sub_service_id) combinedPermissions[`ss:${data.sub_service_id}`] = true;
            else combinedPermissions[`s:${data.service_id}`] = true;
        });
        userPermsRes.forEach(doc => {
            const data = doc.data();
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

// نقطة نهاية (Endpoint) لتحديث الخدمات المفضلة
app.post('/api/user/update-favorites', async (req, res) => {
    const { userId, favorites } = req.body;
    try {
        await db.collection('users').doc(userId).update({ favorite_services: favorites });
        res.status(200).json({ success: true, message: 'Favorites updated successfully' });
    } catch (err) {
        console.error('Error updating favorites:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// نقطة نهاية (Endpoint) لجلب اسم الشركة
app.get('/api/company/:companyId', async (req, res) => {
    const { companyId } = req.params;
    try {
        const result = await db.collection('companies').doc(companyId).get();
        if (result.exists) {
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

// نقطة نهاية (Endpoint) لجلب المسمى الوظيفي
app.get('/api/job/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
        const result = await db.collection('jobs').doc(jobId).get();
        if (result.exists) {
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

// نقطة نهاية (Endpoint) لجلب جميع التقييمات
app.get('/api/evaluations', async (req, res) => {
    try {
        const evaluationsRef = db.collection('security_evaluations');
        const evaluationsSnapshot = await evaluationsRef.orderBy('evaluation_year', 'desc').orderBy('evaluation_month', 'desc').get();
        const dataPromises = evaluationsSnapshot.docs.map(async (doc) => {
            const evaluation = doc.data();
            const [companyDoc, userDoc] = await Promise.all([
                db.collection('companies').doc(evaluation.company_id).get(),
                db.collection('users').doc(evaluation.evaluator_id).get()
            ]);
            const companies = companyDoc.exists ? companyDoc.data() : {};
            const users = userDoc.exists ? userDoc.data() : {};
            return {
                ...evaluation,
                id: doc.id,
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

// نقطة نهاية (Endpoint) لجلب تفاصيل تقييم محدد
app.get('/api/evaluations/:evaluationId', async (req, res) => {
    const { evaluationId } = req.params;
    try {
        const mainDocRef = db.collection('security_evaluations').doc(evaluationId);
        const detailsQuery = db.collection('security_evaluation_details').where('evaluation_id', '==', evaluationId);
        const historyQuery = db.collection('evaluation_approvals').where('evaluation_id', '==', evaluationId);
        const [mainDoc, detailsSnapshot, historySnapshot] = await Promise.all([
            mainDocRef.get(),
            detailsQuery.orderBy('id', 'asc').get(),
            historyQuery.orderBy('created_at', 'asc').get()
        ]);
        if (!mainDoc.exists) {
            return res.status(404).json({ success: false, message: 'Evaluation not found' });
        }
        const fullData = mainDoc.data();
        const [companyDoc, userDoc, jobDoc] = await Promise.all([
            db.collection('companies').doc(fullData.company_id).get(),
            db.collection('users').doc(fullData.evaluator_id).get(),
            db.collection('jobs').doc(fullData.historical_job_id).get(),
        ]);
        const companies = companyDoc.exists ? companyDoc.data() : {};
        const users = userDoc.exists ? userDoc.data() : {};
        const jobs = jobDoc.exists ? jobDoc.data() : {};
        const details = await Promise.all(detailsSnapshot.docs.map(async doc => {
            const data = doc.data();
            const questionDoc = await db.collection('security_questions').doc(String(data.question_id)).get();
            const questionData = questionDoc.exists ? questionDoc.data() : {};
            return {
                ...data,
                security_questions: { question_text_ar: questionData.question_text_ar, question_text_en: questionData.question_text_en }
            };
        }));
        const history = await Promise.all(historySnapshot.docs.map(async doc => {
            const data = doc.data();
            const userDoc = await db.collection('users').doc(data.approver_id).get();
            const userData = userDoc.exists ? userDoc.data() : {};
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


// نقطة نهاية (Endpoint) لجلب الشركات والأسئلة للتقييم الجديد
app.get('/api/evaluations/companies-and-questions', async (req, res) => {
    try {
        const [companiesSnapshot, questionsSnapshot, latestEvalsSnapshot] = await Promise.all([
            db.collection('companies').get(),
            db.collection('security_questions').orderBy('id', 'asc').get(),
            db.collection('security_evaluations').get()
        ]);
        const allCompanies = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const questionsData = questionsSnapshot.docs.map(doc => doc.data());
        const latestEvalsMap = new Map();
        latestEvalsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const companyId = data.company_id;
            const createdAt = data.created_at.toDate();
            if (!latestEvalsMap.has(companyId) || createdAt > latestEvalsMap.get(companyId).created_at) {
                latestEvalsMap.set(companyId, { ...data, created_at: createdAt });
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
                const lastEvalDate = lastEval.created_at;
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

// نقطة نهاية (Endpoint) لإدخال تقييم جديد
app.post('/api/evaluations', async (req, res) => {
    const { evaluation_year, evaluation_month, company_id, evaluator_id, historical_job_id, status, historical_contract_no, summary, overall_score, details } = req.body;
    const batch = db.batch();
    try {
        const evalDocRef = db.collection('security_evaluations').doc();
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
                const detailDocRef = db.collection('security_evaluation_details').doc();
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

// نقطة نهاية (Endpoint) لجلب الخدمات الفرعية
app.get('/api/services/:serviceId/sub-services', async (req, res) => {
    const { serviceId } = req.params;
    try {
        const query = await db.collection('sub_services').where('service_id', '==', Number(serviceId)).orderBy('order', 'asc').get();
        const subServices = query.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ success: true, subServices: subServices });
    } catch (err) {
        console.error('Error fetching sub-services:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// نقطة نهاية (Endpoint) لجلب مجموعات وخدمات المستخدم
app.get('/api/services-groups', async (req, res) => {
    try {
        const [groupsSnapshot, servicesSnapshot] = await Promise.all([
            db.collection('service_groups').orderBy('order', 'asc').get(),
            db.collection('services').orderBy('order', 'asc').get(),
        ]);
        const groups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ success: true, groups, services });
    } catch (err) {
        console.error("Error fetching services and groups:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// نقطة نهاية (Endpoint) جديدة لجلب بيانات رأس الصفحة الإدارية
app.get('/api/admin/services/:mainServiceId/header-data', async (req, res) => {
    const { mainServiceId } = req.params;
    try {
        const [serviceDoc, subServicesSnapshot] = await Promise.all([
            db.collection('services').doc(mainServiceId).get(),
            db.collection('sub_services').where('service_id', '==', Number(mainServiceId)).orderBy('order', 'asc').get()
        ]);
        if (!serviceDoc.exists) {
            return res.status(404).json({ success: false, message: 'Main service not found' });
        }
        const mainService = serviceDoc.data();
        const subServices = subServicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ success: true, mainService, subServices });
    } catch (err) {
        console.error("Error fetching admin header data:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// نقطة نهاية (Endpoint) جديدة لجلب بيانات AppSecurityPage
app.get('/api/admin/app-security', async (req, res) => {
    try {
        const [appStatusSnapshot, usersSnapshot, jobsSnapshot] = await Promise.all([
            db.collection('app').limit(1).get(),
            db.collection('users').get(),
            db.collection('jobs').get(),
        ]);
        const appStatus = appStatusSnapshot.docs[0] ? appStatusSnapshot.docs[0].data() : { is_allowed: true };
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ success: true, appStatus, users, jobs });
    } catch (err) {
        console.error("Error fetching app security data:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// نقطة نهاية (Endpoint) جديدة لحفظ تغييرات AppSecurityPage
app.post('/api/admin/app-security/save-changes', async (req, res) => {
    const { isSystemActive, usersToEnableException, usersToDisableException } = req.body;
    const batch = db.batch();
    try {
        const appDocRef = db.collection('app').doc('global');
        batch.set(appDocRef, { is_allowed: isSystemActive });
        usersToEnableException.forEach(userId => {
            const userRef = db.collection('users').doc(userId);
            batch.update(userRef, { app_exception: true });
        });
        usersToDisableException.forEach(userId => {
            const userRef = db.collection('users').doc(userId);
            batch.update(userRef, { app_exception: false });
        });
        await batch.commit();
        res.status(200).json({ success: true, message: 'Changes saved successfully.' });
    } catch (err) {
        console.error("Error saving app security changes:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// نقطة نهاية (Endpoint) جديدة لجلب البيانات الأولية لصفحة صلاحيات الوظائف
app.get('/api/job-permissions/initial-data', async (req, res) => {
    try {
        const [jobsSnapshot, servicesSnapshot, subServicesSnapshot, subSubServicesSnapshot] = await Promise.all([
            db.collection('jobs').orderBy('id', 'asc').get(),
            db.collection('services').orderBy('order', 'asc').get(),
            db.collection('sub_services').orderBy('order', 'asc').get(),
            db.collection('sub_sub_services').orderBy('order', 'asc').get()
        ]);
        const jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const servicesTree = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const subServices = subServicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const subSubServices = subSubServicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

// نقطة نهاية (Endpoint) جديدة لجلب صلاحيات مسمى وظيفي محدد
app.get('/api/job-permissions/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
        const result = await db.collection('job_permissions').where('job_id', '==', Number(jobId)).get();
        const permissions = result.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ success: true, permissions });
    } catch (err) {
        console.error("Error fetching job permissions:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// نقطة نهاية (Endpoint) جديدة لحفظ صلاحيات مسمى وظيفي
app.post('/api/job-permissions/save', async (req, res) => {
    const { jobId, permissionsToAdd, permissionsToRemove, actorId } = req.body;
    const batch = db.batch();
    try {
        if (permissionsToRemove.length > 0) {
            const deletePromises = permissionsToRemove.map(async perm => {
                const [type, id] = perm.split(':');
                const querySnapshot = await db.collection('job_permissions').where('job_id', '==', jobId).where('sub_service_id', '==', Number(id)).get();
                if (!querySnapshot.empty) {
                    batch.delete(querySnapshot.docs[0].ref);
                }
            });
            await Promise.all(deletePromises);
        }
        if (permissionsToAdd.length > 0) {
            permissionsToAdd.forEach(perm => {
                const [type, id] = perm.split(':');
                let service_id = null, sub_service_id = null, sub_sub_service_id = null;
                if (type === 's') service_id = Number(id);
                else if (type === 'ss') sub_service_id = Number(id);
                else if (type === 'sss') sub_sub_service_id = Number(id);
                const docRef = db.collection('job_permissions').doc();
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

// نقطة نهاية (Endpoint) جديدة لجلب البيانات الأولية لصفحة استثناءات المستخدمين
app.get('/api/user-exceptions/initial-data', async (req, res) => {
    try {
        const [usersSnapshot, jobsSnapshot, servicesSnapshot, subServicesSnapshot, subSubServicesSnapshot] = await Promise.all([
            db.collection('users').orderBy('name_ar', 'asc').get(),
            db.collection('jobs').orderBy('id', 'asc').get(),
            db.collection('services').orderBy('order', 'asc').get(),
            db.collection('sub_services').orderBy('order', 'asc').get(),
            db.collection('sub_sub_services').orderBy('order', 'asc').get()
        ]);
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const subServices = subServicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const subSubServices = subSubServicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

// نقطة نهاية (Endpoint) جديدة لجلب صلاحيات مستخدم محدد وصلاحيات وظيفته
app.get('/api/user-exceptions/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const user = userDoc.data();
        const [userPermsSnapshot, jobPermsSnapshot] = await Promise.all([
            db.collection('user_permissions').where('user_id', '==', userId).get(),
            db.collection('job_permissions').where('job_id', '==', user.job_id).get(),
        ]);
        const userPermissions = userPermsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const jobPermissions = jobPermsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ success: true, userPermissions, jobPermissions });
    } catch (err) {
        console.error("Error fetching user and job permissions:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// نقطة نهاية (Endpoint) جديدة لحفظ استثناءات المستخدمين
app.post('/api/user-exceptions/save', async (req, res) => {
    const { userId, changesToInsert, changesToDelete } = req.body;
    const batch = db.batch();
    try {
        if (changesToDelete.length > 0) {
            const deletePromises = changesToDelete.map(async change => {
                const querySnapshot = await db.collection('user_permissions').where('user_id', '==', change.user_id).where('service_id', '==', change.service_id).get();
                if (!querySnapshot.empty) {
                    batch.delete(querySnapshot.docs[0].ref);
                }
            });
            await Promise.all(deletePromises);
        }
        if (changesToInsert.length > 0) {
            changesToInsert.forEach(change => {
                const docRef = db.collection('user_permissions').doc();
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