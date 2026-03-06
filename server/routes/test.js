'use strict';
const express = require('express');

const router = express.Router();

// ── In-memory data store ───────────────────────────────────────────
// Questions bank
const questions = new Map();
let qidCounter = 1;

// Exams
const exams = new Map();
let eidCounter = 1;

// Submissions: key = `${userId}_${examId}` → submission
const submissions = new Map();
let sidCounter = 1;

// ── Seed sample questions (network security themed) ────────────────
const sampleQuestions = [
  { type: 'single',   questionText: '以下哪种协议是物联网通信中最常用的轻量级消息传输协议？', options: ['HTTP', 'MQTT', 'FTP', 'SMTP'],           answer: '2', score: 5 },
  { type: 'single',   questionText: 'TCP/IP 协议中，哪一层负责端到端的可靠传输？',             options: ['网络层', '传输层', '应用层', '数据链路层'], answer: '2', score: 5 },
  { type: 'single',   questionText: 'SQL 注入攻击的根本原因是什么？',                          options: ['网络速度慢', '用户输入未经验证直接拼接进SQL', '数据库版本过旧', '服务器内存不足'], answer: '2', score: 5 },
  { type: 'multiple', questionText: '以下哪些属于常见的 Web 安全漏洞（OWASP Top 10）？',        options: ['SQL注入', 'XSS跨站脚本', '目录遍历', '内存溢出', '弱口令'], answer: ['1','2','3','5'], score: 10 },
  { type: 'multiple', questionText: 'HTTPS 相比 HTTP 的改进包括哪些？',                        options: ['数据加密', '身份认证', '传输更快', '完整性保护', '无需证书'], answer: ['1','2','4'], score: 10 },
  { type: 'judge',    questionText: 'ARP 协议工作在网络层（第三层）',                           options: [], answer: 'false', score: 5 },
  { type: 'judge',    questionText: 'HTTPS 默认使用 443 端口',                                 options: [], answer: 'true',  score: 5 },
  { type: 'judge',    questionText: 'MD5 目前被认为是安全的密码哈希算法',                       options: [], answer: 'false', score: 5 },
  { type: 'code',     questionText: '请用 Python 编写一个简单的端口扫描器，扫描目标主机的 1-1024 端口，输出开放的端口列表。',  options: [], answer: 'import socket\ndef scan_ports(host, start=1, end=1024):\n    open_ports = []\n    for port in range(start, end+1):\n        s = socket.socket()\n        s.settimeout(0.5)\n        if s.connect_ex((host, port)) == 0:\n            open_ports.append(port)\n        s.close()\n    return open_ports', score: 20 },
  { type: 'essay',    questionText: '简述对称加密和非对称加密的区别，并各举一个典型算法。',       options: [], answer: '对称加密使用同一密钥加解密，速度快，典型算法有AES、DES；非对称加密使用公钥加密、私钥解密，安全性高但速度慢，典型算法有RSA、ECC。', score: 15 },
];

sampleQuestions.forEach(q => {
  const id = String(qidCounter++);
  questions.set(id, { id, ...q });
});

// Seed sample exam
const sampleExamId = String(eidCounter++);
const sampleQIds = ['1','2','3','4','6','7'];
const sampleTotalScore = sampleQIds.reduce((sum, qid) => {
  const q = questions.get(qid); return sum + (q ? q.score : 0);
}, 0);
exams.set(sampleExamId, {
  id: sampleExamId,
  title: '网络安全基础知识测验',
  duration: 30,
  totalScore: sampleTotalScore,
  questionIds: sampleQIds,
  createdBy: 'u1',
  createdAt: new Date().toISOString(),
});

// ── Helper ─────────────────────────────────────────────────────────
function autoGrade(question, userAnswer) {
  if (question.type === 'single' || question.type === 'judge') {
    return String(userAnswer) === String(question.answer) ? question.score : 0;
  }
  if (question.type === 'multiple') {
    const correct = (Array.isArray(question.answer) ? question.answer : JSON.parse(question.answer)).map(String).sort();
    const given   = (Array.isArray(userAnswer)       ? userAnswer       : []).map(String).sort();
    return JSON.stringify(correct) === JSON.stringify(given) ? question.score : 0;
  }
  return null; // code/essay → manual grading
}

// ── Questions API ──────────────────────────────────────────────────

// GET /api/test/questions
router.get('/questions', (_req, res) => {
  res.json({ success: true, questions: [...questions.values()] });
});

// POST /api/test/questions
router.post('/questions', (req, res) => {
  const { type, questionText, options, answer, score } = req.body;
  if (!type || !questionText || !answer || !score) {
    return res.status(400).json({ success: false, error: '缺少必要字段' });
  }
  const id = String(qidCounter++);
  const q  = { id, type, questionText, options: options || [], answer, score: Number(score) };
  questions.set(id, q);
  res.json({ success: true, question: q });
});

