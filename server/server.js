const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3001;

// إعداد الاتصال بقاعدة البيانات باستخدام متغيرات البيئة
const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: 5432,
});

client.connect();

app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// نقطة نهاية (Endpoint) لجلب بيانات المستخدم والأذونات
// ----------------------------------------------------
app.get('/api/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const user = userResult.rows[0];
        const permissionsResult = await client.query(
            'SELECT service_id, sub_service_id, sub_sub_service_id FROM job_permissions WHERE job_id = $1',
            [user.job_id]
        );
        const userPermissionsResult = await client.query(
            'SELECT service_id, sub_service_id, sub_sub_service_id, is_allowed FROM user_permissions WHERE user_id = $1',
            [userId]
        );
        const combinedPermissions = {};
        permissionsResult.rows.forEach(p => {
            if (p.sub_sub_service_id) combinedPermissions[`sss:${p.sub_sub_service_id}`] = true;
            else if (p.sub_service_id) combinedPermissions[`ss:${p.sub_service_id}`] = true;
            else combinedPermissions[`s:${p.service_id}`] = true;
        });
        userPermissionsResult.rows.forEach(p => {
            let key;
            if (p.sub_sub_service_id) key = `sss:${p.sub_sub_service_id}`;
            else if (p.sub_service_id) key = `ss:${p.sub_service_id}`;
            else key = `s:${p.service_id}`;
            if (p.is_allowed === false) {
                delete combinedPermissions[key];
            } else {
                combinedPermissions[key] = p.is_allowed;
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
        await client.query('UPDATE users SET favorite_services = $1 WHERE id = $2', [favorites, userId]);
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
        const result = await client.query('SELECT name_ar, name_en FROM companies WHERE id = $1', [companyId]);
        if (result.rows.length > 0) {
            const data = result.rows[0];
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
        const result = await client.query('SELECT name_ar, name_en FROM jobs WHERE id = $1', [jobId]);
        if (result.rows.length > 0) {
            const data = result.rows[0];
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
        const query = 'SELECT se.id, se.evaluation_year, se.evaluation_month, se.overall_score, se.status, se.created_at, c.name_ar AS companies_name_ar, c.name_en AS companies_name_en, u.name_ar AS users_name_ar, u.name_en AS users_name_en FROM security_evaluations se LEFT JOIN companies c ON se.company_id = c.id LEFT JOIN users u ON se.evaluator_id = u.id ORDER BY se.evaluation_year DESC, se.evaluation_month DESC';
        const result = await client.query(query);

        const formattedData = result.rows.map(row => ({
            ...row,
            companies: { name_ar: row.companies_name_ar, name_en: row.companies_name_en },
            users: { name_ar: row.users_name_ar, name_en: row.users_name_en }
        }));

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
        const [mainRes, detailsRes, historyRes] = await Promise.all([
            client.query('SELECT se.*, c.name_ar AS companies_name_ar, c.name_en AS companies_name_en, u.name_ar AS users_name_ar, u.name_en AS users_name_en, j.name_ar AS jobs_name_ar, j.name_en AS jobs_name_en FROM security_evaluations se LEFT JOIN companies c ON se.company_id = c.id LEFT JOIN users u ON se.evaluator_id = u.id LEFT JOIN jobs j ON se.historical_job_id = j.id WHERE se.id = $1', [evaluationId]),
            client.query('SELECT sed.*, sq.question_text_ar, sq.question_text_en FROM security_evaluation_details sed LEFT JOIN security_questions sq ON sed.question_id = sq.id WHERE sed.evaluation_id = $1 ORDER BY sed.id ASC', [evaluationId]),
            client.query('SELECT ea.*, u.name_ar AS users_name_ar, u.name_en AS users_name_en FROM evaluation_approvals ea LEFT JOIN users u ON ea.approver_id = u.id WHERE ea.evaluation_id = $1 ORDER BY ea.created_at ASC', [evaluationId]),
        ]);

        const fullData = mainRes.rows.length > 0 ? {
            ...mainRes.rows[0],
            companies: { name_ar: mainRes.rows[0].companies_name_ar, name_en: mainRes.rows[0].companies_name_en },
            users: { name_ar: mainRes.rows[0].users_name_ar, name_en: mainRes.rows[0].users_name_en },
            jobs: { name_ar: mainRes.rows[0].jobs_name_ar, name_en: mainRes.rows[0].jobs_name_en },
        } : null;

        const details = detailsRes.rows.map(row => ({
            ...row,
            security_questions: { question_text_ar: row.question_text_ar, question_text_en: row.question_text_en }
        }));

        const history = historyRes.rows.map(row => ({
            ...row,
            users: { name_ar: row.users_name_ar, name_en: row.users_name_en }
        }));

        if (fullData) {
            res.status(200).json({ success: true, fullData, details, history });
        } else {
            res.status(404).json({ success: false, message: 'Evaluation not found' });
        }

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
        const today = new Date();
        const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonth = lastMonthDate.getMonth() + 1;
        const lastMonthYear = lastMonthDate.getFullYear();

        const [companiesRes, questionsRes, latestEvalRes] = await Promise.all([
            client.query('SELECT id, name_ar, name_en, contract_no, guard_count, violations_count FROM companies'),
            client.query('SELECT * FROM security_questions ORDER BY id ASC'),
            client.query('SELECT company_id, evaluation_year, evaluation_month FROM security_evaluations WHERE (company_id, created_at) IN (SELECT company_id, MAX(created_at) FROM security_evaluations GROUP BY company_id)')
        ]);

        const allCompanies = companiesRes.rows;
        const questionsData = questionsRes.rows;
        const lastEvalsMap = new Map(latestEvalRes.rows.map(e => [e.company_id, { year: e.evaluation_year, month: e.evaluation_month }]));

        const companiesToEvaluate = allCompanies.map(company => {
            const lastEval = lastEvalsMap.get(company.id);
            let nextEvalYear, nextEvalMonth, isDoneForThisCycle = false;

            if (!lastEval) {
                nextEvalYear = lastMonthYear;
                nextEvalMonth = lastMonth;
            } else {
                const lastEvalDate = new Date(lastEval.year, lastEval.month - 1, 1);
                const nextEvalDate = new Date(lastEvalDate.setMonth(lastEvalDate.getMonth() + 1));
                nextEvalYear = nextEvalDate.getFullYear();
                nextEvalMonth = nextEvalDate.getMonth() + 1;
                isDoneForThisCycle = lastEval.year === lastMonthYear && lastEval.month === lastMonth;
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
    const clientTransaction = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: 5432,
    });
    await clientTransaction.connect();

    try {
        await clientTransaction.query('BEGIN');
        const evalQuery = 'INSERT INTO security_evaluations (evaluation_year, evaluation_month, company_id, evaluator_id, historical_job_id, status, historical_contract_no, summary, overall_score) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id';
        const evalRes = await clientTransaction.query(evalQuery, [evaluation_year, evaluation_month, company_id, evaluator_id, historical_job_id, status, historical_contract_no, summary, overall_score]);
        const evaluation_id = evalRes.rows[0].id;

        if (details && details.length > 0) {
            const detailsQuery = 'INSERT INTO security_evaluation_details (evaluation_id, question_id, selected_rating, note) VALUES ' + details.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
            const detailsValues = details.flatMap((d) => [evaluation_id, d.question_id, d.selected_rating, d.note]);
            await clientTransaction.query(detailsQuery, detailsValues);
        }

        await clientTransaction.query('COMMIT');
        res.status(201).json({ success: true, evaluation_id });
    } catch (err) {
        await clientTransaction.query('ROLLBACK');
        console.error("Error saving evaluation:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        await clientTransaction.end();
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) لجلب الخدمات الفرعية
// --------------------------------------------------
app.get('/api/services/:serviceId/sub-services', async (req, res) => {
    const { serviceId } = req.params;
    try {
        const query = 'SELECT id, page, is_allowed FROM sub_services WHERE service_id = $1 ORDER BY "order" ASC';
        const result = await client.query(query, [serviceId]);
        res.status(200).json({ success: true, subServices: result.rows });
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
        const [groupsRes, servicesRes] = await Promise.all([
            client.query('SELECT * FROM service_groups ORDER BY "order"'),
            client.query('SELECT * FROM services ORDER BY "order"'),
        ]);

        const groups = groupsRes.rows;
        const services = servicesRes.rows;

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
        const [serviceRes, subServicesRes] = await Promise.all([
            client.query('SELECT label_ar, label_en FROM services WHERE id = $1', [mainServiceId]),
            client.query('SELECT id, label_ar, label_en, page FROM sub_services WHERE service_id = $1 ORDER BY "order" ASC', [mainServiceId])
        ]);

        const mainService = serviceRes.rows[0];
        const subServices = subServicesRes.rows;

        if (mainService) {
            res.status(200).json({ success: true, mainService, subServices });
        } else {
            res.status(404).json({ success: false, message: 'Main service not found' });
        }
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
        const [appStatusRes, usersRes, jobsRes] = await Promise.all([
            client.query('SELECT is_allowed FROM app LIMIT 1'),
            client.query('SELECT id, name_ar, name_en, job_id, app_exception FROM users'),
            client.query('SELECT id, name_ar, name_en FROM jobs'),
        ]);

        const appStatus = appStatusRes.rows[0] || { is_allowed: true };
        const users = usersRes.rows;
        const jobs = jobsRes.rows;

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
    const clientTransaction = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: 5432,
    });
    await clientTransaction.connect();

    try {
        await clientTransaction.query('BEGIN');

        await clientTransaction.query('UPDATE app SET is_allowed = $1', [isSystemActive]);

        if (usersToEnableException.length > 0) {
            await clientTransaction.query('UPDATE users SET app_exception = TRUE WHERE id = ANY($1::uuid[])', [usersToEnableException]);
        }
        if (usersToDisableException.length > 0) {
            await clientTransaction.query('UPDATE users SET app_exception = FALSE WHERE id = ANY($1::uuid[])', [usersToDisableException]);
        }

        await clientTransaction.query('COMMIT');
        res.status(200).json({ success: true, message: 'Changes saved successfully.' });
    } catch (err) {
        await clientTransaction.query('ROLLBACK');
        console.error("Error saving app security changes:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        await clientTransaction.end();
    }
});

// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لجلب البيانات الأولية لصفحة صلاحيات الوظائف
// --------------------------------------------------
app.get('/api/job-permissions/initial-data', async (req, res) => {
    try {
        const [jobsRes, servicesRes, subServicesRes, subSubServicesRes] = await Promise.all([
            client.query('SELECT id, name_ar, name_en FROM jobs ORDER BY id ASC'),
            client.query('SELECT id, label_ar, label_en FROM services ORDER BY "order" ASC'),
            client.query('SELECT id, service_id, label_ar, label_en FROM sub_services ORDER BY "order" ASC'),
            client.query('SELECT id, sub_service_id, label_ar, label_en FROM sub_sub_services ORDER BY "order" ASC')
        ]);

        res.status(200).json({
            success: true,
            jobs: jobsRes.rows,
            servicesTree: servicesRes.rows,
            subServices: subServicesRes.rows,
            subSubServices: subSubServicesRes.rows
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
        const result = await client.query('SELECT * FROM job_permissions WHERE job_id = $1', [jobId]);
        res.status(200).json({ success: true, permissions: result.rows });
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
    const clientTransaction = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: 5432,
    });
    await clientTransaction.connect();

    try {
        await clientTransaction.query('BEGIN');

        if (permissionsToRemove.length > 0) {
            const deleteServiceIds = permissionsToRemove.filter((p) => p.startsWith('s:')).map((p) => Number(p.split(':')[1]));
            const deleteSubServiceIds = permissionsToRemove.filter((p) => p.startsWith('ss:')).map((p) => Number(p.split(':')[1]));
            const deleteSubSubServiceIds = permissionsToRemove.filter((p) => p.startsWith('sss:')).map((p) => Number(p.split(':')[1]));

            if (deleteServiceIds.length > 0) await clientTransaction.query('DELETE FROM job_permissions WHERE job_id = $1 AND service_id = ANY($2::integer[])', [jobId, deleteServiceIds]);
            if (deleteSubServiceIds.length > 0) await clientTransaction.query('DELETE FROM job_permissions WHERE job_id = $1 AND sub_service_id = ANY($2::integer[])', [jobId, deleteSubServiceIds]);
            if (deleteSubSubServiceIds.length > 0) await clientTransaction.query('DELETE FROM job_permissions WHERE job_id = $1 AND sub_sub_service_id = ANY($2::integer[])', [jobId, deleteSubSubServiceIds]);
        }

        if (permissionsToAdd.length > 0) {
            const permissionsToInsert = permissionsToAdd.map((perm) => {
                const [type, id] = perm.split(':');
                let service_id = null, sub_service_id = null, sub_sub_service_id = null;
                if (type === 's') service_id = Number(id);
                else if (type === 'ss') sub_service_id = Number(id);
                else if (type === 'sss') sub_sub_service_id = Number(id);

                return [service_id, sub_service_id, sub_sub_service_id, jobId, actorId, true];
            });

            const placeholders = permissionsToInsert.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(', ');
            const insertValues = permissionsToInsert.flatMap(p => p);

            const insertQuery = `INSERT INTO job_permissions (service_id, sub_service_id, sub_sub_service_id, job_id, actor_id, is_allowed) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
            await clientTransaction.query(insertQuery, insertValues);
        }

        await clientTransaction.query('COMMIT');
        res.status(200).json({ success: true, message: 'Permissions updated successfully.' });
    } catch (err) {
        await clientTransaction.query('ROLLBACK');
        console.error("Error saving job permissions:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        await clientTransaction.end();
    }
});


// --------------------------------------------------
// نقطة نهاية (Endpoint) جديدة لجلب البيانات الأولية لصفحة استثناءات المستخدمين
// --------------------------------------------------
app.get('/api/user-exceptions/initial-data', async (req, res) => {
    try {
        const [usersRes, jobsRes, servicesRes, subServicesRes, subSubServicesRes] = await Promise.all([
            client.query('SELECT id, name_ar, name_en, job_id FROM users ORDER BY name_ar ASC'),
            client.query('SELECT id, name_ar, name_en FROM jobs ORDER BY id ASC'),
            client.query('SELECT id, label_ar, label_en FROM services ORDER BY "order" ASC'),
            client.query('SELECT id, service_id, label_ar, label_en FROM sub_services ORDER BY "order" ASC'),
            client.query('SELECT id, sub_service_id, label_ar, label_en FROM sub_sub_services ORDER BY "order" ASC')
        ]);
        
        res.status(200).json({
            success: true,
            users: usersRes.rows,
            jobs: jobsRes.rows,
            servicesRes: servicesRes.rows,
            subServicesRes: subServicesRes.rows,
            subSubServicesRes: subSubServicesRes.rows
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
        const user = (await client.query('SELECT job_id FROM users WHERE id = $1', [userId])).rows[0];
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const [userPermsRes, jobPermsRes] = await Promise.all([
            client.query('SELECT up.sub_service_id, up.sub_sub_service_id, up.is_allowed, up.service_id FROM user_permissions up WHERE up.user_id = $1', [userId]),
            client.query('SELECT jp.sub_service_id, jp.sub_sub_service_id, jp.service_id FROM job_permissions jp WHERE jp.job_id = $1', [user.job_id]),
        ]);
        
        res.status(200).json({ success: true, userPermissions: userPermsRes.rows, jobPermissions: jobPermsRes.rows });
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
    const clientTransaction = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: 5432,
    });
    await clientTransaction.connect();

    try {
        await clientTransaction.query('BEGIN');

        if (changesToDelete.length > 0) {
            const deleteQueries = changesToDelete.map((c) => {
                const service_id_clause = c.service_id ? `service_id=${c.service_id}` : 'service_id IS NULL';
                const sub_service_id_clause = c.sub_service_id ? `sub_service_id=${c.sub_service_id}` : 'sub_service_id IS NULL';
                const sub_sub_service_id_clause = c.sub_sub_service_id ? `sub_sub_service_id=${c.sub_sub_service_id}` : 'sub_sub_service_id IS NULL';
                return `(user_id='${c.user_id}' AND ${service_id_clause} AND ${sub_service_id_clause} AND ${sub_sub_service_id_clause})`;
            }).join(' OR ');

            await clientTransaction.query(`DELETE FROM user_permissions WHERE ${deleteQueries}`);
        }

        if (changesToInsert.length > 0) {
            const insertQuery = 'INSERT INTO user_permissions (user_id, service_id, sub_service_id, sub_sub_service_id, is_allowed, actor_id) VALUES ' + changesToInsert.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(', ');
            const insertValues = changesToInsert.flatMap((p) => [p.user_id, p.service_id, p.sub_service_id, p.sub_sub_service_id, p.is_allowed, p.actor_id]);
            await clientTransaction.query(insertQuery, insertValues);
        }

        await clientTransaction.query('COMMIT');
        res.status(200).json({ success: true, message: 'User exceptions saved successfully.' });
    } catch (err) {
        await clientTransaction.query('ROLLBACK');
        console.error("Error saving user exceptions:", err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        await clientTransaction.end();
    }
});

app.listen(port, () => {
    console.log(`الخادم يعمل على المنفذ: ${port}`);
});