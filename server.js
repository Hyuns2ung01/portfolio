const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const app = express();
const port = 3000;

const ADMIN_ID = '관리자 아이디';
const ADMIN_PW = '관리자 비밀번호';

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'my_secret_key',
    resave: false,
    saveUninitialized: true
}));

app.use((req, res, next) => {
    res.locals.isLoggedIn = req.session.isLoggedIn || false;
    next();
});

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'PASSWORD',
    database: 'database_name'
});
db.connect();

// --- 라우터 시작 ---

// 1. 메인 화면
app.get('/', (req, res) => {
    db.query('SELECT * FROM projects ORDER BY id DESC', (err, results) => {
        if (err) {
            res.render('index', { projects: [], stats: [] });
        } else {
            const totalProjects = results.length;
            const skillCounts = {};
            results.forEach(item => {
                if (item.stack) {
                    const stacks = item.stack.split(',').map(s => s.trim());
                    stacks.forEach(tech => {
                        if (tech) skillCounts[tech] = (skillCounts[tech] || 0) + 1;
                    });
                }
            });
            const statsArray = Object.keys(skillCounts).map(key => {
                return {
                    name: key,
                    percent: totalProjects === 0 ? 0 : Math.round((skillCounts[key] / totalProjects) * 100)
                };
            }).sort((a, b) => b.percent - a.percent);

            res.render('index', { projects: results, stats: statsArray });
        }
    });
});

// 2. 프로젝트 목록
app.get('/projects', (req, res) => {
    db.query('SELECT * FROM projects', (err, results) => {
        res.render('projects', { projects: results });
    });
});

// 3. 로그인 페이지 보여주기
app.get('/login', (req, res) => {
    res.render('login');
});

// 4. 로그인 처리 (POST)
app.post('/login', (req, res) => {
    const { id, pw } = req.body;

    // 아이디 비번 확인
    if (id === ADMIN_ID && pw === ADMIN_PW) {
        req.session.isLoggedIn = true; // 세션에 기록
        req.session.save(() => {
            res.redirect('/'); // 메인으로 이동
        });
    } else {
        res.send('<script>alert("아이디 또는 비밀번호가 틀렸습니다."); history.back();</script>');
    }
});

// 5. 로그아웃 처리
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// 6. 글쓰기 화면 (로그인 안 했으면 쫓아내기)
app.get('/projects/write', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.send('<script>alert("관리자만 접근 가능합니다."); location.href="/login";</script>');
    }
    res.render('project-write');
});

// 7. 글 저장
app.post('/projects/write', (req, res) => {
    if (!req.session.isLoggedIn) return res.send('권한 없음');

    const { title, stack, desc } = req.body;
    db.query('INSERT INTO projects (title, stack, description) VALUES (?, ?, ?)',
        [title, stack, desc],
        (err) => {
            if (err) console.error(err);
            res.redirect('/projects');
        }
    );
});
// ---------- 로그인 했을때 기능 ------------
// 1. 수정 화면 보여주기
app.get('/projects/edit/:id', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.send('<script>alert("관리자만 접근 가능합니다."); location.href="/login";</script>');
    }

    const projectId = req.params.id;

    db.query('SELECT * FROM projects WHERE id = ?', [projectId], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send('프로젝트를 찾을 수 없습니다.');

        // 수정 화면으로 데이터 보냄
        res.render('project-edit', { project: results[0] });
    });
});

// 2. 수정 요청 처리 (POST) - 깃허브 주소 포함
app.post('/projects/edit/:id', (req, res) => {
    if (!req.session.isLoggedIn) return res.send('권한 없음');

    const projectId = req.params.id;
    const { title, stack, desc, github } = req.body; // github 데이터 받기

    db.query('UPDATE projects SET title=?, stack=?, description=?, github_url=? WHERE id=?',
        [title, stack, desc, github, projectId],
        (err) => {
            if (err) console.error(err);
            res.redirect('/projects');
        }
    );
});

// 3. 삭제 요청 처리 (GET)
app.get('/projects/delete/:id', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.send('<script>alert("권한이 없습니다."); location.href="/login";</script>');
    }

    const projectId = req.params.id;

    db.query('DELETE FROM projects WHERE id = ?', [projectId], (err) => {
        if (err) console.error(err);
        res.redirect('/projects');
    });
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});