// DELETE /api/test/questions/:id
router.delete('/questions/:id', (req, res) => {
  questions.delete(req.params.id);
  res.json({ success: true });
});

// POST /api/test/questions/import  (bulk import from JSON array or wrapped object)
router.post('/questions/import', (req, res) => {
  const body = req.body;
  // Accept either a raw array or { questions: [...], title?, ... }
  let list = Array.isArray(body) ? body : (body && Array.isArray(body.questions) ? body.questions : null);
  if (!list || list.length === 0) {
    return res.status(400).json({ success: false, error: '请提供题目数组，或包含 questions 字段的对象' });
  }

  // Type aliases: fill -> essay
  const TYPE_MAP = { fill: 'essay' };
  const VALID_TYPES = ['single', 'multiple', 'judge', 'code', 'essay'];

  const imported = [];
  const errors = [];
  for (const [i, item] of list.entries()) {
    // Support both camelCase (questionText) and snake_case (question_text)
    const rawType = item.type;
    const type = rawType ? (TYPE_MAP[rawType] || rawType) : undefined;
    const questionText = item.questionText || item.question_text;
    const { options, answer, score } = item;

    if (!type || !questionText || answer === undefined || score === undefined) {
      errors.push(`第${i + 1}题缺少必要字段 (type/questionText/answer/score)`);
      continue;
    }
    if (!VALID_TYPES.includes(type)) {
      errors.push(`第${i + 1}题 type 无效: ${rawType}（支持: ${VALID_TYPES.join(', ')}）`);
      continue;
    }
    const id = String(qidCounter++);
    // Normalize 0-indexed answers to 1-indexed for single/multiple
    let normalizedAnswer = answer;
    if (type === 'single' || type === 'multiple') {
      const isZeroIndexed = (a) => /^\d+$/.test(String(a)) && Number(a) >= 0;
      if (type === 'single' && isZeroIndexed(answer)) {
        normalizedAnswer = String(Number(answer) + 1);
      } else if (type === 'multiple' && Array.isArray(answer) && answer.some(a => isZeroIndexed(a))) {
        normalizedAnswer = answer.map(a => isZeroIndexed(a) ? String(Number(a) + 1) : a);
      }
    }
    const q = { id, type, questionText, options: Array.isArray(options) ? options : [], answer: normalizedAnswer, score: Number(score) };
    questions.set(id, q);
    imported.push(q);
  }
  res.json({ success: true, imported: imported.length, errors, questions: imported });
});

// ── Exams API ──────────────────────────────────────────────────────

// GET /api/test/exams
router.get('/exams', (_req, res) => {
  const list = [...exams.values()].map(e => ({
    ...e,
    questionCount: e.questionIds.length,
  }));
  res.json({ success: true, exams: list });
});

// GET /api/test/exams/:id
router.get('/exams/:id', (req, res) => {
  const exam = exams.get(req.params.id);
  if (!exam) return res.status(404).json({ success: false, error: '考试不存在' });

  const examQuestions = exam.questionIds
    .map(qid => questions.get(qid))
    .filter(Boolean)
    .map(q => ({
      ...q,
      // Strip answers from student view (handled in client, but good practice)
    }));

  res.json({ success: true, exam: { ...exam, questions: examQuestions } });
});

// POST /api/test/exams  (create exam)
router.post('/exams', (req, res) => {
  const { title, duration, questionIds } = req.body;
  if (!title || !duration || !Array.isArray(questionIds) || questionIds.length === 0) {
    return res.status(400).json({ success: false, error: '请填写考试标题、时长并选择题目' });
  }
  const totalScore = questionIds.reduce((sum, qid) => {
    const q = questions.get(String(qid));
    return sum + (q ? q.score : 0);
  }, 0);
  const id = String(eidCounter++);
  const exam = {
    id,
    title,
    duration: Number(duration),
    totalScore,
    questionIds: questionIds.map(String),
    createdBy: 'teacher',
    createdAt: new Date().toISOString(),
  };
  exams.set(id, exam);
  res.json({ success: true, exam });
});

// DELETE /api/test/exams/:id
router.delete('/exams/:id', (req, res) => {
  exams.delete(req.params.id);
  res.json({ success: true });
});

// ── Submissions API ────────────────────────────────────────────────

