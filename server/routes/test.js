'use strict';
const express = require('express');
const prisma  = require('../prisma/client');
const { requireAuth, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// ── Helper ────────────────────────────────────────────────────────────────────
function autoGrade(question, userAnswer) {
  const type   = question.type;
  const answer = typeof question.answer === 'string'
    ? (question.answer.startsWith('[') ? JSON.parse(question.answer) : question.answer)
    : question.answer;

  if (type === 'single' || type === 'judge') {
    return String(userAnswer) === String(answer) ? question.score : 0;
  }
  if (type === 'multiple') {
    const correct = (Array.isArray(answer) ? answer : [answer]).map(String).sort();
    const given   = (Array.isArray(userAnswer) ? userAnswer : []).map(String).sort();
    return JSON.stringify(correct) === JSON.stringify(given) ? question.score : 0;
  }
  return null; // code/essay → manual grading
}

// ── Questions ─────────────────────────────────────────────────────────────────

// GET /api/test/questions
router.get('/questions', requireAuth, async (_req, res) => {
  try {
    const qs = await prisma.question.findMany();
    // Parse JSON fields for client
    const questions = qs.map(q => ({
      ...q,
      options: JSON.parse(q.options || '[]'),
      answer:  q.answer.startsWith('[') ? JSON.parse(q.answer) : q.answer,
    }));
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/test/questions
router.post('/questions', teacherOnly, async (req, res) => {
  const { type, questionText, options, answer, score } = req.body;
  if (!type || !questionText || answer === undefined || !score)
    return res.status(400).json({ success: false, error: '缺少必要字段' });

  try {
    const q = await prisma.question.create({
      data: {
        type,
        questionText,
        options: JSON.stringify(Array.isArray(options) ? options : []),
        answer:  Array.isArray(answer) ? JSON.stringify(answer) : String(answer),
        score:   Number(score),
      },
    });
    res.json({ success: true, question: { ...q, options: JSON.parse(q.options), answer: q.answer.startsWith('[') ? JSON.parse(q.answer) : q.answer } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/test/questions/:id
router.delete('/questions/:id', teacherOnly, async (req, res) => {
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.json({ success: true }); // idempotent
  }
});

// POST /api/test/questions/import
router.post('/questions/import', teacherOnly, async (req, res) => {
  const body = req.body;
  let list = Array.isArray(body) ? body : (body && Array.isArray(body.questions) ? body.questions : null);
  if (!list || list.length === 0)
    return res.status(400).json({ success: false, error: '请提供题目数组' });

  const TYPE_MAP   = { fill: 'essay' };
  const VALID_TYPES = ['single', 'multiple', 'judge', 'code', 'essay'];
  const imported = [], errors = [];

  for (const [i, item] of list.entries()) {
    const rawType = item.type;
    const type    = rawType ? (TYPE_MAP[rawType] || rawType) : undefined;
    const questionText = item.questionText || item.question_text;
    const { options, answer, score } = item;

    if (!type || !questionText || answer === undefined || score === undefined) {
      errors.push(`第${i + 1}题缺少必要字段`); continue;
    }
    if (!VALID_TYPES.includes(type)) {
      errors.push(`第${i + 1}题 type 无效: ${rawType}`); continue;
    }

    try {
      const q = await prisma.question.create({
        data: {
          type,
          questionText,
          options: JSON.stringify(Array.isArray(options) ? options : []),
          answer:  Array.isArray(answer) ? JSON.stringify(answer) : String(answer),
          score:   Number(score),
        },
      });
      imported.push({ ...q, options: JSON.parse(q.options), answer: q.answer.startsWith('[') ? JSON.parse(q.answer) : q.answer });
    } catch (err) {
      errors.push(`第${i + 1}题入库失败: ${err.message}`);
    }
  }

  res.json({ success: true, imported: imported.length, errors, questions: imported });
});

// ── Exams ─────────────────────────────────────────────────────────────────────

// GET /api/test/exams
router.get('/exams', requireAuth, async (_req, res) => {
  try {
    const exams = await prisma.exam.findMany({ orderBy: { createdAt: 'desc' } });
    const list = exams.map(e => ({
      ...e,
      questionIds:   JSON.parse(e.questionIds),
      questionCount: JSON.parse(e.questionIds).length,
    }));
    res.json({ success: true, exams: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/test/exams/:id
router.get('/exams/:id', requireAuth, async (req, res) => {
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ success: false, error: '考试不存在' });

    const qids = JSON.parse(exam.questionIds);
    const qs   = await prisma.question.findMany({ where: { id: { in: qids } } });
    const qMap = Object.fromEntries(qs.map(q => [q.id, q]));
    const questions = qids.map(id => qMap[id]).filter(Boolean).map(q => ({
      ...q,
      options: JSON.parse(q.options || '[]'),
      answer:  q.answer.startsWith('[') ? JSON.parse(q.answer) : q.answer,
    }));

    res.json({ success: true, exam: { ...exam, questionIds: qids, questions } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/test/exams
router.post('/exams', teacherOnly, async (req, res) => {
  const { title, duration, questionIds } = req.body;
  if (!title || !duration || !Array.isArray(questionIds) || questionIds.length === 0)
    return res.status(400).json({ success: false, error: '请填写考试标题、时长并选择题目' });

  try {
    const ids = questionIds.map(String);
    const qs  = await prisma.question.findMany({ where: { id: { in: ids } } });
    const totalScore = qs.reduce((s, q) => s + q.score, 0);

    const exam = await prisma.exam.create({
      data: {
        title,
        duration:    Number(duration),
        totalScore,
        questionIds: JSON.stringify(ids),
        createdBy:   req.user.id,
      },
    });
    res.json({ success: true, exam: { ...exam, questionIds: ids } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/test/exams/:id
router.delete('/exams/:id', teacherOnly, async (req, res) => {
  try {
    await prisma.exam.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

// ── Submissions ───────────────────────────────────────────────────────────────

// POST /api/test/submit
router.post('/submit', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { examId, answers } = req.body;
  if (!examId || !answers)
    return res.status(400).json({ success: false, error: '缺少必要字段' });

  try {
    const exam = await prisma.exam.findUnique({ where: { id: String(examId) } });
    if (!exam) return res.status(404).json({ success: false, error: '考试不存在' });

    const existing = await prisma.submission.findUnique({
      where: { userId_examId: { userId, examId: String(examId) } },
    });
    if (existing) return res.status(409).json({ success: false, error: '您已提交过此考试' });

    const qids = JSON.parse(exam.questionIds);
    const qs   = await prisma.question.findMany({ where: { id: { in: qids } } });
    const qMap = Object.fromEntries(qs.map(q => [q.id, q]));

    let totalScore = 0;
    let hasSubjective = false;
    const gradedAnswers = {};

    for (const qid of qids) {
      const q = qMap[qid];
      if (!q) continue;
      const userAns = answers[qid];
      const pts = autoGrade(q, userAns);
      if (pts === null) hasSubjective = true;
      else totalScore += pts;
      gradedAnswers[qid] = { answer: userAns, score: pts, maxScore: q.score };
    }

    const sub = await prisma.submission.create({
      data: {
        userId,
        examId:    String(examId),
        answers:   JSON.stringify(gradedAnswers),
        score:     totalScore,
        totalScore: exam.totalScore,
        status:    hasSubjective ? 'pending' : 'completed',
      },
    });

    res.json({ success: true, submission: { id: sub.id, score: totalScore, totalScore: exam.totalScore, status: sub.status } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/test/submissions/:userId
router.get('/submissions/:userId', requireAuth, async (req, res) => {
  const targetId = req.params.userId;
  if (req.user.role === 'student' && req.user.id !== targetId)
    return res.status(403).json({ success: false, error: '无权查看他人答卷' });

  try {
    const subs = await prisma.submission.findMany({
      where: { userId: targetId },
      include: { exam: { select: { title: true } }, user: { select: { username: true, name: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    const submissions = subs.map(s => ({
      id: s.id, userId: s.userId, username: s.user.username,
      examId: s.examId, examTitle: s.exam.title,
      answers: JSON.parse(s.answers),
      score: s.score, totalScore: s.totalScore,
      status: s.status, submittedAt: s.submittedAt.toISOString(),
    }));
    res.json({ success: true, submissions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/test/submissions  (teacher sees all)
router.get('/submissions', teacherOnly, async (_req, res) => {
  try {
    const subs = await prisma.submission.findMany({
      include: { exam: { select: { title: true } }, user: { select: { username: true, name: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    const submissions = subs.map(s => ({
      id: s.id, userId: s.userId, username: s.user.username,
      examId: s.examId, examTitle: s.exam.title,
      answers: JSON.parse(s.answers),
      score: s.score, totalScore: s.totalScore,
      status: s.status, submittedAt: s.submittedAt.toISOString(),
    }));
    res.json({ success: true, submissions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/test/submissions/review/:userId/:examId
router.get('/submissions/review/:userId/:examId', requireAuth, async (req, res) => {
  const { userId, examId } = req.params;
  if (req.user.role === 'student' && req.user.id !== userId)
    return res.status(403).json({ success: false, error: '无权查看他人答卷' });

  try {
    const sub = await prisma.submission.findUnique({
      where: { userId_examId: { userId, examId } },
      include: { exam: { select: { title: true } }, user: { select: { username: true } } },
    });
    if (!sub) return res.status(404).json({ success: false, error: '提交记录不存在' });

    const answersRaw = JSON.parse(sub.answers);
    const qids = Object.keys(answersRaw);
    const qs   = await prisma.question.findMany({ where: { id: { in: qids } } });
    const qMap = Object.fromEntries(qs.map(q => [q.id, q]));

    const enriched = {};
    for (const [qid, detail] of Object.entries(answersRaw)) {
      const q = qMap[qid];
      enriched[qid] = {
        ...detail,
        questionText:  q ? q.questionText : '',
        questionType:  q ? q.type : '',
        options:       q ? JSON.parse(q.options || '[]') : [],
        correctAnswer: q ? (q.answer.startsWith('[') ? JSON.parse(q.answer) : q.answer) : null,
      };
    }

    res.json({ success: true, submission: {
      id: sub.id, userId: sub.userId, username: sub.user.username,
      examId: sub.examId, examTitle: sub.exam.title,
      answers: enriched, score: sub.score, totalScore: sub.totalScore,
      status: sub.status, submittedAt: sub.submittedAt.toISOString(),
    }});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/test/submissions/detail/:userId/:examId  (teacher)
router.get('/submissions/detail/:userId/:examId', teacherOnly, async (req, res) => {
  const { userId, examId } = req.params;
  try {
    const sub = await prisma.submission.findUnique({
      where: { userId_examId: { userId, examId } },
      include: { exam: { select: { title: true } }, user: { select: { username: true } } },
    });
    if (!sub) return res.status(404).json({ success: false, error: '提交记录不存在' });

    const answersRaw = JSON.parse(sub.answers);
    const qids = Object.keys(answersRaw);
    const qs   = await prisma.question.findMany({ where: { id: { in: qids } } });
    const qMap = Object.fromEntries(qs.map(q => [q.id, q]));

    const enriched = {};
    for (const [qid, detail] of Object.entries(answersRaw)) {
      const q = qMap[qid];
      enriched[qid] = {
        ...detail,
        questionText:  q ? q.questionText : '',
        questionType:  q ? q.type : '',
        options:       q ? JSON.parse(q.options || '[]') : [],
        correctAnswer: q ? (q.answer.startsWith('[') ? JSON.parse(q.answer) : q.answer) : null,
      };
    }

    res.json({ success: true, submission: {
      id: sub.id, userId: sub.userId, username: sub.user.username,
      examId: sub.examId, examTitle: sub.exam.title,
      answers: enriched, score: sub.score, totalScore: sub.totalScore,
      status: sub.status, submittedAt: sub.submittedAt.toISOString(),
    }});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/test/submissions/grade/:userId/:examId  (teacher grades subjective)
router.post('/submissions/grade/:userId/:examId', teacherOnly, async (req, res) => {
  const { userId, examId } = req.params;
  const { scores } = req.body;
  if (!scores || typeof scores !== 'object')
    return res.status(400).json({ success: false, error: '请提供评分数据 { scores: { [qid]: number } }' });

  try {
    const sub = await prisma.submission.findUnique({
      where: { userId_examId: { userId, examId } },
    });
    if (!sub) return res.status(404).json({ success: false, error: '提交记录不存在' });

    const updatedAnswers = JSON.parse(sub.answers);
    let totalScore = 0;

    for (const [qid, detail] of Object.entries(updatedAnswers)) {
      if (scores[qid] !== undefined) {
        const s = Math.min(Number(scores[qid]), detail.maxScore);
        updatedAnswers[qid] = { ...detail, score: s };
      }
      const pts = updatedAnswers[qid].score;
      if (typeof pts === 'number') totalScore += pts;
    }

    const hasRemaining = Object.values(updatedAnswers).some(d => d.score === null);
    const updated = await prisma.submission.update({
      where: { userId_examId: { userId, examId } },
      data: {
        answers: JSON.stringify(updatedAnswers),
        score:   totalScore,
        status:  hasRemaining ? 'pending' : 'completed',
      },
    });

    res.json({ success: true, submission: { id: updated.id, score: updated.score, totalScore: updated.totalScore, status: updated.status } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/test/rooms/:code
router.get('/rooms/:code', requireAuth, (req, res) => {
  const { getRoom } = require('../socket');
  const room = getRoom(req.params.code.toUpperCase());
  if (room && room.type === 'test') {
    res.json({
      success: true, exists: true,
      examStarted: room.state.examStarted,
      examTitle:   room.state.examTitle,
      examId:      room.state.examId,
      viewerCount: room.viewers.size,
    });
  } else {
    res.json({ success: true, exists: false });
  }
});

module.exports = router;
