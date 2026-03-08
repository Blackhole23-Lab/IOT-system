'use strict';
const express = require('express');
const prisma  = require('../prisma/client');
const { requireAuth, teacherOnly, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/classrooms ────────────────────────────────────────────────────────
// Teacher: own classrooms with member count
// Admin: all classrooms
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { teacherId: req.user.id };
    const classrooms = await prisma.classroom.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, username: true } },
        members: {
          include: { student: { select: { id: true, name: true, username: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, classrooms: classrooms.map(formatClassroom) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/classrooms/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const c = await prisma.classroom.findUnique({
      where: { id: req.params.id },
      include: {
        teacher: { select: { id: true, name: true, username: true } },
        members: {
          include: { student: { select: { id: true, name: true, username: true, email: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!c) return res.status(404).json({ success: false, error: '班级不存在' });

    // Only teacher owner or admin can see
    if (req.user.role !== 'admin' && c.teacherId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权访问此班级' });
    }

    res.json({ success: true, classroom: formatClassroom(c) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/classrooms  (teacher or admin creates)
router.post('/', teacherOnly, async (req, res) => {
  const { name, teacherId } = req.body;
  if (!name) return res.status(400).json({ success: false, error: '班级名称不能为空' });

  // Admin can create on behalf of a teacher; teacher creates own
  const ownerId = req.user.role === 'admin' && teacherId ? teacherId : req.user.id;

  try {
    const c = await prisma.classroom.create({
      data: { name, teacherId: ownerId },
      include: {
        teacher: { select: { id: true, name: true, username: true } },
        members: [],
      },
    });
    res.json({ success: true, classroom: formatClassroom(c) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/classrooms/:id  (rename)
router.put('/:id', teacherOnly, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ success: false, error: '班级名称不能为空' });

  try {
    const c = await prisma.classroom.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ success: false, error: '班级不存在' });
    if (req.user.role !== 'admin' && c.teacherId !== req.user.id)
      return res.status(403).json({ success: false, error: '无权修改此班级' });

    const updated = await prisma.classroom.update({
      where: { id: req.params.id },
      data: { name },
      include: {
        teacher: { select: { id: true, name: true, username: true } },
        members: { include: { student: { select: { id: true, name: true, username: true } } } },
      },
    });
    res.json({ success: true, classroom: formatClassroom(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/classrooms/:id
router.delete('/:id', teacherOnly, async (req, res) => {
  try {
    const c = await prisma.classroom.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ success: false, error: '班级不存在' });
    if (req.user.role !== 'admin' && c.teacherId !== req.user.id)
      return res.status(403).json({ success: false, error: '无权删除此班级' });

    await prisma.classroom.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/classrooms/:id/students  (add students to classroom)
// body: { studentIds: string[] }
router.post('/:id/students', teacherOnly, async (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0)
    return res.status(400).json({ success: false, error: '请提供学生ID列表' });

  try {
    const c = await prisma.classroom.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ success: false, error: '班级不存在' });
    if (req.user.role !== 'admin' && c.teacherId !== req.user.id)
      return res.status(403).json({ success: false, error: '无权修改此班级' });

    // Verify all are students
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds }, role: 'student' },
    });
    if (students.length === 0)
      return res.status(400).json({ success: false, error: '未找到有效的学生' });

    // Upsert (skip duplicates)
    const results = await Promise.allSettled(
      students.map(s =>
        prisma.classroomStudent.upsert({
          where: { classroomId_studentId: { classroomId: req.params.id, studentId: s.id } },
          update: {},
          create: { classroomId: req.params.id, studentId: s.id },
        })
      )
    );
    const added = results.filter(r => r.status === 'fulfilled').length;
    res.json({ success: true, added });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/classrooms/:id/students/:studentId
router.delete('/:id/students/:studentId', teacherOnly, async (req, res) => {
  try {
    const c = await prisma.classroom.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ success: false, error: '班级不存在' });
    if (req.user.role !== 'admin' && c.teacherId !== req.user.id)
      return res.status(403).json({ success: false, error: '无权修改此班级' });

    await prisma.classroomStudent.deleteMany({
      where: { classroomId: req.params.id, studentId: req.params.studentId },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/classrooms/:id/students/available
// Returns students NOT yet in this classroom (for adding)
router.get('/:id/students/available', teacherOnly, async (req, res) => {
  try {
    const members = await prisma.classroomStudent.findMany({
      where: { classroomId: req.params.id },
      select: { studentId: true },
    });
    const memberIds = members.map(m => m.studentId);
    const available = await prisma.user.findMany({
      where: { role: 'student', id: { notIn: memberIds } },
      select: { id: true, name: true, username: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, students: available });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/classrooms/teacher/:teacherId  (admin queries a specific teacher's classrooms)
router.get('/teacher/:teacherId', adminOnly, async (req, res) => {
  try {
    const classrooms = await prisma.classroom.findMany({
      where: { teacherId: req.params.teacherId },
      include: {
        teacher: { select: { id: true, name: true, username: true } },
        members: { include: { student: { select: { id: true, name: true, username: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, classrooms: classrooms.map(formatClassroom) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/classrooms/student/:studentId/mine  (which classrooms is this student in)
router.get('/student/:studentId/mine', requireAuth, async (req, res) => {
  const targetId = req.params.studentId;
  if (req.user.role === 'student' && req.user.id !== targetId)
    return res.status(403).json({ success: false, error: '无权查看' });

  try {
    const memberships = await prisma.classroomStudent.findMany({
      where: { studentId: targetId },
      include: {
        classroom: {
          include: { teacher: { select: { id: true, name: true, username: true } } },
        },
      },
    });
    const classrooms = memberships.map(m => ({
      id: m.classroom.id,
      name: m.classroom.name,
      teacher: m.classroom.teacher,
      joinedAt: m.joinedAt,
    }));
    res.json({ success: true, classrooms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function formatClassroom(c) {
  return {
    id: c.id,
    name: c.name,
    teacherId: c.teacherId,
    teacher: c.teacher,
    studentCount: c.members?.length ?? 0,
    students: c.members?.map(m => ({
      ...m.student,
      joinedAt: m.joinedAt,
    })) ?? [],
    createdAt: c.createdAt,
  };
}

module.exports = router;