// POST /api/test/submit
router.post('/submit', (req, res) => {
  const { userId, examId, answers, username } = req.body;
  if (!userId || !examId || !answers) {
    return res.status(400).json({ success: false, error: '缺少必要字段' });
  }

  const exam = exams.get(String(examId));
  if (!exam) return res.status(404).json({ success: false, error: '考试不存在' });

  // Check duplicate submission
  const key = `${userId}_${examId}`;
  if (submissions.has(key)) {
    return res.status(409).json({ success: false, error: '您已提交过此考试' });
  }

  let totalScore = 0;
  let hasSubjective = false;
  const gradedAnswers = {};

  exam.questionIds.forEach(qid => {
    const q = questions.get(qid);
    if (!q) return;
    const userAns = answers[qid];
    const pts = autoGrade(q, userAns);
    if (pts === null) {
      hasSubjective = true;
    } else {
      totalScore += pts;
    }
    gradedAnswers[qid] = { answer: userAns, score: pts, maxScore: q.score };
  });

  const sid = String(sidCounter++);
  const submission = {
    id: sid,
    userId,
    username: username || userId,
    examId,
    examTitle: exam.title,
    answers: gradedAnswers,
    score: totalScore,
    totalScore: exam.totalScore,
    status: hasSubjective ? 'pending' : 'completed',
    submittedAt: new Date().toISOString(),
  };
  submissions.set(key, submission);

  res.json({ success: true, submission: { id: sid, score: totalScore, totalScore: exam.totalScore, status: submission.status } });
});

// GET /api/test/submissions/:userId  (student's own history)
router.get('/submissions/:userId', (req, res) => {
  const { userId } = req.params;
  const list = [...submissions.values()]
    .filter(s => s.userId === userId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json({ success: true, submissions: list });
});

// GET /api/test/submissions  (teacher sees all)
router.get('/submissions', (_req, res) => {
  const list = [...submissions.values()]
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json({ success: true, submissions: list });
});

// GET /api/test/submissions/review/:userId/:examId  (student reviews own graded submission with correct answers)
router.get('/submissions/review/:userId/:examId', (req, res) => {
  const { userId, examId } = req.params;
  const key = `${userId}_${examId}`;
  const sub = submissions.get(key);
  if (!sub) return res.status(404).json({ success: false, error: '提交记录不存在' });

  const enriched = {};
  for (const [qid, detail] of Object.entries(sub.answers)) {
    const q = questions.get(qid);
    enriched[qid] = {
      ...detail,
      questionText: q ? q.questionText : '',
      questionType: q ? q.type : '',
      options: q ? q.options : [],
      correctAnswer: q ? q.answer : null,
    };
  }
  res.json({ success: true, submission: { ...sub, answers: enriched } });
});

// GET /api/test/submissions/detail/:key  (teacher: full detail of one submission)
router.get('/submissions/detail/:userId/:examId', (req, res) => {
  const { userId, examId } = req.params;
  const key = `${userId}_${examId}`;
  const sub = submissions.get(key);
  if (!sub) return res.status(404).json({ success: false, error: '提交记录不存在' });

  // Enrich answers with question text
  const enriched = {};
  for (const [qid, detail] of Object.entries(sub.answers)) {
    const q = questions.get(qid);
    enriched[qid] = {
      ...detail,
      questionText: q ? q.questionText : '',
      questionType: q ? q.type : '',
      options: q ? q.options : [],
      correctAnswer: q ? q.answer : null,
    };
  }
  res.json({ success: true, submission: { ...sub, answers: enriched } });
});

// POST /api/test/submissions/grade/:userId/:examId  (teacher grades subjective questions)
router.post('/submissions/grade/:userId/:examId', (req, res) => {
  const { userId, examId } = req.params;
  const { scores } = req.body; // { [qid]: score }
  if (!scores || typeof scores !== 'object') {
    return res.status(400).json({ success: false, error: '请提供评分数据 { scores: { [qid]: number } }' });
  }
  const key = `${userId}_${examId}`;
  const sub = submissions.get(key);
  if (!sub) return res.status(404).json({ success: false, error: '提交记录不存在' });

  let totalScore = 0;
  const updatedAnswers = { ...sub.answers };
  for (const [qid, detail] of Object.entries(updatedAnswers)) {
    if (scores[qid] !== undefined) {
      const maxScore = detail.maxScore;
      const s = Math.min(Number(scores[qid]), maxScore);
      updatedAnswers[qid] = { ...detail, score: s };
    }
    const pts = updatedAnswers[qid].score;
    if (typeof pts === 'number') totalScore += pts;
  }

  const hasRemaining = Object.values(updatedAnswers).some(d => d.score === null);
  sub.answers = updatedAnswers;
  sub.score = totalScore;
  sub.status = hasRemaining ? 'pending' : 'completed';
  submissions.set(key, sub);

  res.json({ success: true, submission: { id: sub.id, score: sub.score, totalScore: sub.totalScore, status: sub.status } });
});

// GET /api/test/rooms/:code
router.get('/rooms/:code', (req, res) => {
  const { getRoom } = require('../socket');
  const room = getRoom(req.params.code.toUpperCase());
  if (room && room.type === 'test') {
    res.json({
      success: true,
      exists: true,
      examStarted: room.state.examStarted,
      examTitle: room.state.examTitle,
      examId: room.state.examId,
      viewerCount: room.viewers.size,
    });
  } else {
    res.json({ success: true, exists: false });
  }
});

module.exports = router;
module.exports.questions = questions;
module.exports.exams     = exams;
module.exports.submissions = submissions;
